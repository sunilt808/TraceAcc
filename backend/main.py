from fastapi import Depends, FastAPI, Request, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import time
import asyncio
import logging
from typing import Dict

logger = logging.getLogger("trackacc")

# Maximum allowed CSV upload size: 500 MB
MAX_UPLOAD_BYTES = 500 * 1024 * 1024

from api.deps import get_current_user, get_current_workspace
from api.routes.auth import router as auth_router
from api.routes.audit import router as audit_router
from api.routes.analysis import router as analysis_router
from api.routes.graph import router as graph_router
from api.routes.cases import router as cases_router
from api.routes.alerts import router as alerts_router
from api.routes.evidence import router as evidence_router
from api.routes.service_requests import router as service_requests_router
from api.routes.admin import router as admin_router
from api.routes.reports import router as reports_router
from api.routes.workflow import router as workflow_router
from api.routes.datasets import router as datasets_router
from api.routes.messages import router as messages_router
from api.routes.notifications import router as notifications_router
from api.routes.workbench import router as workbench_router
from db.database import get_db, init_db
from models.user import User
from utils.csv_parser import parse_csv
from detectors.cycle import find_cycles
from detectors.fan import detect_fan_patterns
from detectors.layering import find_layered_shells
from detectors.burst import detect_burst_activity
from detectors.score import compute_scores_and_rings
from services.audit_service import (
    log_event,
    EventType,
    EventAction,
    EventStatus,
)
from utils.synthetic import GeneratorParams, generate_synthetic_dataset

app = FastAPI(
    title="TraceAcc",
    description="Enterprise-grade AML detection using graph analytics and ML.",
    version="2.0.0",
)

# CORS setup for frontend at localhost
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()
app.include_router(auth_router)
app.include_router(audit_router)
app.include_router(analysis_router)
app.include_router(graph_router)
app.include_router(cases_router)
app.include_router(alerts_router)
app.include_router(evidence_router)
app.include_router(service_requests_router)
app.include_router(admin_router)
app.include_router(reports_router)
app.include_router(workflow_router)
app.include_router(datasets_router)
app.include_router(messages_router)
app.include_router(notifications_router)
app.include_router(workbench_router)

@app.get("/")
async def root() -> Dict:
    return {"message": "Backend is running"}

@app.post("/analyze")
async def analyze(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start_time = time.time()

    # Log analysis start
    log_event(
        db=db,
        event_type=EventType.ANALYZE,
        event_action=EventAction.ANALYZE_START,
        event_status=EventStatus.SUCCESS,
        user_id=current_user.id,
        username=current_user.username,
        request=request,
        details={"filename": file.filename, "content_type": file.content_type},
    )

    try:
        contents = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum allowed size is {MAX_UPLOAD_BYTES // (1024*1024)} MB."
            )
        file_content = contents.decode("utf-8")

        def run_analysis_sync():
            graph = parse_csv(file_content)
            logger.info("Graph built: %d nodes, %d transactions", len(graph.nodes), len(graph.transactions))

            cycle_rings = find_cycles(graph, max_length=4, max_cycles=200)
            fan_rings = detect_fan_patterns(graph, threshold=3, time_window_hours=72)
            shell_rings = find_layered_shells(graph, min_chain_length=3, max_degree=3)
            burst_accounts = detect_burst_activity(graph, dormant_days=180, burst_threshold=10, burst_window_hours=72)

            logger.info("Burst accounts detected: %d", len(burst_accounts))

            suspicious_accounts, fraud_rings = compute_scores_and_rings(
                cycle_rings=cycle_rings,
                fan_rings=fan_rings,
                shell_rings=shell_rings,
                burst_accounts=burst_accounts
            )
            return graph, suspicious_accounts, fraud_rings, cycle_rings, fan_rings, shell_rings, burst_accounts

        # Run CPU-bound analysis in a thread pool to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        graph, suspicious_accounts, fraud_rings, cycle_rings, fan_rings, shell_rings, burst_accounts = \
            await loop.run_in_executor(None, run_analysis_sync)

        processing_time = round(time.time() - start_time, 3)
        duration_ms = int((time.time() - start_time) * 1000)

        result = {
            "summary": {
                "total_accounts_analyzed": len(graph.nodes),
                "total_transactions": len(graph.transactions),
                "suspicious_accounts_flagged": len(suspicious_accounts),
                "fraud_rings_detected": len(fraud_rings),
                "processing_time_seconds": processing_time
            },
            "suspicious_accounts": suspicious_accounts,
            "fraud_rings": fraud_rings
        }

        # Log successful analysis
        log_event(
            db=db,
            event_type=EventType.ANALYZE,
            event_action=EventAction.ANALYZE_SUCCESS,
            event_status=EventStatus.SUCCESS,
            user_id=current_user.id,
            username=current_user.username,
            request=request,
            details={
                "filename": file.filename,
                "nodes_analyzed": len(graph.nodes),
                "suspicious_accounts": len(suspicious_accounts),
                "fraud_rings": len(fraud_rings),
                "cycles": len(cycle_rings),
                "fans": len(fan_rings),
                "shells": len(shell_rings),
                "bursts": len(burst_accounts),
            },
            duration_ms=duration_ms,
        )

        return result

    except ValueError as e:
        duration_ms = int((time.time() - start_time) * 1000)

        # Log failed analysis (user input error)
        log_event(
            db=db,
            event_type=EventType.ANALYZE,
            event_action=EventAction.ANALYZE_FAILED,
            event_status=EventStatus.ERROR,
            user_id=current_user.id,
            username=current_user.username,
            request=request,
            details={"filename": file.filename},
            error_message=str(e),
            duration_ms=duration_ms,
        )

        logger.warning("Analysis input error for file %s: %s", file.filename, str(e))
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {str(e)}")

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)

        # Log failed analysis
        log_event(
            db=db,
            event_type=EventType.ANALYZE,
            event_action=EventAction.ANALYZE_FAILED,
            event_status=EventStatus.ERROR,
            user_id=current_user.id,
            username=current_user.username,
            request=request,
            details={"filename": file.filename},
            error_message=str(e),
            duration_ms=duration_ms,
        )

        logger.error("Analysis failed for file %s: %s", file.filename, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/sample-generator")
async def sample_generator(params: GeneratorParams) -> Dict:
    try:
        transactions = generate_synthetic_dataset(params)
        return {"transactions": transactions}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
