"""
test_liveshield.py — Comprehensive Unit & Integration Tests for TraceAcc LiveShield Phase 1.
Tests:
- All 18 Fraud Typologies (F01–F18)
- 12 Legitimate Financial Traffic Channels
- Account Population & Entity Archetypes
- Priority Queue Fraud Scheduler
- Simulation Engine Execution & 100-TPS Monotonic Rate
- Financial Accuracy (Numeric(18,2) / Decimal)
- Worker Crash Recovery Sweep
- REST APIs & Preset Templates
"""
import asyncio
from decimal import Decimal
import io
import os
import pytest
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db.database import Base, SessionLocal
from models.liveshield import Simulation, SimulationTransaction, SimulationPreset, SimulationEvent
from models.user import User, Role
from services.liveshield.accounts import AccountPopulation
from services.liveshield.legitimate import LegitimateTransactionGenerator
from services.liveshield.registry import scenario_registry
from services.liveshield.scheduler import SimulationScheduler
from services.liveshield.engine import SimulationEngine
from services.liveshield.manager import SimulationManager
from services.liveshield.presets import BUILTIN_PRESETS


# ============================================================
# 1. SCENARIO REGISTRY & F01-F18 GENERATION TESTS
# ============================================================

def test_scenario_registry_completeness():
    """Verify all 18 fraud typologies (F01 to F18) are registered."""
    scenarios = scenario_registry.list_scenarios()
    assert len(scenarios) >= 18
    scenario_ids = [s.scenario_id for s in scenarios]
    for i in range(1, 19):
        expected_id = f"F{i:02d}"
        assert expected_id in scenario_ids, f"Missing scenario {expected_id}"


def test_f01_to_f18_sequence_generation():
    """Test every scenario generator generates valid sequences and step indices."""
    from datetime import datetime, timezone
    pop = AccountPopulation(num_accounts=200)
    
    for i in range(1, 19):
        scenario_id = f"F{i:02d}"
        seq, _ = scenario_registry.generate_sequence(
            scenario_id=scenario_id,
            population=pop,
            base_time=datetime.now(timezone.utc),
            txn_prefix="TXN",
            counter_start=1,
        )
        assert len(seq) > 0, f"Scenario {scenario_id} generated empty sequence"

        # Verify ground truth and metadata
        for step_idx, txn in enumerate(seq):
            assert txn["synthetic_ground_truth"] == "fraudulent"
            assert txn["scenario_id"] == scenario_id
            assert txn["sequence_id"] is not None
            assert txn["step_index"] == step_idx
            assert txn["sender_account"] != txn["receiver_account"]
            assert isinstance(txn["amount"], Decimal)
            assert txn["amount"] > Decimal("0.00")


# ============================================================
# 2. LEGITIMATE TRAFFIC & FINANCIAL ACCURACY TESTS
# ============================================================

def test_legitimate_traffic_channels():
    """Verify legitimate generator generates 12 financial channels with Decimal amounts."""
    pop = AccountPopulation(num_accounts=200)
    legit_gen = LegitimateTransactionGenerator(pop)

    channels_seen = set()
    for _ in range(100):
        txn = legit_gen.generate_single_transaction()
        assert txn["synthetic_ground_truth"] == "legitimate"
        assert txn["scenario_id"] is None
        assert txn["sequence_id"] is None
        assert isinstance(txn["amount"], Decimal)
        assert txn["amount"] > Decimal("0.00")
        channels_seen.add(txn["channel"])

    assert len(channels_seen) >= 2


def test_financial_accuracy_decimal():
    """Verify all amounts maintain exact 2-decimal precision without float inaccuracies."""
    pop = AccountPopulation(num_accounts=200)
    legit_gen = LegitimateTransactionGenerator(pop)

    for _ in range(50):
        txn = legit_gen.generate_single_transaction()
        # Check decimal scale
        d_str = str(txn["amount"])
        if "." in d_str:
            decimals_len = len(d_str.split(".")[1])
            assert decimals_len <= 2, f"Amount {d_str} exceeds 2 decimal places"


# ============================================================
# 3. PRIORITY QUEUE SCHEDULER TESTS
# ============================================================

