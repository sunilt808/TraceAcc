"""
services/liveshield/alert_bridge.py — LiveShield to TraceLab / InvoSpace Alert Integration Bridge (Phase 2).

Creates synthetic Alerts in the TraceAcc database when suspicious patterns or high-risk
transactions are detected by the LiveShield screening and DC-LCG inference engines.
"""
from __future__ import annotations
import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from models.alert import Alert
from fastapi.encoders import jsonable_encoder

logger = logging.getLogger(__name__)


class LiveShieldAlertBridge:
    """
    Bridges LiveShield detections to the TraceAcc Alerting and Case Management pipeline.
    """

    def __init__(
        self,
        db_session_factory,
        organization_id: int,
        created_by_id: Optional[int] = None,
        case_id: Optional[int] = None,
    ):
        self.db_session_factory = db_session_factory
        self.organization_id = organization_id
        self.created_by_id = created_by_id
        self.case_id = case_id

    def create_alert_for_decision(self, decision_record: Dict[str, Any]) -> Optional[int]:
        """
        Create a new Alert record if the decision is FLAG, HOLD, or REJECT, or risk is HIGH/CRITICAL.
        Returns alert_id if created, None otherwise.
        """
        risk_tier = decision_record.get("risk_tier", "LOW")
        decision = decision_record.get("final_decision", "APPROVE")
        
        # Only create alerts for actionable or high risk
        if risk_tier not in ("HIGH", "CRITICAL") and decision not in ("FLAG", "HOLD", "REJECT"):
            return None

        scenario_id = decision_record.get("scenario_id") or "UNSPECIFIED"
        alert_type = f"LIVESHIELD_{scenario_id.upper()}"
        pattern_type = scenario_id
        risk_score = float(decision_record.get("combined_risk_score", 0.0))
        severity = risk_tier  # LOW | MEDIUM | HIGH | CRITICAL

        trigger_reason = decision_record.get("decision_reason") or f"LiveShield detected risk score {risk_score:.2f}"
        
        detection_details = {
            "simulation_id": decision_record.get("simulation_id"),
            "transaction_id": decision_record.get("transaction_id"),
            "sequence_id": decision_record.get("sequence_id"),
            "fast_screening_score": decision_record.get("fast_screening_score"),
            "fast_screening_signals": decision_record.get("fast_screening_signals"),
            "dclcg_score": decision_record.get("dclcg_score"),
            "dclcg_disguise_score": decision_record.get("dclcg_disguise_score"),
            "dclcg_top_paths": decision_record.get("dclcg_top_paths"),
            "latency_total_ms": decision_record.get("latency_total_ms"),
            "is_synthetic": True,
        }

        related_txns = [decision_record.get("transaction_id")]
        related_accs = [
            decision_record.get("sender_account"),
            decision_record.get("receiver_account"),
        ]

        if not self.db_session_factory:
            return None

        db: Session = self.db_session_factory()
        try:
            # Check if simulation exists and has ON_CRITICAL_ALERT policy
            sim_id = decision_record.get("simulation_id")
            if not self.case_id and sim_id and severity == "CRITICAL":
                from models.liveshield import Simulation
                from models.case import Case
                from models.case_event import CaseEvent

                sim = db.query(Simulation).filter(Simulation.id == sim_id).first()
                if sim and (sim.case_creation_policy or "").upper() == "ON_CRITICAL_ALERT" and not sim.case_id:
                    new_case = Case(
                        organization_id=self.organization_id,
                        created_by_id=self.created_by_id or 1,
                        title=f"LiveShield Critical Alert Escalation #{sim.id}: {sim.name}",
                        description=f"Auto-escalated investigation case triggered by CRITICAL LiveShield risk detection on transaction {decision_record.get('transaction_id')}.",
                        status="OPEN",
                        priority="CRITICAL",
                        case_origin="ALERT_ESCALATION",
                        is_synthetic=True,
                        simulation_id=sim.id,
                        tracelab_risk_score=risk_score,
                        investigation_risk_score=risk_score,
                        notes=f"Triggered by LiveShield {alert_type} on tx {decision_record.get('transaction_id')}",
                    )
                    db.add(new_case)
                    db.flush()

                    db.add(CaseEvent(
                        organization_id=self.organization_id,
                        case_id=new_case.id,
                        user_id=self.created_by_id or 1,
                        event_type="SYSTEM_ACTION",
                        content=f"Case #{new_case.id} automatically escalated due to CRITICAL LiveShield alert.",
                    ))

                    sim.case_id = new_case.id
                    self.case_id = new_case.id

            alert = Alert(
                organization_id=self.organization_id,
                alert_type=alert_type,
                pattern_type=pattern_type,
                risk_score=risk_score,
                severity=severity,
                status="NEW",
                trigger_reason=trigger_reason,
                detection_reason=jsonable_encoder(detection_details),
                related_transactions=jsonable_encoder(related_txns),
                related_accounts=jsonable_encoder(related_accs),
                created_by_id=self.created_by_id,
                case_id=self.case_id,
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            return alert.id
        except Exception as e:
            db.rollback()
            logger.error(f"[LiveShieldAlertBridge] Error creating synthetic alert: {e}")
            return None
        finally:
            db.close()
