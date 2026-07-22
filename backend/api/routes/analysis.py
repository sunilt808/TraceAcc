"""
analysis.py — /analyze and /analyze/advanced API routes.

Extends the existing /analyze endpoint (kept in main.py for
backward compat) with a richer advanced analysis route that
runs all new detectors and returns a full hybrid risk breakdown.
"""
from fastapi import APIRouter, Depends, UploadFile, File, Request, HTTPException
from sqlalchemy.orm import Session
import time

from api.deps import get_current_user
from db.database import get_db
from models.user import User
from models.analysis_job import AnalysisJob
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


router = APIRouter(prefix="/analyze", tags=["analysis"])


@router.post("/advanced")
async def analyze_advanced(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Full advanced analysis — runs all detectors and returns
    hybrid risk scores, community data, centrality, and ML signals.
    """
    start_time = time.time()

    # Validate file type
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

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

        # ── Hybrid scoring ─────────────────────────────────────
        hybrid_scores = compute_hybrid_scores(
            graph_scores=base_scores,
            profile_result=profiles,
            temporal_result=temporal,
            community_result=community,
            ml_result=ml,
            all_accounts=list(graph.nodes),
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
        }

        # ── Persist job record ─────────────────────────────────
        job = AnalysisJob(
            user_id=current_user.id,
            filename=file.filename,
            status="completed",
            total_accounts=len(graph.nodes),
            total_transactions=len(graph.transactions),
            suspicious_accounts=len(suspicious_accounts),
            fraud_rings=len(fraud_rings),
            processing_time_seconds=processing_time,
            meta=result["summary"]["detector_counts"],
        )
        db.add(job)
        db.commit()

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

        return result

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
            user_id=current_user.id, filename=file.filename,
            status="failed", error_message=str(e)[:500],
        )
        db.add(job); db.commit()

        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs")
def list_analysis_jobs(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List recent analysis jobs for the current user."""
    jobs = (
        db.query(AnalysisJob)
        .filter(AnalysisJob.user_id == current_user.id)
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
            "created_at":              j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]
