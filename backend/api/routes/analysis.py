"""
analysis.py — /analyze and /analyze/advanced API routes.

Extends the existing /analyze endpoint (kept in main.py for
backward compat) with a richer advanced analysis route that
runs all new detectors and returns a full hybrid risk breakdown.
"""
from fastapi import APIRouter, Depends, UploadFile, File, Request, HTTPException, Form
from sqlalchemy.orm import Session
from typing import Optional
import json
import os
import time

from api.deps import get_current_user, get_current_workspace, RoleChecker
from db.database import get_db
from models.user import User
from models.role import Role
from models.alert import Alert
from models.analysis_job import AnalysisJob
from models.service_request import ServiceRequest
from utils.csv_parser import parse_csv
from services.audit_service import log_event, EventType, EventAction, EventStatus

# Existing detectors
from detectors.cycle   import find_cycles
from detectors.fan     import detect_fan_patterns
from detectors.layering import find_layered_shells
from detectors.burst   import detect_burst_activity
from detectors.score   import compute_scores_and_rings

# New detectors
from detectors.centrality      import compute_centrality
from detectors.community       import detect_communities
from detectors.components      import detect_components
from detectors.kcore           import detect_kcore
from detectors.bridges         import detect_bridges
from detectors.temporal        import detect_temporal_patterns
from detectors.velocity        import compute_velocity
from detectors.amount_patterns import detect_amount_patterns
from detectors.repeat          import detect_repeat_pairs
from detectors.motifs          import detect_motifs
from detectors.account_profile import build_account_profiles
from detectors.ml_anomaly      import detect_ml_anomalies
from detectors.hybrid_engine   import compute_hybrid_scores
from detectors.risk_propagation import propagate_risk

# DC-LCG dual-view GNN (basepaper integration)
from detectors.dclcg import get_latest_artifact, load_artifact, predict_graph


router = APIRouter(prefix="/analyze", tags=["analysis"])

RISK_LEVEL_BANDS = [(40, "LOW"), (70, "MEDIUM"), (90, "HIGH"), (101, "CRITICAL")]


def _risk_level_for(score: float) -> str:
    for ceiling, level in RISK_LEVEL_BANDS:
        if score < ceiling:
            return level
    return "CRITICAL"


