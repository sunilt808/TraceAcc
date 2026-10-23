from typing import Dict, List, Tuple, Any
from collections import defaultdict

def compute_scores_and_rings(
    cycle_rings: Dict[str, List[str]],
    fan_rings: Dict[str, List[str]],
    shell_rings: Dict[str, List[str]],
    burst_accounts: Dict[str, dict] = None,
    amount_patterns: Dict[str, Any] = None,
    temporal_patterns: Dict[str, Any] = None,
    bridge_patterns: Dict[str, Any] = None,
    ml_anomalies: Dict[str, Any] = None,
    community_patterns: Dict[str, Any] = None,
    risk_propagation: Dict[str, Any] = None,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Combine all detected patterns across heuristics, temporal, amount structuring,
    graph topology, and ML anomalies to compute:
    - Suspicious accounts with holistic multi-pattern suspicion scores
    - Unified fraud rings and pattern clusters for all 19 financial crime typologies.
    """

    # ----------------------------
    # 1️⃣ Merge all pattern rings safely
    # ----------------------------
    all_rings = {}
    pattern_map = {}
    ring_counter = 0

    def add_rings(rings_dict: Dict[str, List[str]], pattern: str):
        nonlocal ring_counter
        if not rings_dict:
            return
        for _, members in rings_dict.items():
            if not members:
                continue
            ring_id = f"RING_{ring_counter:04d}"
            all_rings[ring_id] = list(set(members))  # deduplicate members
            pattern_map[ring_id] = pattern
            ring_counter += 1

    def add_pattern_account_cluster(account_list: List[Any], pattern: str, chunk_size: int = 4):
        nonlocal ring_counter
        if not account_list:
            return
        # Extract account IDs safely
        acc_ids = []
        for item in account_list:
            if isinstance(item, str):
                acc_ids.append(item)
            elif isinstance(item, dict) and "account_id" in item:
                acc_ids.append(item["account_id"])
            elif isinstance(item, dict) and "account" in item:
                acc_ids.append(item["account"])

        acc_ids = list(set(acc_ids))
        if not acc_ids:
            return

        # Group into pattern clusters
        for i in range(0, len(acc_ids), chunk_size):
            chunk = acc_ids[i:i + chunk_size]
            ring_id = f"RING_{ring_counter:04d}"
            all_rings[ring_id] = chunk
            pattern_map[ring_id] = pattern
            ring_counter += 1

    # Stage 1: Topological graph shapes
    add_rings(cycle_rings, "circular_transaction")
    add_rings(fan_rings, "fan_in_out")
    add_rings(shell_rings, "layering_shells")

    # Stage 2: Temporal & Behavioral
    if burst_accounts:
        add_pattern_account_cluster(list(burst_accounts.keys()), "burst_activity", chunk_size=4)

    if temporal_patterns:
        if "rapid_movers" in temporal_patterns:
            add_pattern_account_cluster(temporal_patterns.get("rapid_movers", []), "rapid_movement", chunk_size=3)
        if "night_actors" in temporal_patterns:
            add_pattern_account_cluster(temporal_patterns.get("night_actors", []), "night_activity", chunk_size=4)
        if "periodic_actors" in temporal_patterns:
            add_pattern_account_cluster(temporal_patterns.get("periodic_actors", []), "periodic_transfers", chunk_size=3)

    # Stage 3: Amount Structuring & Smurfing
    if amount_patterns:
        if "structuring" in amount_patterns:
            add_pattern_account_cluster(amount_patterns.get("structuring", []), "structuring", chunk_size=4)
        if "round_amounts" in amount_patterns:
            add_pattern_account_cluster(amount_patterns.get("round_amounts", []), "round_amount_spikes", chunk_size=4)
        if "smurfing" in amount_patterns:
            add_pattern_account_cluster(amount_patterns.get("smurfing", []), "smurfing", chunk_size=5)

    # Stage 4: Bridges & Community Core
    if bridge_patterns and "bridge_nodes" in bridge_patterns:
        add_pattern_account_cluster(bridge_patterns.get("bridge_nodes", []), "bipartite_bridge", chunk_size=3)

    # Stage 5: ML Anomalies & Graph Embeddings
    if ml_anomalies:
        if "isolation_forest" in ml_anomalies:
            add_pattern_account_cluster(ml_anomalies.get("isolation_forest", []), "isolation_forest", chunk_size=3)
        if "lof" in ml_anomalies:
            add_pattern_account_cluster(ml_anomalies.get("lof", []), "lof_density", chunk_size=3)
        if "dbscan_noise" in ml_anomalies:
            add_pattern_account_cluster(ml_anomalies.get("dbscan_noise", []), "dbscan_noise", chunk_size=2)

    # Stage 6: Risk Propagation
    if risk_propagation and "top_propagated" in risk_propagation:
        add_pattern_account_cluster(risk_propagation.get("top_propagated", [])[:10], "risk_propagation", chunk_size=4)

    # ----------------------------
    # 2️⃣ Build account → rings map
    # ----------------------------
    account_rings = defaultdict(list)
    account_patterns = defaultdict(set)

    for rid, members in all_rings.items():
        pat = pattern_map.get(rid, "suspicious_cluster")
        for acc in members:
            account_rings[acc].append(rid)
            account_patterns[acc].add(pat)

    # ----------------------------
    # 3️⃣ Pattern Suspicion Weights
    # ----------------------------
    PATTERN_WEIGHTS = {
        "circular_transaction": 40,
        "cycle": 40,
        "layering_shells": 35,
        "layered": 35,
        "fan_in_out": 30,
        "fan": 30,
        "burst_activity": 25,
        "burst": 25,
        "structuring": 35,
        "rapid_movement": 30,
        "night_activity": 25,
        "periodic_transfers": 25,
        "dormant_activation": 35,
        "round_amount_spikes": 20,
        "bipartite_bridge": 30,
        "dclcg_gnn": 45,
        "isolation_forest": 30,
        "lof_density": 30,
        "dbscan_noise": 25,
        "risk_propagation": 35,
        "community_mule_core": 35,
        "temporal_burst_cascade": 40,
    }

    suspicious_accounts = []
    account_scores = {}

    for acc, patterns in account_patterns.items():
        rings = account_rings.get(acc, [])
        score = 0
        for p in patterns:
            score += PATTERN_WEIGHTS.get(p, 20)

        # Bonus if involved in multiple rings / typologies
        if len(patterns) > 1:
            score += min(30, 8 * (len(patterns) - 1))
        if len(rings) > 1:
            score += min(15, 3 * len(rings))

        score = min(score, 100)
        account_scores[acc] = score

        suspicious_accounts.append({
            "account_id": acc,
            "suspicion_score": round(score, 1),
            "detected_patterns": list(patterns),
            "ring_ids": rings,
            "burst": "burst_activity" in patterns,
        })

    # Sort accounts descending
    suspicious_accounts.sort(
        key=lambda x: x["suspicion_score"],
        reverse=True
    )

    # ----------------------------
    # 4️⃣ Compute Ring Risk Scores
    # ----------------------------
    fraud_rings = []

    for rid, members in all_rings.items():
        member_scores = [account_scores.get(acc, 30.0) for acc in members]
        risk_score = (sum(member_scores) / len(member_scores)) if member_scores else 30.0

        fraud_rings.append({
            "ring_id": rid,
            "member_accounts": members,
            "pattern_type": pattern_map[rid],
            "risk_score": round(min(risk_score, 100), 1),
        })

    fraud_rings.sort(
        key=lambda x: x["risk_score"],
        reverse=True
    )

    return suspicious_accounts, fraud_rings