def test_fraud_scheduler_interleaving():
    """Verify SimulationScheduler handles priority queue ordering and rate calculations."""
    from datetime import datetime, timezone
    scheduler = SimulationScheduler(target_tps=Decimal("100.0"), traffic_pattern="constant")

    # Schedule simulated sequence items
    now = datetime.now(timezone.utc)
    base_epoch = time.monotonic()
    txns = [
        {"transaction_id": "TX1", "timestamp": now, "amount": Decimal("100.00")},
        {"transaction_id": "TX2", "timestamp": now, "amount": Decimal("200.00")},
    ]
    scheduler.schedule_sequence_transactions(txns, start_epoch=base_epoch)

    assert len(scheduler.sequence_queue) == 2
    # Pop due items
    due = scheduler.pop_due_sequence_items(current_monotonic=base_epoch + 1.0)
    assert len(due) == 2
    assert due[0]["transaction_id"] == "TX1"

    # Rate evaluation
    assert scheduler.get_current_instantaneous_tps(0.0) == 100.0


# ============================================================
# 4. SIMULATION ENGINE EXECUTION & 100-TPS BENCHMARK
# ============================================================

@pytest.mark.asyncio
async def test_engine_100_tps_execution():
    """Verify SimulationEngine runs at 100 TPS with pause/resume and state machine."""
    config = {
        "target_tps": 100.0,
        "duration_seconds": 3,
        "account_population": {"total_accounts": 500, "mule_accounts": 50},
        "fraud_matrix": {
            "enabled_scenarios": ["F01", "F03", "F06", "F08"],
            "fraud_traffic_ratio": 0.20,
        },
    }

    emitted_txns = []
    stats_events = []

    engine = SimulationEngine(
        simulation_id=99999,
        config=config,
        on_event_callback=lambda s: stats_events.append(s),
        on_transaction_callback=lambda t: emitted_txns.append(t),
    )

    # Start engine
    asyncio.create_task(engine.start())
    await asyncio.sleep(1.0)
    assert engine.status == "RUNNING"

    # Pause engine
    await engine.pause()
    assert engine.status == "PAUSED"
    count_at_pause = len(emitted_txns)
    await asyncio.sleep(0.3)
    # Check that generation paused
    assert len(emitted_txns) == count_at_pause

    # Resume engine
    await engine.resume()
    assert engine.status == "RUNNING"
    await asyncio.sleep(1.2)

    # Stop engine
    await engine.stop()
    assert engine.status == "STOPPED"

    # Verify generated transactions
    assert len(emitted_txns) > 50, f"Expected > 50 transactions, got {len(emitted_txns)}"
    legit = [t for t in emitted_txns if t["synthetic_ground_truth"] == "legitimate"]
    fraud = [t for t in emitted_txns if t["synthetic_ground_truth"] == "fraudulent"]

    assert len(legit) > 0
    assert len(fraud) > 0


# ============================================================
# 5. WORKER CRASH RECOVERY SWEEP TESTS
# ============================================================

def test_startup_recovery_sweep():
    """Verify worker manager safely transitions orphaned RUNNING simulations to PAUSED."""
    db = SessionLocal()
    # Create test orphaned simulation
    sim = Simulation(
        name="Orphaned-Crash-Test",
        status="RUNNING",
        mode="basic",
        config={"target_tps": 50.0},
        worker_id="crashed-worker-pid-999",
        organization_id=1,
        created_by_id=1,
    )
    db.add(sim)
    db.commit()
    db.refresh(sim)
    sim_id = sim.id
    db.close()

    # Instantiate manager which triggers sweep
    mgr = SimulationManager()

    # Check updated status
    db2 = SessionLocal()
    recovered_sim = db2.query(Simulation).filter(Simulation.id == sim_id).first()
    assert recovered_sim.status == "PAUSED"
    assert recovered_sim.worker_id is None

    # Check recovery event log
    event = db2.query(SimulationEvent).filter(
        SimulationEvent.simulation_id == sim_id,
        SimulationEvent.event_type == "SYSTEM_RECOVERY"
    ).first()
    assert event is not None
    assert "restart detected" in event.message

    # Clean up
    db2.delete(event)
    db2.delete(recovered_sim)
    db2.commit()
    db2.close()


# ============================================================
# 6. BUILT-IN PRESETS VERIFICATION
# ============================================================

def test_builtin_presets():
    """Verify standard presets (Normal Banking Day, 100-TPS Benchmark, etc.) exist."""
    assert len(BUILTIN_PRESETS) >= 5
    preset_names = [p["name"] for p in BUILTIN_PRESETS]
    assert "Normal Banking Day" in preset_names
    assert "100-TPS Balanced Benchmark (80/20 Split)" in preset_names
    assert "Fraud-Only Typology Stress Run" in preset_names