def _auto_store_technical_report(
    *, db, org_id, analyst, service_request, job, filename,
    result, hybrid_scores, alert_ids,
):
    """
    Create or refresh the DRAFT TechnicalReport linked to a service
    request with the latest analysis output. Reports that already left
    DRAFT (submitted/approved) are never mutated — a new versioned
    draft is created instead.
    """
    from models.technical_report import TechnicalReport

    latest = (
        db.query(TechnicalReport)
        .filter(
            TechnicalReport.service_request_id == service_request.id,
            TechnicalReport.organization_id == org_id,
        )
        .order_by(TechnicalReport.created_at.desc())
        .first()
    )

    summary = result.get("summary", {})
    dclcg_block = result.get("dclcg") or {}
    fraud_rings = result.get("fraud_rings", []) or []
    suspicious = result.get("suspicious_accounts", []) or []

    top_sorted = sorted(
        hybrid_scores,
        key=lambda e: float(e.get("final_score", 0.0)),
        reverse=True,
    )
    top10 = top_sorted[:10]
    peak_score = (
        float(top_sorted[0].get("final_score", 0.0)) if top_sorted else 0.0
    )

    detector_counts = summary.get("detector_counts", {})

    dataset_summary = {
        "filename": filename,
        "job_id": job.id,
        "total_accounts": job.total_accounts,
        "total_transactions": job.total_transactions,
        "processing_time_seconds": round(job.processing_time_seconds or 0, 2),
        "analyzed_by": analyst.username,
    }
    transaction_analysis = {
        **summary,
        "auto_generated": True,
        "generated_from_job": job.id,
    }
    pattern_findings = {
        "detector_counts": detector_counts,
        "suspicious_count": len(suspicious),
        "dclcg": {
            "available": dclcg_block.get("available", False),
            "model": dclcg_block.get("model"),
            "flagged_count": dclcg_block.get("flagged_count", 0),
            "top_accounts": (dclcg_block.get("top_accounts") or [])[:5],
        },
    }
    graph_findings = {
        "fraud_ring_count": len(fraud_rings),
        "rings_sample": [
            {
                "ring_id": r.get("ring_id") or r.get("id"),
                "members": (r.get("accounts") or r.get("members") or r.get("path")
                            or [])[:12],
            }
            for r in fraud_rings[:10]
        ],
    }
    behaviour_findings = {
        "fan_in_flagged": detector_counts.get("fan_in", 0),
        "burst_accounts": [
            a.get("account_id") for a in (result.get("burst_accounts") or [])[:10]
        ]
        if isinstance(result.get("burst_accounts"), list) else None,
    }
    temporal_findings = result.get("temporal_patterns") or {}
    ml_findings = {
        "ml_flagged": detector_counts.get("ml_flagged", 0),
        "dclcg_dimension_used": bool(dclcg_block.get("available")),
        "dclcg_model": dclcg_block.get("model"),
    }
    risk_factors = [
        {
            "account_id": e.get("account_id"),
            "final_score": e.get("final_score"),
            "risk_tier": e.get("risk_tier"),
            "patterns": e.get("patterns", []),
        }
        for e in top10
    ]

    conclusion = (
        f"Auto-generated from analysis job #{job.id} on '{filename}'. "
        f"{len(suspicious)} suspicious account(s), {len(fraud_rings)} "
        f"fraud ring(s); peak hybrid risk {peak_score:.1f}/100"
    )
    if dclcg_block.get("available"):
        conclusion += (
            f"; DC-LCG model '{dclcg_block.get('model')}' flagged "
            f"{dclcg_block.get('flagged_count', 0)} account(s)."
        )
    else:
        conclusion += "; DC-LCG dimension not active for this run."

    if latest is not None and latest.status == "DRAFT":
        report = latest
    else:
        report = TechnicalReport(
            organization_id=org_id,
            service_request_id=service_request.id,
            analyst_id=analyst.id,
            version=(latest.version + 1) if latest else 1,
        )

    report.analysis_job_id = job.id
    report.title = report.title or f"Technical Analysis — {service_request.title}"
    report.dataset_summary = dataset_summary
    report.transaction_analysis = transaction_analysis
    report.pattern_findings = pattern_findings
    report.graph_findings = graph_findings
    report.behaviour_findings = behaviour_findings
    report.temporal_findings = temporal_findings
    report.ml_findings = ml_findings
    report.risk_score = round(peak_score, 2)
    report.risk_level = _risk_level_for(peak_score)
    report.risk_factors = risk_factors
    report.alert_ids = alert_ids
    report.conclusion = conclusion

    db.add(report)
    db.commit()

# Cap on the serialized analysis result stored with a job.
# Larger results are summarized instead of persisted whole.
MAX_STORED_RESULT_BYTES = 4 * 1024 * 1024


