"""
risk_propagation.py — Risk spreading through the transaction network.

High-risk accounts elevate the suspicion level of their direct
and indirect neighbors (1-hop and 2-hop decay model).
"""
from typing import Dict, Any, List
from utils.graph import TransactionGraph


# Decay factors for neighbor propagation
HOP1_DECAY = 0.4   # direct neighbors receive 40% of source risk
HOP2_DECAY = 0.15  # 2-hop neighbors receive 15% of source risk


def propagate_risk(
    graph: TransactionGraph,
    base_scores: Dict[str, float],
    hop1_decay: float = HOP1_DECAY,
    hop2_decay: float = HOP2_DECAY,
) -> Dict[str, Any]:
    """
    Propagate risk scores to neighbors of high-risk accounts.

    Args:
        graph:        TransactionGraph instance
        base_scores:  dict mapping account_id -> suspicion_score (0-100)
        hop1_decay:   proportion of source risk passed to direct neighbors
        hop2_decay:   proportion of source risk passed to 2-hop neighbors

    Returns:
        propagated_scores:  combined base + propagated score per account
        propagation_events: which accounts received risk from which source
    """
    propagated: Dict[str, float] = dict(base_scores)
    events: List[Dict[str, Any]] = []

    for source, score in base_scores.items():
        if score < 20:
            continue  # only propagate meaningfully risky accounts

        # ── 1-hop neighbors ────────────────────────────────────
        outgoing = graph.get_outgoing(source)
        incoming = graph.get_incoming(source)

        hop1_neighbors = set()
        for receiver, *_ in outgoing:
            hop1_neighbors.add(receiver)
        for sender, *_ in incoming:
            hop1_neighbors.add(sender)

        for neighbor in hop1_neighbors:
            if neighbor == source:
                continue
            added = score * hop1_decay
            propagated[neighbor] = min(100, propagated.get(neighbor, 0) + added)
            events.append({
                "source": source,
                "target": neighbor,
                "hop": 1,
                "risk_transferred": round(added, 2),
            })

            # ── 2-hop neighbors ─────────────────────────────────
            hop2_out = graph.get_outgoing(neighbor)
            hop2_in  = graph.get_incoming(neighbor)

            hop2_neighbors = set()
            for r2, *_ in hop2_out:
                hop2_neighbors.add(r2)
            for s2, *_ in hop2_in:
                hop2_neighbors.add(s2)

            for n2 in hop2_neighbors:
                if n2 in (source, neighbor):
                    continue
                added2 = score * hop2_decay
                propagated[n2] = min(100, propagated.get(n2, 0) + added2)
                events.append({
                    "source": source,
                    "target": n2,
                    "hop": 2,
                    "risk_transferred": round(added2, 2),
                })

    # Round all scores
    propagated = {k: round(v, 2) for k, v in propagated.items()}

    summary = {
        "accounts_affected_by_propagation": sum(
            1 for acc in propagated if acc not in base_scores or
            propagated[acc] > base_scores.get(acc, 0)
        ),
        "total_propagation_events": len(events),
    }

    return {
        "propagated_scores": propagated,
        "propagation_events": events,
        "summary": summary,
    }
