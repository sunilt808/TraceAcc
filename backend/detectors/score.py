from typing import Dict, List, Tuple
from collections import defaultdict

def compute_scores_and_rings(
    cycle_rings: Dict[str, List[str]],
    fan_rings: Dict[str, List[str]],
    shell_rings: Dict[str, List[str]],
    burst_accounts: Dict[str, dict] = None   # new parameter
) -> Tuple[List[Dict], List[Dict]]:
    """
    Combine detected rings and compute:
    - Suspicious accounts with suspicion scores
    - Fraud rings with risk scores
    - Burst accounts are also flagged and scored.
    """

    # ----------------------------
    # 1️⃣ Merge all rings safely
    # ----------------------------
    all_rings = {}
    pattern_map = {}
    ring_counter = 0

    def add_rings(rings_dict: Dict[str, List[str]], pattern: str):
        nonlocal ring_counter
        for _, members in rings_dict.items():
            ring_id = f"RING_{ring_counter:04d}"
            all_rings[ring_id] = list(set(members))  # deduplicate members
            pattern_map[ring_id] = pattern
            ring_counter += 1

    add_rings(cycle_rings, "cycle")
    add_rings(fan_rings, "fan")
    add_rings(shell_rings, "layered")

    # ----------------------------
    # 2️⃣ Build account → rings map
    # ----------------------------
    account_rings = defaultdict(list)

    for rid, members in all_rings.items():
        for acc in members:
            account_rings[acc].append(rid)

    # ----------------------------
    # 3️⃣ Add burst accounts (if any)
    # ----------------------------
    burst_accounts = burst_accounts or {}
    burst_set = set(burst_accounts.keys())

    # ----------------------------
    # 4️⃣ Suspicion Score Weights
    # ----------------------------
    PATTERN_WEIGHTS = {
        "cycle": 40,
        "fan": 25,
        "layered": 20,
        "burst": 25      # new pattern weight
    }

    suspicious_accounts = []
    account_scores = {}  # cache for fast lookup

    # Combine all accounts that are either in rings or flagged as burst
    all_accounts = set(account_rings.keys()) | burst_set

    for acc in all_accounts:
        rings = account_rings.get(acc, [])
        pattern_types = set()

        # Patterns from rings
        for rid in rings:
            pattern_types.add(pattern_map.get(rid))

        # Burst pattern
        if acc in burst_set:
            pattern_types.add("burst")

        score = 0
        for p in pattern_types:
            score += PATTERN_WEIGHTS.get(p, 0)

        # Bonus if involved in multiple rings
        if len(rings) > 1:
            score += min(20, 5 * len(rings))

        score = min(score, 100)

        account_scores[acc] = score

        suspicious_accounts.append({
            "account_id": acc,
            "suspicion_score": round(score, 1),
            "detected_patterns": list(pattern_types),
            "ring_ids": rings,
            "burst": acc in burst_set   # add burst flag for frontend
        })

    # Sort descending
    suspicious_accounts.sort(
        key=lambda x: x["suspicion_score"],
        reverse=True
    )

    # ----------------------------
    # 5️⃣ Compute Ring Risk Scores
    # ----------------------------
    fraud_rings = []

    for rid, members in all_rings.items():
        member_scores = [account_scores.get(acc, 0) for acc in members]

        if not member_scores:
            risk_score = 0
        else:
            # Average score gives better signal than max
            risk_score = sum(member_scores) / len(member_scores)

        fraud_rings.append({
            "ring_id": rid,
            "member_accounts": members,
            "pattern_type": pattern_map[rid],
            "risk_score": round(min(risk_score, 100), 1)
        })

    # Sort rings by risk descending
    fraud_rings.sort(
        key=lambda x: x["risk_score"],
        reverse=True
    )

    return suspicious_accounts, fraud_rings