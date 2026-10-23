"""
api/routes/liveshield.py — REST API and WebSocket router for TraceAcc LiveShield Simulator (Phase 1 & Phase 2).
"""
from datetime import datetime, timezone
import json
import logging
from typing import Dict, List, Optional, Any

import io
import pandas as pd
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    File,
    Form,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy import desc

from api.deps import (
    get_current_user,
    get_current_workspace,
    require_internal_user,
    require_admin,
    require_client,
)
from db.database import get_db, SessionLocal
from utils.csv_parser import parse_csv
from utils.graph import TransactionGraph
from utils.pipeline import run_full_analysis
from detectors.dclcg import get_latest_artifact, load_artifact, predict_graph
from models.alert import Alert
from models.role import Role
from models.liveshield import (
    Simulation,
    SimulationTransaction,
    SimulationPreset,
    SimulationEvent,
    SimulationDecisionRecord,
    SimulationEvaluationSummary,
    TransactionRiskAssessment,
    RiskReevaluationEvent,
)
from models.user import User
from models.case import Case
from models.case_event import CaseEvent
from schemas.liveshield import (
    SimulationCreateRequest,
    SimulationUpdateRequest,
    SimulationResponse,
    SimulationValidationResult,
    SimulationStatsResponse,
    TransactionResponse,
    DecisionRecordResponse,
    DecisionOverrideRequest,
    EvaluationSummaryResponse,
    ModelStatusResponse,
    PresetCreateRequest,
    PresetResponse,
    ScenarioInfoResponse,
    BasicSimulationConfig,
    AdvancedSimulationConfig,
    RiskAssessmentResponse,
    RetrospectiveAlertResponse,
    ClearedTransactionResponse,
    ManualReassessmentRequest,
    ReevaluationStatsResponse,
    SpeedUpdateRequest,
)
from services.liveshield.manager import simulation_manager
from services.liveshield.registry import scenario_registry
from services.liveshield.presets import BUILTIN_PRESETS

logger = logging.getLogger("liveshield")

router = APIRouter(
    prefix="/liveshield",
    tags=["LiveShield Simulator"],
)


# ============================================================
# SCENARIOS ENDPOINTS
# ============================================================

@router.get("/scenarios", response_model=List[ScenarioInfoResponse])
def get_all_scenarios(current_user: User = Depends(require_internal_user)):
    """List all 18 supported synthetic fraud scenarios (F01–F18)."""
    scenarios = scenario_registry.list_scenarios()
    return [
        ScenarioInfoResponse(
            scenario_id=s.scenario_id,
            name=s.name,
            category=s.category,
            description=s.description,
            default_params=s.default_params,
            param_schema=s.param_schema,
        )
        for s in scenarios
    ]


@router.get("/scenarios/{scenario_id}", response_model=ScenarioInfoResponse)
def get_scenario_details(scenario_id: str, current_user: User = Depends(require_internal_user)):
    """Get metadata and schema for a specific scenario."""
    meta = scenario_registry.get_metadata(scenario_id.upper())
    if not meta:
        raise HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")
    return ScenarioInfoResponse(
        scenario_id=meta.scenario_id,
        name=meta.name,
        category=meta.category,
        description=meta.description,
        default_params=meta.default_params,
        param_schema=meta.param_schema,
    )


# ============================================================
# PRESETS ENDPOINTS
# ============================================================

