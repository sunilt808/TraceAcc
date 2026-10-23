import asyncio
import sys
from pathlib import Path

backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

from services.liveshield.engine import SimulationEngine

async def run_simulation_audit():
    print("=" * 80)
    print("RUNNING COMPLETE 1,000-TRANSACTION SIMULATION (LIVESHIELD PHASE 2 E2E)")
    print("=" * 80)

    config = {
        "mode": "basic",
        "target_tps": 50.0,
        "total_transactions": 1000,
        "traffic_composition": "mixed",
        "legitimate_percentage": 75.0,
        "fraudulent_percentage": 25.0,
        "selected_scenarios": ["F01", "F02", "F03", "F04", "F05", "F06"],
        "detection_mode": "shadow",
        "detection_config": {
            "flag_threshold": 0.50,
            "hold_threshold": 0.70,
            "reject_threshold": 0.88,
            "weight_fast_screening": 0.55,
            "weight_dclcg": 0.35,
            "weight_historical_risk": 0.10,
        },
    }

    engine = SimulationEngine(simulation_id=888, config=config)
    await engine.start()

    while engine.status not in ("COMPLETED", "STOPPED", "FAILED"):
        await asyncio.sleep(0.5)

    stats = engine.get_stats()
    ev = stats.get("evaluation", {})

    print("\n--- SIMULATION RESULTS ---")
    print(f"Status: {engine.status}")
    print(f"Total Generated: {stats.get('total_generated')}")
    print(f"Legitimate Count: {stats.get('total_legitimate')}")
    print(f"Fraudulent Count: {stats.get('total_fraudulent')}")
    print(f"Fast Screen Flagged: {stats.get('fast_screening_flagged')}")
    print(f"Graph Worker Batches: {stats.get('graph_worker_batches')}")

    tp = ev.get("true_positives", 0)
    fp = ev.get("false_positives", 0)
    tn = ev.get("true_negatives", 0)
    fn = ev.get("false_negatives", 0)
    prec = ev.get("precision", 0.0)
    rec = ev.get("recall", 0.0)
    fpr = ev.get("false_positive_rate", 0.0)
    f1 = ev.get("f1_score", 0.0)

    print("\n--- CONFUSION MATRIX ---")
    print(f"  True Positives  (TP) : {tp:4d}")
    print(f"  False Positives (FP) : {fp:4d}")
    print(f"  True Negatives  (TN) : {tn:4d}")
    print(f"  False Negatives (FN) : {fn:4d}")
    print(f"  Precision            : {prec*100:6.2f}%")
    print(f"  Recall               : {rec*100:6.2f}%")
    print(f"  False Positive Rate  : {fpr*100:6.2f}%")
    print(f"  F1 Score             : {f1*100:6.2f}%")
    print(f"  P50 Screening Latency: {ev.get('latency_screening_p50', 0):.2f} ms")
    print(f"  P99 Screening Latency: {ev.get('latency_screening_p99', 0):.2f} ms")
    print("=" * 80)

    await engine.stop()

if __name__ == "__main__":
    asyncio.run(run_simulation_audit())