@router.post("/advanced")
async def analyze_advanced(
    request: Request,
    file: UploadFile = File(...),
    service_request_id: Optional[int] = Form(None),
    use_dclcg: bool = Form(True),
    current_user: User = Depends(RoleChecker([Role.TRACE_LAB_ANALYST.value, Role.INVESTIGATOR.value, Role.ADMIN.value])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Full advanced analysis — runs all detectors and returns
    hybrid risk scores, community data, centrality, and ML signals.

    Optionally pass `service_request_id` to tie this analysis run
    to an assigned service request. The full result is persisted
    with the AnalysisJob so it can be re-opened later.
    """
    start_time = time.time()

    # Validate file type
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    # --------------------------------------------------------
    # OPTIONAL LINK TO AN ASSIGNED SERVICE REQUEST
    #
    # This is how admin-assigned data becomes analyzable work:
    # the analyst/invospace user runs the assigned dataset and
    # the resulting job is stored against that request.
    # --------------------------------------------------------

    service_request = None

    if service_request_id is not None:
        service_request = (
            db.query(ServiceRequest)
            .filter(ServiceRequest.id == service_request_id)
            .first()
        )

        if not service_request:
            raise HTTPException(
                status_code=404,
                detail="Service request not found.",
            )

        is_assignee = current_user.id in (
            service_request.assigned_to_id,
            service_request.assigned_analyst_id,
            service_request.assigned_invospace_id,
        )
        same_org = service_request.organization_id == org_id

        if not same_org and not is_assignee and current_user.role != Role.ADMIN.value:
            raise HTTPException(
                status_code=403,
                detail="This request is not assigned to you.",
            )

    log_event(
        db=db, event_type=EventType.ANALYZE,
        event_action=EventAction.ANALYZE_START,
        event_status=EventStatus.SUCCESS,
        user_id=current_user.id, username=current_user.username,
        request=request,
        details={"filename": file.filename, "mode": "advanced"},
    )

    try:
        contents = await file.read()
        graph = parse_csv(contents.decode("utf-8"))

        # ── Existing detectors (preserved) ────────────────────
        cycle_rings   = find_cycles(graph, max_length=4, max_cycles=200)
        fan_rings     = detect_fan_patterns(graph, threshold=3, time_window_hours=72)
        shell_rings   = find_layered_shells(graph, min_chain_length=3, max_degree=3)
        burst_accounts= detect_burst_activity(graph, dormant_days=180, burst_threshold=10, burst_window_hours=72)
        suspicious_accounts, fraud_rings = compute_scores_and_rings(
            cycle_rings=cycle_rings, fan_rings=fan_rings,
            shell_rings=shell_rings, burst_accounts=burst_accounts,
        )

        # Build base scores dict for hybrid engine
        base_scores = {a["account_id"]: a["suspicion_score"] for a in suspicious_accounts}

        # ── New detectors ──────────────────────────────────────
        centrality      = compute_centrality(graph)
        community       = detect_communities(graph)
        components      = detect_components(graph)
        kcore           = detect_kcore(graph, min_k=2)
        bridges         = detect_bridges(graph)
        temporal        = detect_temporal_patterns(graph)
        velocity        = compute_velocity(graph)
        amount_pats     = detect_amount_patterns(graph)
        repeat_pairs    = detect_repeat_pairs(graph)
        motifs          = detect_motifs(graph)
        profiles        = build_account_profiles(graph)
        ml              = detect_ml_anomalies(graph)
        propagation     = propagate_risk(graph, base_scores)

        # ── DC-LCG dual-view GNN dimension (basepaper) ──────────
        # Runs whenever a trained artifact exists in the registry and
        # the caller did not opt out. Failure is non-fatal: analysis
        # degrades gracefully to the 5-dimension hybrid.
        dclcg_block: dict = {"available": False}
        dclcg_scores: Optional[dict] = None
        if use_dclcg:
            try:
                artifact_path = get_latest_artifact()
                if artifact_path:
                    bundle = load_artifact(artifact_path)
                    dclcg_out = predict_graph(graph, bundle)
                    dclcg_scores = dclcg_out["probs"]
                    flagged = {
                        a: p for a, p in dclcg_scores.items() if p >= 0.5
                    }
                    top = sorted(
                        dclcg_scores.items(), key=lambda kv: kv[1], reverse=True
                    )[:20]
                    model_name = os.path.basename(artifact_path)[len("dclcg_"):-3]
                    dclcg_block = {
                        "available": True,
                        "model": model_name,
                        "n_scored": len(dclcg_scores),
                        "flagged_count": len(flagged),
                        "top_accounts": [
                            {
                                "account_id": a,
                                "illicit_prob": p,
                                "disguise_score": dclcg_out["disguise"].get(a, 0.0),
                                "top_paths": dclcg_out["top_paths"].get(a, []),
                            }
                            for a, p in top
                        ],
                    }
            except Exception as dclcg_err:  # noqa: BLE001
                dclcg_block = {"available": False, "error": str(dclcg_err)[:200]}

        # ── Hybrid scoring ─────────────────────────────────────
        hybrid_scores = compute_hybrid_scores(
            graph_scores=base_scores,
            profile_result=profiles,
            temporal_result=temporal,
            community_result=community,
            ml_result=ml,
            all_accounts=list(graph.nodes),
            dclcg_scores=dclcg_scores,
        )

        processing_time = round(time.time() - start_time, 3)
        duration_ms     = int((time.time() - start_time) * 1000)

        result = {
            "summary": {
                "total_accounts_analyzed":  len(graph.nodes),
                "total_transactions":       len(graph.transactions),
                "suspicious_accounts_flagged": len(suspicious_accounts),
                "fraud_rings_detected":     len(fraud_rings),
                "processing_time_seconds":  processing_time,
                "detector_counts": {
                    "cycles":     len(cycle_rings),
                    "fans":       len(fan_rings),
                    "shells":     len(shell_rings),
                    "bursts":     len(burst_accounts),
                    "triangles":  motifs["summary"]["triangles"],
                    "stars":      motifs["summary"]["stars"],
                    "chains":     motifs["summary"]["chains"],
                    "diamonds":   motifs["summary"]["diamonds"],
                    "scc":        components["summary"].get("total_scc", 0),
                    "bridges":    bridges["summary"].get("total_bridge_edges", 0),
                    "night_actors": temporal["summary"]["night_actor_count"],
                    "rapid_movers": temporal["summary"]["rapid_mover_count"],
                    "ml_flagged":   ml["summary"].get("total_ml_flagged", 0),
                    "dclcg_flagged": dclcg_block.get("flagged_count", 0)
                    if dclcg_block.get("available") else 0,
                },
            },
            # Existing fields (backward compatible)
            "suspicious_accounts":  suspicious_accounts,
            "fraud_rings":          fraud_rings,
            # New fields
            "hybrid_scores":        hybrid_scores[:100],   # top 100
            "centrality":           dict(list(centrality.items())[:50]),
            "communities":          community,
            "components":           components,
            "kcore":                kcore,
            "bridges":              bridges,
            "temporal":             temporal,
            "velocity":             velocity,
            "amount_patterns":      amount_pats,
            "repeat_pairs":         repeat_pairs,
            "motifs":               motifs,
            "account_profiles":     profiles["profiles"][:100],
            "ml_anomalies":         {
                "available":         ml["available"],
                "isolation_forest":  ml["isolation_forest"][:20],
                "lof":               ml["lof"][:20],
                "dbscan_noise":      ml["dbscan_noise"][:20],
                "summary":           ml["summary"],
            },
            "risk_propagation": {
                "summary": propagation["summary"],
                "top_propagated": sorted(
                    [{"account_id": k, "score": v}
                     for k, v in propagation["propagated_scores"].items()],
                    key=lambda x: x["score"], reverse=True
                )[:50],
            },
            "dclcg": dclcg_block,
        }

        # --------------------------------------------------------
        # PERSIST THE ANALYSIS
        #
        # The job row stores the summary plus (up to a size cap)
        # the FULL result JSON under meta["_result"], so analyses
        # survive browser sessions and can be re-opened later.
        # --------------------------------------------------------

        job_meta = dict(result["summary"]["detector_counts"])

        if service_request_id is not None:
            job_meta["service_request_id"] = service_request_id

        try:
            serialized = json.dumps(result)
            if len(serialized) <= MAX_STORED_RESULT_BYTES:
                job_meta["_result"] = result
                job_meta["result_stored"] = True
            else:
                job_meta["result_stored"] = False
        except (TypeError, ValueError):
            job_meta["result_stored"] = False

        job = AnalysisJob(
            organization_id=org_id,
            user_id=current_user.id,
            filename=file.filename,
            status="completed",
            total_accounts=len(graph.nodes),
            total_transactions=len(graph.transactions),
            suspicious_accounts=len(suspicious_accounts),
            fraud_rings=len(fraud_rings),
            processing_time_seconds=processing_time,
            meta=job_meta,
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        # Link the service request to this analysis job so the
        # assignment trail shows what was produced from it.
        if service_request is not None:
            from models.activity_timeline import ActivityTimeline
            from models.workflow_instance import WorkflowInstance

            workflow = (
                db.query(WorkflowInstance)
                .filter(
                    WorkflowInstance.service_request_id == service_request.id,
                    WorkflowInstance.organization_id == org_id,
                )
                .order_by(WorkflowInstance.created_at.desc())
                .first()
            )

            if workflow is not None:
                db.add(ActivityTimeline(
                    organization_id=org_id,
                    workflow_instance_id=workflow.id,
                    actor_id=current_user.id,
                    action="ANALYSIS_COMPLETED",
                    from_status=workflow.current_status,
                    to_status=workflow.current_status,
                    details=(
                        f"Analysis '{file.filename}' completed by "
                        f"{current_user.username} (job #{job.id}): "
                        f"{len(suspicious_accounts)} suspicious accounts, "
                        f"{len(fraud_rings)} fraud rings."
                    ),
                ))
                db.commit()

        response = dict(result)
        response["job_id"] = job.id
        if service_request_id is not None:
            response["service_request_id"] = service_request_id

        # ── Auto-generate Alerts ───────────────────────────────
        # NOTE: compute_hybrid_scores() emits "final_score";
        # older revisions used "score". Accept both defensively.
        alerts_created = 0
        new_alert_ids: list = []
        for entry in hybrid_scores:
            score = float(
                entry.get("final_score", entry.get("score", 0.0))
            )
            if score >= 70.0:
                alert = Alert(
                    organization_id=org_id,
                    analysis_job_id=job.id,
                    alert_type="HIGH_RISK_ACCOUNT",
                    risk_score=score,
                    severity="CRITICAL" if score >= 90 else "HIGH",
                    status="NEW",
                    detection_reason={
                        "reason": "Hybrid score exceeded threshold",
                        "details": entry,
                    },
                    related_accounts=[entry["account_id"]],
                )
                db.add(alert)
                db.flush()
                new_alert_ids.append(alert.id)
                alerts_created += 1
        if alerts_created > 0:
            db.commit()

        # ── Auto-store results into the Technical Report ───────
        # Every completed SR-linked analysis refreshes the linked
        # DRAFT technical report so findings are never lost between
        # analysis and report writing.
        if service_request is not None:
            try:
                _auto_store_technical_report(
                    db=db, org_id=org_id, analyst=current_user,
                    service_request=service_request, job=job,
                    filename=file.filename, result=result,
                    hybrid_scores=hybrid_scores,
                    alert_ids=new_alert_ids,
                )
            except Exception as store_err:  # noqa: BLE001
                db.rollback()
                result.setdefault("warnings", []).append(
                    f"technical-report auto-store failed: {store_err}"
                )

        log_event(
            db=db, event_type=EventType.ANALYZE,
            event_action=EventAction.ANALYZE_SUCCESS,
            event_status=EventStatus.SUCCESS,
            user_id=current_user.id, username=current_user.username,
            request=request,
            details={
                "filename": file.filename, "mode": "advanced",
                "nodes": len(graph.nodes), "job_id": job.id,
            },
            duration_ms=duration_ms,
        )

        return response

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        log_event(
            db=db, event_type=EventType.ANALYZE,
            event_action=EventAction.ANALYZE_FAILED,
            event_status=EventStatus.ERROR,
            user_id=current_user.id, username=current_user.username,
            request=request, details={"filename": file.filename},
            error_message=str(e), duration_ms=duration_ms,
        )

        # Persist failed job
        job = AnalysisJob(
            organization_id=org_id,
            user_id=current_user.id, filename=file.filename,
            status="failed", error_message=str(e)[:500],
        )
        db.add(job); db.commit()

        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs")
def list_analysis_jobs(
    limit: int = 20,
    current_user: User = Depends(RoleChecker([
        Role.TRACE_LAB_ANALYST.value, Role.INVESTIGATOR.value, Role.ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """List recent analysis jobs for the current organization."""
    jobs = (
        db.query(AnalysisJob)
        .filter(AnalysisJob.organization_id == org_id)
        .order_by(AnalysisJob.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id":                      j.id,
            "filename":                j.filename,
            "status":                  j.status,
            "total_accounts":          j.total_accounts,
            "total_transactions":      j.total_transactions,
            "suspicious_accounts":     j.suspicious_accounts,
            "fraud_rings":             j.fraud_rings,
            "processing_time_seconds": j.processing_time_seconds,
            "service_request_id":      (j.meta.get("service_request_id") if isinstance(j.meta, dict) else None),
            "result_stored":           bool(j.meta.get("result_stored")) if isinstance(j.meta, dict) else False,
            "error_message":           j.error_message,
            "created_at":              j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]


@router.get("/jobs/{job_id}/result")
def get_analysis_job_result(
    job_id: int,
    current_user: User = Depends(RoleChecker([
        Role.TRACE_LAB_ANALYST.value, Role.INVESTIGATOR.value, Role.ADMIN.value
    ])),
    org_id: int = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """
    Re-open a stored analysis result.

    This is what makes analysis work durable: results are no longer
    lost when the browser session ends — the analyst/invospace user
    can reload any previously run analysis of assigned data.
    """
    job = (
        db.query(AnalysisJob)
        .filter(
            AnalysisJob.id == job_id,
            AnalysisJob.organization_id == org_id,
        )
        .first()
    )

    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")

    meta = job.meta if isinstance(job.meta, dict) else {}

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Analysis job did not complete ({job.status}): {job.error_message or 'unknown error'}",
        )

    stored_result = meta.get("_result")

    if not isinstance(stored_result, dict):
        raise HTTPException(
            status_code=404,
            detail=(
                "Full result was not stored for this job "
                "(result too large or produced by an older version)."
            ),
        )

    response = dict(stored_result)
    response["job_id"] = job.id

    service_request_id = meta.get("service_request_id")
    if service_request_id is not None:
        response["service_request_id"] = service_request_id

    return response