@router.get("/presets", response_model=List[PresetResponse])
def list_presets(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """List all built-in and organization-specific configuration presets."""
    existing_builtins = db.query(SimulationPreset).filter(SimulationPreset.is_builtin == True).count()
    if existing_builtins < len(BUILTIN_PRESETS):
        for p in BUILTIN_PRESETS:
            exists = db.query(SimulationPreset).filter(SimulationPreset.name == p["name"]).first()
            if not exists:
                db.add(SimulationPreset(
                    name=p["name"],
                    description=p["description"],
                    mode=p["mode"],
                    config=jsonable_encoder(p["config"]),
                    is_builtin=True,
                ))
        db.commit()

    presets = db.query(SimulationPreset).filter(
        (SimulationPreset.is_builtin == True) | (SimulationPreset.organization_id == org_id)
    ).order_by(desc(SimulationPreset.is_builtin), SimulationPreset.name).all()

    return presets


@router.post("/presets", response_model=PresetResponse, status_code=status.HTTP_201_CREATED)
def create_preset(
    payload: PresetCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Save a custom simulation configuration preset."""
    raw_cfg = payload.config if isinstance(payload.config, dict) else (
        payload.config.model_dump(mode="json") if hasattr(payload.config, "model_dump") else dict(payload.config)
    )
    preset = SimulationPreset(
        name=payload.name,
        description=payload.description,
        mode=payload.mode,
        config=jsonable_encoder(raw_cfg),
        detection_config=jsonable_encoder(payload.detection_config or {}),
        is_builtin=False,
        organization_id=org_id,
        created_by_id=current_user.id,
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset


# ============================================================
# SIMULATION CRUD & LIFECYCLE ENDPOINTS
# ============================================================

@router.post("/simulations", response_model=SimulationResponse, status_code=status.HTTP_201_CREATED)
def create_simulation(
    payload: SimulationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    org_id: int = Depends(get_current_workspace),
):
    """Create a new simulation configuration with detection mode in READY state. Admin exclusive."""
    raw_config = payload.config if isinstance(payload.config, dict) else (
        payload.config.model_dump(mode="json") if hasattr(payload.config, "model_dump") else dict(payload.config)
    )
    json_config = jsonable_encoder(raw_config)
    target_org_id = payload.target_organization_id or org_id
    policy = (payload.case_creation_policy or "NONE").upper()
    
    simulation = Simulation(
        name=payload.name,
        description=payload.description,
        mode=payload.mode,
        detection_mode=payload.detection_mode or "shadow",
        status="READY",
        case_creation_policy=policy,
        config=json_config,
        detection_config=jsonable_encoder(payload.detection_config or {}),
        stats={
            "total_generated": 0,
            "total_legitimate": 0,
            "total_fraudulent": 0,
            "total_volume": 0.0,
            "elapsed_seconds": 0.0,
        },
        organization_id=target_org_id,
        created_by_id=current_user.id,
    )
    db.add(simulation)
    db.commit()
    db.refresh(simulation)

    db.add(SimulationEvent(
        simulation_id=simulation.id,
        event_type="CREATED",
        message=f"Simulation '{simulation.name}' created in {simulation.mode} mode (Policy: {policy}, Target Org: {target_org_id})",
        details={"created_by": current_user.username, "policy": policy, "target_org_id": target_org_id},
    ))
    db.commit()

    return simulation


@router.post("/simulations/upload", response_model=SimulationResponse, status_code=status.HTTP_201_CREATED)
async def upload_simulation_dataset(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    target_tps: Optional[float] = Form(250.0),
    detection_mode: Optional[str] = Form("shadow"),
    detection_config: Optional[str] = Form(None),
    target_organization_id: Optional[int] = Form(None),
    service_request_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
    org_id: int = Depends(get_current_workspace),
):
    """
    Unified Ingestion & Analysis: Upload a transaction CSV dataset directly.
    Available to Admin and Client users.
    Runs Fast Screening, DC-LCG graph inference, full hybrid detector suite, automated Case creation,
    risk evaluation, and stores all graph/temporal/ring structures into the simulation.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV transaction files are accepted.")

    contents = await file.read()
    try:
        decoded_content = contents.decode("utf-8")
    except UnicodeDecodeError:
        decoded_content = contents.decode("latin-1")

    if not decoded_content.strip():
        raise HTTPException(status_code=400, detail="Uploaded CSV file is empty.")

    try:
        graph = parse_csv(decoded_content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")

    if not graph.transactions:
        raise HTTPException(status_code=400, detail="No valid transactions found in CSV.")

    # Parse dataframe to extract row-level metadata and possible ground truth labels
    df = None
    try:
        df = pd.read_csv(io.StringIO(decoded_content), low_memory=False)
        df.columns = [str(c).strip().lower() for c in df.columns]
    except Exception:
        pass

    # Find label column if exists
    label_col = None
    if df is not None:
        for candidate in ["label", "is_fraud", "class", "illicit", "fraud", "is_synthetic"]:
            if candidate in df.columns:
                label_col = candidate
                break

    # Run full hybrid analysis pipeline
    analysis_result = run_full_analysis(graph)

    # DC-LCG inference if model artifact exists
    dclcg_scores = {}
    dclcg_disguise = {}
    dclcg_top_paths = {}
    try:
        artifact_path = get_latest_artifact()
        if artifact_path:
            bundle = load_artifact(artifact_path)
            dclcg_out = predict_graph(graph, bundle)
            dclcg_scores = dclcg_out.get("probs", {})
            dclcg_disguise = dclcg_out.get("disguise", {})
            dclcg_top_paths = dclcg_out.get("top_paths", {})
            analysis_result["dclcg"] = {
                "available": True,
                "model": bundle.get("model_name", "dclcg_prod_e2e"),
                "flagged_count": len([p for p in dclcg_scores.values() if p >= 0.5]),
            }
    except Exception as dclcg_err:
        logger.warning("DC-LCG inference skipped on uploaded CSV: %s", dclcg_err)
        analysis_result["dclcg"] = {"available": False, "error": str(dclcg_err)}

    # Parse detection config
    det_cfg = {}
    if detection_config:
        try:
            det_cfg = json.loads(detection_config) if isinstance(detection_config, str) else dict(detection_config)
        except Exception:
            pass

    # Build account score lookups from hybrid scores
    account_hybrid_map = {h["account_id"]: h for h in (analysis_result.get("hybrid_scores") or [])}
    suspicious_accounts = {s["account_id"]: s for s in (analysis_result.get("suspicious_accounts") or [])}
    fraud_rings = analysis_result.get("fraud_rings") or []

    ring_account_map = {}
    for r in fraud_rings:
        for acc in r.get("member_accounts", []):
            ring_account_map.setdefault(acc, []).append(r.get("pattern_type", "RING"))

    is_client = current_user.role == Role.CLIENT_USER.value
    effective_org_id = current_user.organization_id if is_client else (target_organization_id or org_id)

    sim_name = name or f"Dataset: {file.filename}"
    case_title = f"{'Client Submission' if is_client else 'Data Ingestion'} #{sim_name}"
    case_desc = description or (
        f"Investigation Case created from uploaded transaction dataset '{file.filename}'. "
        f"Contains {len(graph.transactions):,} transactions across {len(graph.nodes):,} accounts. "
        f"Detected {len(fraud_rings)} fraud rings and {len(suspicious_accounts)} suspicious accounts."
    )

    # Automatically create Investigation Case
    case = Case(
        organization_id=effective_org_id,
        created_by_id=current_user.id,
        assigned_investigator_id=None if is_client else current_user.id,
        title=case_title,
        description=case_desc,
        status="SUBMITTED" if is_client else "OPEN",
        case_origin="CLIENT_UPLOAD",
        is_synthetic=False,
        service_request_id=service_request_id,
        priority="HIGH" if len(fraud_rings) > 0 or len(suspicious_accounts) > 5 else "MEDIUM",
        tracelab_risk_score=0.85 if len(fraud_rings) > 0 else 0.50,
        investigation_risk_score=0.85 if len(fraud_rings) > 0 else 0.50,
        notes=f"Dataset uploaded by {current_user.username} ({current_user.role}): {file.filename}. Top pattern detections: {list(set([r.get('pattern_type') for r in fraud_rings]))[:5]}",
        linked_accounts=list(suspicious_accounts.keys())[:30],
        linked_entities=[],
        linked_rings=[r.get("ring_id") for r in fraud_rings[:10]],
    )
    db.add(case)
    db.flush()

    # Link WorkflowInstance if service_request_id is provided
    if service_request_id:
        from models.service_request import ServiceRequest
        from models.workflow_instance import WorkflowInstance
        sr = db.query(ServiceRequest).filter(ServiceRequest.id == service_request_id).first()
        if sr:
            sr.status = "APPROVED" if is_client else "IN_PROGRESS"
            sr.dataset_filename = file.filename
            db.add(sr)
        
        wf = db.query(WorkflowInstance).filter(WorkflowInstance.service_request_id == service_request_id).first()
        if wf:
            wf.case_id = case.id
            wf.current_stage = "INVESTIGATION"
            wf.current_status = "IN_PROGRESS"
            db.add(wf)

    db.add(CaseEvent(
        organization_id=effective_org_id,
        case_id=case.id,
        user_id=current_user.id,
        event_type="SUBMITTED" if is_client else "SYSTEM_ACTION",
        content=f"Case #{case.id} created from uploaded dataset '{file.filename}' by {current_user.username}.",
    ))

    # Format dataset transactions for live streaming
    dataset_transactions = []
    for idx, tx in enumerate(graph.transactions):
        sender = str(tx["sender"]).strip()
        receiver = str(tx["receiver"]).strip()
        amt = float(tx["amount"])
        ts = tx["timestamp"] if isinstance(tx["timestamp"], datetime) else datetime.now(timezone.utc)
        txn_id = tx.get("id") or f"TXN-UP-{idx+1:06d}"

        # Determine ground truth (from CSV label column if present, or from structural analysis)
        is_fraud = False
        scenario_from_csv = None
        if df is not None and idx < len(df):
            if label_col:
                raw_val = str(df.iloc[idx][label_col]).strip().lower()
                is_fraud = raw_val in ("1", "1.0", "true", "yes", "illicit", "fraud")
            for sc_candidate in ["scenario_id", "scenario", "pattern", "typology"]:
                if sc_candidate in df.columns:
                    val = str(df.iloc[idx][sc_candidate]).strip()
                    if val and val != "nan" and val != '""' and val != "":
                        scenario_from_csv = val
                        break

        if not is_fraud:
            is_fraud = bool(
                sender in ring_account_map or
                receiver in ring_account_map or
                (account_hybrid_map.get(sender, {}).get("final_score", 0) >= 70) or
                (account_hybrid_map.get(receiver, {}).get("final_score", 0) >= 70)
            )

        ground_truth = "fraudulent" if is_fraud else "legitimate"
        sc_id = scenario_from_csv or (
            ring_account_map.get(sender, [None])[0] if sender in ring_account_map else (
                ring_account_map.get(receiver, [None])[0] if receiver in ring_account_map else None
            )
        )

        dataset_transactions.append({
            "transaction_id": txn_id,
            "sender_account": sender,
            "receiver_account": receiver,
            "amount": amt,
            "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
            "currency": "USD",
            "transaction_type": "TRANSFER",
            "channel": "ONLINE",
            "scenario_id": sc_id,
            "is_fraud": is_fraud,
            "synthetic_ground_truth": ground_truth,
        })

    # ---------------------------------------------------------------
    # GUARANTEED 60-SECOND RUNTIME EXPANSION
    # Required count = ceil(target_tps * 60). If the CSV has fewer
    # rows, cycle through them (with new unique IDs and evenly-spaced
    # timestamps) until the required count is reached.
    # ---------------------------------------------------------------
    effective_tps = float(target_tps or 250.0)
    required_count = max(len(dataset_transactions), int(effective_tps * 60))

    if required_count > len(dataset_transactions) and dataset_transactions:
        import math as _math
        from datetime import timedelta as _td

        base_pool = list(dataset_transactions)  # original rows to cycle
        pool_len = len(base_pool)
        sim_start = datetime.now(timezone.utc)
        # Spread timestamps evenly across 60 seconds
        interval_sec = 60.0 / required_count

        expanded: list = []
        for i in range(required_count):
            src = base_pool[i % pool_len]
            copy = dict(src)
            # Unique ID per slot
            copy["transaction_id"] = f"TXN-UP-{i+1:07d}"
            # Evenly spaced timestamp within the 60s window
            copy["timestamp"] = (sim_start + _td(seconds=i * interval_sec)).isoformat()
            expanded.append(copy)
        dataset_transactions = expanded


    # Create alerts for pre-analyzed high-risk accounts and rings
    for sa_id, sa in list(suspicious_accounts.items())[:20]:
        alert = Alert(
            organization_id=org_id,
            case_id=case.id,
            alert_type="MULE_RING_MEMBER" if sa_id in ring_account_map else "SUSPICIOUS_ACCOUNT",
            pattern_type=ring_account_map.get(sa_id, ["HYBRID_ANOMALY"])[0],
            risk_score=float(sa.get("suspicion_score", 75.0)) / 100.0,
            severity="HIGH" if sa.get("suspicion_score", 0) >= 80 else "MEDIUM",
            status="NEW",
            trigger_reason=f"Account {sa_id} flagged during dataset analysis with score {sa.get('suspicion_score', 0):.1f}",
            detection_reason={"patterns": sa.get("detected_patterns", []), "rings": sa.get("ring_ids", [])},
            related_accounts=[sa_id],
            created_by_id=current_user.id,
        )
        db.add(alert)
    db.commit()

    # Create Simulation entity in READY state and start live simulation streaming!
    sim = Simulation(
        name=sim_name,
        description=case_desc,
        mode="upload",
        detection_mode=detection_mode or "shadow",
        status="READY",
        config={
            "filename": file.filename,
            "total_transactions": len(dataset_transactions),
            "num_accounts": len(graph.nodes),
            "input_method": "file_upload",
            "target_tps": effective_tps,
            "dataset_transactions": dataset_transactions,
            "duration_seconds": 60,  # guaranteed 60-second minimum runtime
        },
        detection_config=jsonable_encoder(det_cfg),
        stats={
            "analysis_result": analysis_result,
            "total_generated": 0,
            "total_legitimate": 0,
            "total_fraudulent": 0,
            "total_volume": 0.0,
            "elapsed_seconds": 0.0,
        },
        organization_id=org_id,
        created_by_id=current_user.id,
        case_id=case.id,
    )
    db.add(sim)
    db.flush()

    db.add(SimulationEvent(
        simulation_id=sim.id,
        event_type="UPLOAD_LOADED",
        message=f"Dataset '{file.filename}' loaded ({len(dataset_transactions)} transactions across {len(graph.nodes)} accounts). Launching real-time detection stream.",
        details={"case_id": case.id, "total_transactions": len(dataset_transactions), "num_accounts": len(graph.nodes)},
    ))
    db.commit()
    db.refresh(sim)

    # Start the live simulation engine
    full_config = dict(sim.config or {})
    full_config["detection_mode"] = sim.detection_mode
    full_config["detection_config"] = sim.detection_config or {}
    full_config["organization_id"] = org_id
    full_config["created_by_id"] = current_user.id
    full_config["case_id"] = sim.case_id

    engine = await simulation_manager.get_or_create_engine(sim.id, full_config)
    await engine.start()

    sim.status = "RUNNING"
    sim.started_at = datetime.now(timezone.utc)
    db.add(sim)
    db.commit()
    db.refresh(sim)

    return sim


@router.get("/simulations/{simulation_id}/analysis", response_model=Dict[str, Any])
def get_simulation_analysis(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Retrieve full unified analysis bundle (graph elements, fraud rings, hybrid scores, temporal, risk map) for any simulation."""
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    stats = sim.stats or {}
    if "analysis_result" in stats and stats["analysis_result"]:
        return stats["analysis_result"]

    # If not cached, dynamically generate from simulation transactions
    txns = db.query(SimulationTransaction).filter(
        SimulationTransaction.simulation_id == simulation_id
    ).order_by(SimulationTransaction.timestamp.asc()).limit(5000).all()

    if not txns:
        return {
            "summary": {"total_accounts_analyzed": 0, "total_transactions": 0, "suspicious_accounts_flagged": 0, "fraud_rings_detected": 0},
            "suspicious_accounts": [],
            "fraud_rings": [],
            "hybrid_scores": [],
            "graph": {"nodes": [], "edges": [], "node_count": 0, "edge_count": 0},
            "temporal": {},
            "communities": {},
            "centrality": {},
            "ml_anomalies": {},
            "risk_propagation": {},
        }

    graph = TransactionGraph()
    for tx in txns:
        graph.add_transaction(
            sender=tx.sender_account,
            receiver=tx.receiver_account,
            amount=float(tx.amount),
            timestamp=tx.timestamp,
        )

    analysis_res = run_full_analysis(graph)

    # Cache for future calls
    updated_stats = dict(sim.stats or {})
    updated_stats["analysis_result"] = analysis_res
    sim.stats = updated_stats
    db.add(sim)
    db.commit()

    return analysis_res


@router.get("/simulations", response_model=List[SimulationResponse])
def list_simulations(
    status_filter: Optional[str] = Query(None, alias="status"),
    mode_filter: Optional[str] = Query(None, alias="mode"),
    detection_mode_filter: Optional[str] = Query(None, alias="detection_mode"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """List simulation runs for current organization with optional status and mode filtering."""
    query = db.query(Simulation).filter(Simulation.organization_id == org_id)
    if status_filter:
        query = query.filter(Simulation.status == status_filter.upper())
    if mode_filter:
        query = query.filter(Simulation.mode == mode_filter.lower())
    if detection_mode_filter:
        query = query.filter(Simulation.detection_mode == detection_mode_filter.lower())

    sims = query.order_by(desc(Simulation.created_at)).offset(offset).limit(limit).all()
    return sims


@router.get("/simulations/{simulation_id}", response_model=SimulationResponse)
def get_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Get single simulation details and current status."""
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    engine = simulation_manager.get_active_engine(simulation_id)
    if engine:
        sim.stats = engine.get_stats()
        sim.status = engine.status

    return sim


@router.get("/simulations/{simulation_id}/stats", response_model=Dict[str, Any])
def get_simulation_stats(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Retrieve current real-time stats or persisted final stats snapshot."""
    engine = simulation_manager.get_active_engine(simulation_id)
    if engine:
        return engine.get_stats()
    
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    stats = dict(sim.stats or {})
    stats["simulation_id"] = sim.id
    stats["status"] = sim.status
    if sim.status in ("COMPLETED", "STOPPED", "FAILED"):
        stats["actual_tps"] = 0.0
        stats["published_tps"] = 0.0
        stats["remaining_seconds"] = 0.0
    return stats


@router.delete("/simulations/{simulation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Delete a simulation run and its associated synthetic transactions."""
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    await simulation_manager.remove_engine(simulation_id)
    db.delete(sim)
    db.commit()


@router.post("/simulations/{simulation_id}/validate", response_model=SimulationValidationResult)
def validate_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Validate a simulation's parameters, timings, and scenario distributions."""
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    errors = []
    warnings = []
    config = sim.config or {}

    tps = float(config.get("target_tps", 50.0))
    if tps <= 0:
        errors.append("Target TPS must be greater than 0.")
    if tps > 1000:
        warnings.append("High TPS (>1000) requires high-performance server hardware.")

    legit_pct = float(config.get("legitimate_percentage", 80.0))
    fraud_pct = float(config.get("fraudulent_percentage", 20.0))
    if abs((legit_pct + fraud_pct) - 100.0) > 0.5 and config.get("traffic_composition") == "mixed":
        errors.append(f"Legitimate ({legit_pct}%) and Fraudulent ({fraud_pct}%) must sum to 100%.")

    total_txns = config.get("total_transactions", 1000)
    dur = config.get("duration_seconds")
    est_dur = dur or (total_txns / tps if tps > 0 else 0)

    est_legit = int(total_txns * (legit_pct / 100.0))
    est_fraud = total_txns - est_legit

    return SimulationValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        estimated_duration_seconds=round(est_dur, 2),
        estimated_total_transactions=total_txns,
        estimated_legitimate_count=est_legit,
        estimated_fraudulent_count=est_fraud,
    )


@router.post("/simulations/{simulation_id}/start", response_model=SimulationResponse)
async def start_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    org_id: int = Depends(get_current_workspace),
):
    """Start transaction simulation worker and detection pipeline. Admin exclusive."""
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    if sim.status == "RUNNING":
        return sim

    target_org_id = sim.organization_id or org_id
    policy = (sim.case_creation_policy or "NONE").upper()

    # Automatically create InvoSpace investigation Case only if policy is ON_SIMULATION_START
    if policy == "ON_SIMULATION_START" and not sim.case_id:
        case_title = f"LiveShield Simulation #{sim.id}: {sim.name}"
        scenarios_desc = ", ".join(sim.config.get("selected_scenarios", [])) if (sim.config and sim.config.get("selected_scenarios")) else "All active scenarios"
        case_desc = (
            sim.description
            or f"Investigation Case auto-created from LiveShield Simulation #{sim.id} ('{sim.name}'). "
               f"Mode: {sim.mode.upper()}, Detection Mode: {sim.detection_mode.upper()}, Target TPS: {sim.config.get('target_tps', 50)}."
        )
        case = Case(
            organization_id=target_org_id,
            created_by_id=current_user.id,
            title=case_title,
            description=case_desc,
            status="OPEN",
            case_origin="LIVESHIELD_SIMULATION",
            is_synthetic=True,
            simulation_id=sim.id,
            priority="HIGH" if sim.detection_mode in ("shadow", "automated") else "MEDIUM",
            tracelab_risk_score=0.75,
            investigation_risk_score=0.75,
            notes=f"Auto-generated case for LiveShield simulation #{sim.id}. Active scenarios: {scenarios_desc}.",
            linked_accounts=[],
            linked_entities=[],
            linked_rings=[],
        )
        db.add(case)
        db.flush()

        db.add(CaseEvent(
            organization_id=target_org_id,
            case_id=case.id,
            user_id=current_user.id,
            event_type="SYSTEM_ACTION",
            content=f"Case #{case.id} opened automatically from LiveShield Simulation #{sim.id} ('{sim.name}').",
        ))

        sim.case_id = case.id

        db.add(SimulationEvent(
            simulation_id=sim.id,
            event_type="CASE_LINKED",
            message=f"Simulation linked to Case #{case.id} ('{case.title}')",
            details={"case_id": case.id, "case_title": case.title},
        ))
        db.commit()
        db.refresh(sim)

    full_config = dict(sim.config or {})
    full_config["detection_mode"] = sim.detection_mode
    full_config["detection_config"] = sim.detection_config or {}
    full_config["organization_id"] = target_org_id
    full_config["created_by_id"] = current_user.id
    full_config["case_id"] = sim.case_id

    engine = await simulation_manager.get_or_create_engine(simulation_id, full_config)
    await engine.start()
    
    sim.status = "RUNNING"
    sim.started_at = datetime.now(timezone.utc)
    db.add(sim)
    db.commit()
    db.refresh(sim)
    return sim


@router.post("/simulations/{simulation_id}/convert-to-case")
def convert_simulation_to_case(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    org_id: int = Depends(get_current_workspace),
):
    """
    Explicitly convert a LiveShield simulation into an InvoSpace investigation case.
    Admin exclusive. Idempotent — can be executed while running or after completion.
    """
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    target_org_id = sim.organization_id or org_id

    if sim.case_id:
        existing_case = db.query(Case).filter(Case.id == sim.case_id).first()
        if existing_case:
            return {
                "message": "Simulation is already linked to a case",
                "case_id": existing_case.id,
                "case": {
                    "id": existing_case.id,
                    "title": existing_case.title,
                    "status": existing_case.status,
                    "case_origin": existing_case.case_origin,
                    "is_synthetic": existing_case.is_synthetic,
                }
            }

    case_title = f"LiveShield Simulation #{sim.id}: {sim.name}"
    case_desc = (
        sim.description
        or f"Forensic Investigation Case converted from LiveShield Simulation #{sim.id} ('{sim.name}'). "
           f"Mode: {sim.mode.upper()}, Detection Mode: {sim.detection_mode.upper()}."
    )
    case = Case(
        organization_id=target_org_id,
        created_by_id=current_user.id,
        title=case_title,
        description=case_desc,
        status="OPEN",
        case_origin="LIVESHIELD_SIMULATION",
        is_synthetic=True,
        simulation_id=sim.id,
        priority="HIGH" if sim.detection_mode in ("shadow", "automated") else "MEDIUM",
        tracelab_risk_score=0.75,
        investigation_risk_score=0.75,
        notes=f"Converted from LiveShield simulation #{sim.id} by {current_user.username}.",
        linked_accounts=[],
        linked_entities=[],
        linked_rings=[],
    )
    db.add(case)
    db.flush()

    db.add(CaseEvent(
        organization_id=target_org_id,
        case_id=case.id,
        user_id=current_user.id,
        event_type="SYSTEM_ACTION",
        content=f"Case #{case.id} created from LiveShield Simulation #{sim.id} conversion by {current_user.username}.",
    ))

    sim.case_id = case.id
    db.add(SimulationEvent(
        simulation_id=sim.id,
        event_type="CASE_LINKED",
        message=f"Simulation converted to Investigation Case #{case.id}",
        details={"case_id": case.id, "converted_by": current_user.username},
    ))

    db.commit()
    db.refresh(case)

    return {
        "message": f"Simulation #{sim.id} successfully converted to Investigation Case #{case.id}",
        "case_id": case.id,
        "case": {
            "id": case.id,
            "title": case.title,
            "status": case.status,
            "case_origin": case.case_origin,
            "is_synthetic": case.is_synthetic,
        }
    }


@router.post("/simulations/{simulation_id}/pause", response_model=SimulationResponse)
async def pause_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    org_id: int = Depends(get_current_workspace),
):
    """Pause generation without losing sequence state. Admin exclusive."""
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    engine = simulation_manager.get_active_engine(simulation_id)
    if engine:
        await engine.pause()
    else:
        sim.status = "PAUSED"
        db.add(sim)
        db.commit()

    db.refresh(sim)
    return sim


@router.post("/simulations/{simulation_id}/resume", response_model=SimulationResponse)
async def resume_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    org_id: int = Depends(get_current_workspace),
):
    """Resume a paused simulation. Admin exclusive."""
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    full_config = dict(sim.config or {})
    full_config["detection_mode"] = sim.detection_mode
    full_config["detection_config"] = sim.detection_config or {}
    full_config["organization_id"] = sim.organization_id or org_id
    full_config["created_by_id"] = current_user.id

    engine = await simulation_manager.get_or_create_engine(simulation_id, full_config)
    await engine.resume()

    sim.status = "RUNNING"
    db.add(sim)
    db.commit()
    db.refresh(sim)
    return sim


@router.post("/simulations/{simulation_id}/stop", response_model=SimulationResponse)
async def stop_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    org_id: int = Depends(get_current_workspace),
):
    """Cleanly stop simulation and release worker. Admin exclusive."""
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    engine = simulation_manager.get_active_engine(simulation_id)
    if engine:
        await engine.stop()
        await simulation_manager.remove_engine(simulation_id)
    else:
        sim.status = "STOPPED"
        sim.stopped_at = datetime.now(timezone.utc)
        db.add(sim)
        db.commit()

    db.refresh(sim)
    return sim


