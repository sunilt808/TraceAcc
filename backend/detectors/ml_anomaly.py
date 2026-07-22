"""
ml_anomaly.py — Machine Learning anomaly detection.

Uses scikit-learn unsupervised models as a supplementary signal:
  - Isolation Forest:     detects outlier accounts by isolation depth
  - Local Outlier Factor: detects density-based anomalies
  - DBSCAN:               clusters accounts; noise points (-1) are anomalies

These are NOT used alone — they augment the graph heuristics.
"""
from typing import Dict, Any, List
import numpy as np

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.neighbors import LocalOutlierFactor
    from sklearn.cluster import DBSCAN
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

from utils.graph import TransactionGraph
from detectors.account_profile import build_account_profiles


def _build_feature_matrix(profiles: List[Dict]) -> tuple:
    """Convert account profiles into a numeric feature matrix."""
    feature_keys = [
        "total_sent", "total_received", "net_flow",
        "tx_count", "unique_receivers", "unique_senders",
        "pass_through_ratio", "avg_sent", "avg_received",
        "activity_span_hours", "risk_signal",
    ]
    account_ids = [p["account_id"] for p in profiles]
    matrix = np.array(
        [[p.get(k, 0) or 0 for k in feature_keys] for p in profiles],
        dtype=float,
    )
    # Replace NaN/inf
    matrix = np.nan_to_num(matrix, nan=0.0, posinf=0.0, neginf=0.0)
    return account_ids, matrix, feature_keys


def detect_ml_anomalies(graph: TransactionGraph) -> Dict[str, Any]:
    """
    Run ML anomaly detection on account behaviour profiles.

    Returns:
        isolation_forest:  flagged accounts with anomaly scores
        lof:               flagged accounts via LOF
        dbscan_noise:      accounts classified as noise by DBSCAN
        combined:          union of all ML flags per account
        available:         whether scikit-learn is installed
        summary:           counts
    """
    if not SKLEARN_AVAILABLE:
        return {
            "available": False,
            "isolation_forest": [],
            "lof": [],
            "dbscan_noise": [],
            "combined": {},
            "summary": {"note": "scikit-learn not installed"},
        }

    profile_result = build_account_profiles(graph)
    profiles = profile_result["profiles"]

    if len(profiles) < 5:
        return {
            "available": True,
            "isolation_forest": [],
            "lof": [],
            "dbscan_noise": [],
            "combined": {},
            "summary": {"note": "Insufficient accounts for ML (need ≥ 5)"},
        }

    account_ids, X, feature_keys = _build_feature_matrix(profiles)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    combined: Dict[str, List[str]] = {acc: [] for acc in account_ids}

    # ── Isolation Forest ───────────────────────────────────────
    iso = IsolationForest(
        n_estimators=200,
        contamination=0.1,
        random_state=42,
        n_jobs=-1,
    )
    iso_labels = iso.fit_predict(X_scaled)        # -1 = anomaly
    iso_scores = iso.decision_function(X_scaled)   # lower = more anomalous

    if_results = []
    for i, (acc, label, score) in enumerate(zip(account_ids, iso_labels, iso_scores)):
        if label == -1:
            if_results.append({
                "account_id":    acc,
                "anomaly_score": round(float(-score), 4),   # invert: higher = worse
                "method":        "isolation_forest",
            })
            combined[acc].append("isolation_forest")
    if_results.sort(key=lambda x: x["anomaly_score"], reverse=True)

    # ── Local Outlier Factor ───────────────────────────────────
    n_neighbors = min(20, len(profiles) - 1)
    lof = LocalOutlierFactor(
        n_neighbors=n_neighbors,
        contamination=0.1,
        n_jobs=-1,
    )
    lof_labels = lof.fit_predict(X_scaled)
    lof_scores = -lof.negative_outlier_factor_     # higher = more anomalous

    lof_results = []
    for i, (acc, label, score) in enumerate(zip(account_ids, lof_labels, lof_scores)):
        if label == -1:
            lof_results.append({
                "account_id":  acc,
                "lof_score":   round(float(score), 4),
                "method":      "lof",
            })
            combined[acc].append("lof")
    lof_results.sort(key=lambda x: x["lof_score"], reverse=True)

    # ── DBSCAN ─────────────────────────────────────────────────
    db = DBSCAN(eps=1.5, min_samples=3)
    db_labels = db.fit_predict(X_scaled)

    dbscan_noise = []
    for acc, label in zip(account_ids, db_labels):
        if label == -1:
            dbscan_noise.append({
                "account_id": acc,
                "method":     "dbscan",
            })
            combined[acc].append("dbscan")

    # ── Combined ML flag score ─────────────────────────────────
    combined_list = [
        {
            "account_id": acc,
            "ml_flags":   flags,
            "ml_flag_count": len(flags),
            "ml_score":   round(len(flags) / 3 * 100, 1),
        }
        for acc, flags in combined.items()
        if flags
    ]
    combined_list.sort(key=lambda x: x["ml_flag_count"], reverse=True)

    return {
        "available":         True,
        "isolation_forest":  if_results,
        "lof":               lof_results,
        "dbscan_noise":      dbscan_noise,
        "combined":          {x["account_id"]: x for x in combined_list},
        "summary": {
            "total_accounts":          len(profiles),
            "isolation_forest_flags":  len(if_results),
            "lof_flags":               len(lof_results),
            "dbscan_noise_flags":      len(dbscan_noise),
            "total_ml_flagged":        len(combined_list),
        },
    }