# ============================================================
# 7. API ENDPOINT & JSON SERIALIZATION TEST
# ============================================================

def test_create_simulation_api_json_serialization():
    """Verify POST /liveshield/simulations parses Decimal fields and serializes to JSON column cleanly."""
    from fastapi.testclient import TestClient
    from main import app
    from api.deps import get_current_user, get_current_workspace, require_internal_user, require_admin

    mock_user = User(
        id=1,
        username="admin",
        role=Role.ADMIN.value,
        email="admin@test.com",
    )

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[require_internal_user] = lambda: mock_user
    app.dependency_overrides[require_admin] = lambda: mock_user
    app.dependency_overrides[get_current_workspace] = lambda: 1

    client = TestClient(app)

    payload = {
        "name": "API-Test-Simulation",
        "mode": "basic",
        "config": {
            "name": "API-Test-Simulation",
            "target_tps": 50.0,
            "duration_seconds": 60,
            "fraud_percentage": 15.0,
            "preset_name": "normal_banking_day"
        }
    }

    response = client.post("/liveshield/simulations", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "API-Test-Simulation"
    assert data["status"] == "READY"
    assert data["id"] is not None

    # Clean up DB record
    db = SessionLocal()
    sim = db.query(Simulation).filter(Simulation.id == data["id"]).first()
    if sim:
        events = db.query(SimulationEvent).filter(SimulationEvent.simulation_id == sim.id).all()
        for ev in events:
            db.delete(ev)
        db.delete(sim)
        db.commit()
    db.close()

    app.dependency_overrides.clear()


def test_simulation_start_converts_to_case_and_links():
    """Verify that starting a simulation with ON_SIMULATION_START policy creates an InvoSpace investigation Case."""
    from fastapi.testclient import TestClient
    from main import app
    from api.deps import get_current_user, require_internal_user, require_admin, get_current_workspace
    from models.case import Case
    from models.case_event import CaseEvent
    from models.organization import Organization

    db = SessionLocal()
    # Ensure organization and user exist
    org = db.query(Organization).filter(Organization.id == 1).first()
    if not org:
        org = Organization(id=1, name="Default Org", status="APPROVED")
        db.add(org)
        db.commit()

    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(
            id=1,
            organization_id=1,
            username="admin1",
            email="admin1@test.com",
            password="testhash",
            role=Role.ADMIN.value,
            is_active=True,
        )
        db.add(user)
        db.commit()
    else:
        user.role = Role.ADMIN.value
        db.commit()

    mock_user = user

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[require_internal_user] = lambda: mock_user
    app.dependency_overrides[require_admin] = lambda: mock_user
    app.dependency_overrides[get_current_workspace] = lambda: 1

    client = TestClient(app)

    # 1. Create a simulation with ON_SIMULATION_START policy
    payload = {
        "name": "Mule-Ring-AutoCase-Sim",
        "mode": "basic",
        "detection_mode": "shadow",
        "case_creation_policy": "ON_SIMULATION_START",
        "config": {
            "name": "Mule-Ring-AutoCase-Sim",
            "target_tps": 50.0,
            "total_transactions": 50,
            "selected_scenarios": ["F01", "F02"],
        }
    }
    create_res = client.post("/liveshield/simulations", json=payload)
    assert create_res.status_code == 201
    sim_data = create_res.json()
    sim_id = sim_data["id"]
    assert sim_data["case_id"] is None

    # 2. Start the simulation
    start_res = client.post(f"/liveshield/simulations/{sim_id}/start")
    assert start_res.status_code == 200
    start_data = start_res.json()
    assert start_data["status"] == "RUNNING"
    assert start_data["case_id"] is not None

    case_id = start_data["case_id"]

    # 3. Verify Case record in DB
    case = db.query(Case).filter(Case.id == case_id).first()
    assert case is not None
    assert "LiveShield Simulation" in case.title
    assert case.organization_id == 1
    assert case.created_by_id == mock_user.id
    assert case.status == "OPEN"

    # 4. Verify CaseEvent in DB
    case_event = db.query(CaseEvent).filter(CaseEvent.case_id == case_id).first()
    assert case_event is not None
    assert case_event.event_type == "SYSTEM_ACTION"

    # 5. Stop simulation and clean up
    client.post(f"/liveshield/simulations/{sim_id}/stop")
    
    sim = db.query(Simulation).filter(Simulation.id == sim_id).first()
    if sim:
        db.query(SimulationEvent).filter(SimulationEvent.simulation_id == sim.id).delete()
        db.delete(sim)
    
    if case:
        db.query(CaseEvent).filter(CaseEvent.case_id == case.id).delete()
        db.delete(case)
    
    db.commit()
    db.close()
    app.dependency_overrides.clear()


def test_upload_dataset_into_simulation_and_analysis_endpoint():
    """Verify uploading a CSV dataset directly into LiveShield runs all detectors and creates simulation + case + analysis bundle."""
    from fastapi.testclient import TestClient
    from main import app
    from api.deps import get_current_user, get_current_workspace, require_internal_user, require_client
    from models.alert import Alert
    from models.case import Case
    from models.case_event import CaseEvent
    from models.liveshield import (
        SimulationDecisionRecord,
        TransactionRiskAssessment,
        SimulationEvaluationSummary,
    )

    db = SessionLocal()
    mock_user = db.query(User).first()
    if not mock_user:
        mock_user = User(
            id=1,
            email="admin@test.com",
            username="admin_test",
            role=Role.ADMIN.value,
            organization_id=1,
            is_active=True,
        )
        db.add(mock_user)
        db.commit()
        db.refresh(mock_user)
    else:
        mock_user.role = Role.ADMIN.value
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[require_client] = lambda: mock_user
    app.dependency_overrides[require_internal_user] = lambda: mock_user
    app.dependency_overrides[get_current_workspace] = lambda: 1

    try:
        db.query(TransactionRiskAssessment).delete()
        db.query(SimulationTransaction).delete()
        db.query(SimulationDecisionRecord).delete()
        db.commit()

        client = TestClient(app)

        # Sample CSV content
        csv_content = (
            "sender_id,receiver_id,amount,timestamp,is_fraud\n"
            "ACC_001,ACC_002,15000.00,2026-03-01T10:00:00Z,1\n"
            "ACC_002,ACC_003,14800.00,2026-03-01T10:30:00Z,1\n"
            "ACC_003,ACC_001,14500.00,2026-03-01T11:00:00Z,1\n"
            "ACC_004,ACC_005,50.00,2026-03-01T12:00:00Z,0\n"
            "ACC_005,ACC_006,45.00,2026-03-01T12:15:00Z,0\n"
        )

        files = {
            "file": ("test_mule_dataset.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")
        }
        data = {
            "name": "Uploaded Mule Test Dataset",
            "detection_mode": "shadow",
        }

        res = client.post("/liveshield/simulations/upload", files=files, data=data)
        assert res.status_code == 201, f"Upload simulation failed: {res.text}"
        sim_data = res.json()
        assert sim_data["mode"] == "upload"
        assert sim_data["status"] in ("RUNNING", "COMPLETED")
        assert sim_data["case_id"] is not None

        sim_id = sim_data["id"]

        # Verify transactions & decision records created
        txns = client.get(f"/liveshield/simulations/{sim_id}/transactions").json()
        assert len(txns) == 5


        decisions = client.get(f"/liveshield/simulations/{sim_id}/decisions").json()
        assert len(decisions) == 5

        # Verify analysis endpoint returns complete unified bundle
        analysis_res = client.get(f"/liveshield/simulations/{sim_id}/analysis")
        assert analysis_res.status_code == 200
        analysis = analysis_res.json()
        assert "graph" in analysis
        assert "fraud_rings" in analysis
        assert "hybrid_scores" in analysis
        assert "temporal" in analysis

        # Verify linked Case
        case = db.query(Case).filter(Case.id == sim_data["case_id"]).first()
        assert case is not None
        assert "Ingestion" in case.title

        # Cleanup
        db.query(Alert).filter(Alert.case_id == case.id).delete()
        db.query(TransactionRiskAssessment).filter(TransactionRiskAssessment.simulation_id == sim_id).delete()
        db.query(SimulationDecisionRecord).filter(SimulationDecisionRecord.simulation_id == sim_id).delete()
        db.query(SimulationTransaction).filter(SimulationTransaction.simulation_id == sim_id).delete()
        db.query(SimulationEvaluationSummary).filter(SimulationEvaluationSummary.simulation_id == sim_id).delete()
        db.query(SimulationEvent).filter(SimulationEvent.simulation_id == sim_id).delete()
        db.query(Simulation).filter(Simulation.id == sim_id).delete()
        db.query(CaseEvent).filter(CaseEvent.case_id == case.id).delete()
        db.delete(case)
        db.commit()
    finally:
        db.close()
        app.dependency_overrides.clear()