@router.post("/simulations/{simulation_id}/speed", response_model=Dict[str, Any])
async def update_simulation_speed(
    simulation_id: int,
    payload: SpeedUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Dynamically adjust the streaming rate / delay (target TPS) for a running or paused simulation."""
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    new_tps = float(payload.target_tps)
    engine = simulation_manager.get_active_engine(simulation_id)
    if engine:
        engine.set_target_tps(new_tps)

    cfg = dict(sim.config or {})
    cfg["target_tps"] = new_tps
    sim.config = cfg
    db.add(sim)
    db.commit()

    return {"simulation_id": simulation_id, "target_tps": new_tps, "status": sim.status}



@router.post("/simulations/{simulation_id}/restart", response_model=SimulationResponse)
def restart_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Clone and restart a stopped or completed simulation as a fresh new run."""
    original = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Original simulation not found")

    new_sim = Simulation(
        name=f"{original.name} (Re-run)",
        description=original.description,
        mode=original.mode,
        detection_mode=original.detection_mode,
        status="READY",
        config=original.config,
        detection_config=original.detection_config,
        stats={
            "total_generated": 0,
            "total_legitimate": 0,
            "total_fraudulent": 0,
            "total_volume": 0.0,
            "elapsed_seconds": 0.0,
        },
        organization_id=org_id,
        created_by_id=current_user.id,
    )
    db.add(new_sim)
    db.commit()
    db.refresh(new_sim)
    return new_sim


@router.get("/simulations/{simulation_id}/stats", response_model=SimulationStatsResponse)
@router.get("/simulations/{simulation_id}/statistics", response_model=SimulationStatsResponse)
def get_simulation_statistics(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Get live or historical telemetry metrics including detection & evaluation stats."""
    engine = simulation_manager.get_active_engine(simulation_id)
    if engine:
        return SimulationStatsResponse(**engine.get_stats())

    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    raw_stats = sim.stats or {}
    return SimulationStatsResponse(
        simulation_id=sim.id,
        status=sim.status,
        detection_mode=sim.detection_mode,
        configured_tps=float(sim.config.get("target_tps", 50.0)),
        actual_tps=float(raw_stats.get("actual_tps", 0.0)),
        published_tps=float(raw_stats.get("published_tps", 0.0)),
        total_generated=int(raw_stats.get("total_generated", 0)),
        total_legitimate=int(raw_stats.get("total_legitimate", 0)),
        total_fraudulent=int(raw_stats.get("total_fraudulent", 0)),
        fraud_percentage=float(raw_stats.get("fraud_percentage", 0.0)),
        total_volume=float(raw_stats.get("total_volume", 0.0)),
        elapsed_seconds=float(raw_stats.get("elapsed_seconds", 0.0)),
        remaining_seconds=raw_stats.get("remaining_seconds"),
        active_scenarios=raw_stats.get("active_scenarios", []),
        scenario_counts=raw_stats.get("scenario_counts", {}),
        queue_backlog=0,
        held_count=0,
        worker_status=sim.status,
        latency_ms=0.0,
        evaluation=raw_stats.get("evaluation"),
        graph_worker_stats=raw_stats.get("graph_worker_stats"),
    )


@router.get("/simulations/{simulation_id}/transactions", response_model=List[TransactionResponse])
def get_simulation_transactions(
    simulation_id: int,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    scenario_id: Optional[str] = Query(None),
    ground_truth: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Retrieve paginated synthetic transaction stream with filters."""
    query = db.query(SimulationTransaction).filter(SimulationTransaction.simulation_id == simulation_id)
    if scenario_id:
        query = query.filter(SimulationTransaction.scenario_id == scenario_id.upper())
    if ground_truth:
        query = query.filter(SimulationTransaction.synthetic_ground_truth == ground_truth.lower())
    if account_id:
        query = query.filter(
            (SimulationTransaction.sender_account == account_id) | (SimulationTransaction.receiver_account == account_id)
        )

    txns = query.order_by(desc(SimulationTransaction.timestamp)).offset(offset).limit(limit).all()
    return txns


# ============================================================
# PHASE 2: DETECTION, DECISIONS & EVALUATION ENDPOINTS
# ============================================================

@router.get("/simulations/{simulation_id}/decisions", response_model=List[DecisionRecordResponse])
def get_simulation_decisions(
    simulation_id: int,
    decision_filter: Optional[str] = Query(None, alias="decision"),
    risk_tier_filter: Optional[str] = Query(None, alias="risk_tier"),
    eval_filter: Optional[str] = Query(None, alias="evaluation_label"),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Retrieve paginated decision records with screening signals, risk scores, and latency metrics."""
    query = db.query(SimulationDecisionRecord).filter(SimulationDecisionRecord.simulation_id == simulation_id)
    if decision_filter:
        query = query.filter(SimulationDecisionRecord.final_decision == decision_filter.upper())
    if risk_tier_filter:
        query = query.filter(SimulationDecisionRecord.risk_tier == risk_tier_filter.upper())
    if eval_filter:
        query = query.filter(SimulationDecisionRecord.evaluation_label == eval_filter.upper())
    if search:
        s = f"%{search}%"
        query = query.filter(
            (SimulationDecisionRecord.transaction_id.ilike(s)) |
            (SimulationDecisionRecord.sender_account.ilike(s)) |
            (SimulationDecisionRecord.receiver_account.ilike(s)) |
            (SimulationDecisionRecord.scenario_id.ilike(s))
        )

    decisions = query.order_by(desc(SimulationDecisionRecord.timestamp)).offset(offset).limit(limit).all()
    return decisions


@router.get("/simulations/{simulation_id}/held", response_model=List[Dict[str, Any]])
def get_held_transactions(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Get active transactions currently in the HeldTransactionQueue or unreviewed held decisions from DB."""
    engine = simulation_manager.get_active_engine(simulation_id)
    if engine:
        held_items = engine.decision_engine.held_queue.get_all(simulation_id)
        if held_items:
            return held_items

    # Fallback to DB records for historical/completed simulations
    held_records = db.query(SimulationDecisionRecord).filter(
        SimulationDecisionRecord.simulation_id == simulation_id,
        SimulationDecisionRecord.final_decision == "HOLD",
        SimulationDecisionRecord.operator_action.is_(None),
    ).order_by(desc(SimulationDecisionRecord.id)).limit(200).all()

    return [
        {
            "simulation_id": r.simulation_id,
            "transaction_id": r.transaction_id,
            "sequence_id": r.sequence_id,
            "step_index": r.step_index,
            "sender_account": r.sender_account,
            "receiver_account": r.receiver_account,
            "amount": float(r.amount),
            "detection_mode": r.detection_mode,
            "initial_decision": r.initial_decision,
            "final_decision": r.final_decision,
            "decision_reason": r.decision_reason,
            "combined_risk_score": r.combined_risk_score,
            "risk_tier": r.risk_tier,
            "fast_screening_signals": r.fast_screening_signals or [],
            "dclcg_score": r.dclcg_score,
            "scenario_id": r.scenario_id,
            "synthetic_ground_truth": r.synthetic_ground_truth,
            "t_decided": r.t_decided.isoformat() if r.t_decided else None,
            "held_at": r.t_decided.isoformat() if r.t_decided else None,
        }
        for r in held_records
    ]


@router.post("/simulations/{simulation_id}/decisions/{transaction_id}/override", response_model=Dict[str, Any])
def override_held_decision(
    simulation_id: int,
    transaction_id: str,
    payload: DecisionOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Manually approve or reject a held transaction in Assisted Mode."""
    engine = simulation_manager.get_active_engine(simulation_id)
    resolved = None
    if engine:
        resolved = engine.decision_engine.held_queue.resolve(
            transaction_id=transaction_id,
            action=payload.action,
            operator_user_id=current_user.id,
            notes=payload.notes,
        )

    # Persist the manual override to DB record
    record = db.query(SimulationDecisionRecord).filter(
        SimulationDecisionRecord.simulation_id == simulation_id,
        SimulationDecisionRecord.transaction_id == transaction_id,
    ).first()
    
    if not record and not resolved:
        raise HTTPException(status_code=404, detail="Transaction not found in held queue or database records.")
    
    if record:
        new_decision = "APPROVE" if payload.action == "MANUAL_APPROVE" else "REJECT"
        record.final_decision = resolved["final_decision"] if resolved else new_decision
        record.operator_action = payload.action
        record.operator_notes = payload.notes
        record.operator_user_id = current_user.id
        record.operator_at = datetime.now(timezone.utc)
        db.add(record)
        db.commit()
        db.refresh(record)
        return {
            "simulation_id": record.simulation_id,
            "transaction_id": record.transaction_id,
            "final_decision": record.final_decision,
            "operator_action": record.operator_action,
            "operator_notes": record.operator_notes,
            "operator_user_id": record.operator_user_id,
            "operator_at": record.operator_at.isoformat() if record.operator_at else None,
        }

    return resolved


@router.get("/simulations/{simulation_id}/evaluation", response_model=EvaluationSummaryResponse)
def get_simulation_evaluation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
    org_id: int = Depends(get_current_workspace),
):
    """Retrieve full dual evaluation metrics (Transaction vs Network level, confusion matrix, latencies)."""
    engine = simulation_manager.get_active_engine(simulation_id)
    if engine:
        summary = engine.evaluator.get_summary()
        return EvaluationSummaryResponse(**summary)

    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    stats = sim.stats or {}
    eval_dict = stats.get("evaluation")
    if not eval_dict:
        # Default empty summary
        return EvaluationSummaryResponse(
            simulation_id=simulation_id,
            total_transactions=0,
            total_legitimate=0,
            total_fraudulent=0,
            approved_count=0,
            flagged_count=0,
            held_count=0,
            rejected_count=0,
            true_positives=0,
            true_negatives=0,
            false_positives=0,
            false_negatives=0,
            precision=0.0,
            recall=0.0,
            f1_score=0.0,
            accuracy=0.0,
            false_positive_rate=0.0,
            false_negative_rate=0.0,
            total_sequences=0,
            network_true_positives=0,
            network_false_positives=0,
            network_false_negatives=0,
            network_precision=0.0,
            network_recall=0.0,
            network_f1=0.0,
            latency_screening_p50=0.0,
            latency_screening_p95=0.0,
            latency_screening_p99=0.0,
            latency_model_p50=0.0,
            latency_model_p95=0.0,
            latency_model_p99=0.0,
            latency_total_p50=0.0,
            latency_total_p95=0.0,
            latency_total_p99=0.0,
            scenario_metrics={},
        )
    return EvaluationSummaryResponse(**eval_dict)


@router.get("/model-status", response_model=ModelStatusResponse)
def get_model_status(current_user: User = Depends(require_internal_user)):
    """Inspect DC-LCG model artifact loading status, device, and metadata."""
    from services.liveshield.graph_worker import RollingGraphInferenceWorker, AccountRiskCache
    dummy_worker = RollingGraphInferenceWorker(risk_cache=AccountRiskCache())
    stats = dummy_worker.get_graph_stats()
    return ModelStatusResponse(
        model_loaded=stats.get("model_loaded", False),
        model_version=stats.get("model_version", "dclcg_prod_e2e_v1"),
        device=stats.get("device", "cpu"),
        model_path="models_artifacts/dclcg_prod_e2e.pt",
        weights_shape={"input_dim": 16, "hidden_dim": 64, "output_dim": 2},
        graph_stats=stats,
    )


# ============================================================
# WEBSOCKET REAL-TIME STREAM
# ============================================================

@router.websocket("/simulations/{simulation_id}/ws")
async def simulation_websocket_endpoint(websocket: WebSocket, simulation_id: int):
    """WebSocket connection for real-time live events, transactions, and decision streaming."""
    await websocket.accept()
    simulation_manager.register_websocket(simulation_id, websocket)
    logger.info("WebSocket client connected to simulation %d", simulation_id)

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected from simulation %d", simulation_id)
    except Exception as e:
        logger.warning("WebSocket error for simulation %d: %s", simulation_id, e)
    finally:
        simulation_manager.unregister_websocket(simulation_id, websocket)


# ============================================================
# PHASE 2.5: CONTINUOUS RISK RE-EVALUATION ENDPOINTS
# ============================================================

@router.get("/simulations/{simulation_id}/risk-timeline/{transaction_id}", response_model=List[RiskAssessmentResponse])
def get_transaction_risk_timeline(
    simulation_id: int,
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
):
    """Retrieve the full versioned assessment history timeline for a specific transaction."""
    records = (
        db.query(TransactionRiskAssessment)
        .filter(
            TransactionRiskAssessment.simulation_id == simulation_id,
            TransactionRiskAssessment.transaction_id == transaction_id,
        )
        .order_by(TransactionRiskAssessment.assessment_version.asc())
        .all()
    )
    return records


@router.get("/simulations/{simulation_id}/retrospective-alerts", response_model=List[RetrospectiveAlertResponse])
def get_retrospective_alerts(
    simulation_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
):
    """Retrieve historical transactions that were initially approved/low-risk but subsequently escalated."""
    # Query current assessments with HIGH_RISK or SUSPICIOUS that have version > 1 and initial payment APPROVE
    records = (
        db.query(TransactionRiskAssessment)
        .filter(
            TransactionRiskAssessment.simulation_id == simulation_id,
            TransactionRiskAssessment.is_current == True,
            TransactionRiskAssessment.assessment_version > 1,
            TransactionRiskAssessment.current_risk_status.in_(["HIGH_RISK", "SUSPICIOUS"]),
            TransactionRiskAssessment.payment_status == "APPROVED",
        )
        .order_by(desc(TransactionRiskAssessment.assessment_timestamp))
        .limit(limit)
        .all()
    )

    results = []
    for r in records:
        # Fetch sender/receiver from transaction record or decision record
        txn = db.query(SimulationTransaction).filter(
            SimulationTransaction.simulation_id == simulation_id,
            SimulationTransaction.transaction_id == r.transaction_id,
        ).first()
        results.append(
            RetrospectiveAlertResponse(
                transaction_id=r.transaction_id,
                simulation_id=r.simulation_id,
                sender_account=txn.sender_account if txn else "UNKNOWN",
                receiver_account=txn.receiver_account if txn else "UNKNOWN",
                amount=float(txn.amount) if txn else 0.0,
                initial_decision=r.payment_status,
                initial_risk_score=float(r.previous_risk_score or 0.0),
                current_risk_status=r.current_risk_status,
                current_risk_score=float(r.current_risk_score),
                escalated_at=r.assessment_timestamp,
                escalation_reason=r.assessment_reason or "Escalated after subsequent graph analysis",
                assessment_version=r.assessment_version,
                synthetic_ground_truth=r.synthetic_ground_truth,
            )
        )
    return results


@router.get("/simulations/{simulation_id}/cleared-transactions", response_model=List[ClearedTransactionResponse])
def get_cleared_transactions(
    simulation_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_internal_user),
):
    """Retrieve transactions that were initially flagged but subsequently cleared / de-escalated."""
    records = (
        db.query(TransactionRiskAssessment)
        .filter(
            TransactionRiskAssessment.simulation_id == simulation_id,
            TransactionRiskAssessment.is_current == True,
            TransactionRiskAssessment.assessment_version > 1,
            TransactionRiskAssessment.current_risk_status.in_(["CLEARED", "LOW_RISK"]),
            TransactionRiskAssessment.previous_risk_status.in_(["HIGH_RISK", "SUSPICIOUS", "UNDER_REVIEW", "UNDER_OBSERVATION"]),
        )
        .order_by(desc(TransactionRiskAssessment.assessment_timestamp))
        .limit(limit)
        .all()
    )

    results = []
    for r in records:
        txn = db.query(SimulationTransaction).filter(
            SimulationTransaction.simulation_id == simulation_id,
            SimulationTransaction.transaction_id == r.transaction_id,
        ).first()
        is_verified = (r.assessment_type == "INVESTIGATION_OVERRIDE" or r.current_risk_status == "CLEARED")
        results.append(
            ClearedTransactionResponse(
                transaction_id=r.transaction_id,
                simulation_id=r.simulation_id,
                sender_account=txn.sender_account if txn else "UNKNOWN",
                receiver_account=txn.receiver_account if txn else "UNKNOWN",
                amount=float(txn.amount) if txn else 0.0,
                initial_decision=r.payment_status,
                initial_risk_status=r.previous_risk_status or "SUSPICIOUS",
                initial_risk_score=float(r.previous_risk_score or 0.5),
                current_risk_status=r.current_risk_status,
                current_risk_score=float(r.current_risk_score),
                cleared_at=r.assessment_timestamp,
                clearance_reason=r.assessment_reason or "Cleared following evidence assessment",
                is_investigator_verified=is_verified,
                assessment_version=r.assessment_version,
                synthetic_ground_truth=r.synthetic_ground_truth,
            )
        )
    return results


@router.post("/simulations/{simulation_id}/manual-reassessment")
async def trigger_manual_reassessment(
    simulation_id: int,
    body: ManualReassessmentRequest,
    current_user: User = Depends(require_internal_user),
):
    """Trigger an authorized investigator override or manual reassessment."""
    engine = simulation_manager.get_active_engine(simulation_id)
    if not engine or not hasattr(engine, "reevaluation_engine"):
        raise HTTPException(status_code=400, detail="Simulation engine is not running or does not support CRRE")

    target_acc = body.account_id
    if not target_acc and body.transaction_id:
        meta = engine.affected_index.get_transaction(body.transaction_id)
        if meta:
            target_acc = meta.get("sender_account")

    if not target_acc:
        raise HTTPException(status_code=400, detail="Must provide valid account_id or transaction_id")

    await engine.reevaluation_engine.trigger_investigation_evidence(
        account_id=target_acc,
        evidence_type=body.evidence_type,
        verified_clean=body.verified_clean,
        notes=body.notes,
        investigator_id=current_user.id,
    )

    return {
        "status": "QUEUED",
        "message": f"Manual reassessment enqueued for account {target_acc} with verified_clean={body.verified_clean}",
    }


@router.get("/simulations/{simulation_id}/reevaluation-stats", response_model=ReevaluationStatsResponse)
def get_reevaluation_stats(
    simulation_id: int,
    current_user: User = Depends(require_internal_user),
):
    """Retrieve telemetry metrics for Continuous Risk Re-evaluation Engine."""
    engine = simulation_manager.get_active_engine(simulation_id)
    if engine and hasattr(engine, "reevaluation_engine"):
        stats = engine.reevaluation_engine.get_telemetry()
        return ReevaluationStatsResponse(simulation_id=simulation_id, **stats)

    return ReevaluationStatsResponse(
        simulation_id=simulation_id,
        total_events_processed=0,
        total_reassessments=0,
        total_escalations=0,
        total_deescalations=0,
        total_retrospective_alerts=0,
        total_cleared=0,
        total_duplicates_prevented=0,
        queue_backlog=0,
        avg_latency_ms=0.0,
        last_latency_ms=0.0,
        is_running=False,
    )

