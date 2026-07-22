# Detection Engine Document

This document describes the algorithms, implementations, complexities, and design constraints of the heuristic models within the Money Muling Detection Engine.

---

## 🔄 1. Cycle Detection
*   **Purpose**: Identify circular pathways where capital is routed through multiple intermediaries to return to the original sender, masking the trail.
*   **Algorithm**: Depth-First Search (DFS) traversal targeting closed loops.
*   **Logic**:
    1.  Filter out nodes that do not have at least one incoming and one outgoing edge.
    2.  Sort nodes lexicographically to ensure order consistency.
    3.  Run recursive DFS up to depth `max_length` (default: 4).
    4.  Prune paths where the neighbor node value is lower than the starting node (`neighbor < start`) to prevent cyclic permutations (e.g. reporting A-B-C-A and B-C-A-B separately).
*   **Time Complexity**: $O(V \cdot b^d)$ where $V$ is candidate vertices, $b$ is average branching factor, and $d$ is path length.
*   **Space Complexity**: $O(V + E)$ to represent the active search graph.
*   **Advantages**: Simple to calculate, catches direct laundering rings.
*   **Weaknesses**: Susceptible to path explosion if node degrees are high.
*   **False Positives**: Normal cyclic commercial exchanges (e.g., refunds or mutual trade partnerships).

---

## 📥 2. Fan-In Detection
*   **Purpose**: Track accounts receiving high-frequency incoming transfers from separate originators, indicating mule accumulation.
*   **Algorithm**: In-degree sliding window check.
*   **Logic**:
    1.  Inspect each node's incoming edge list.
    2.  Identify nodes where unique senders count is above `threshold` (default: 10) and outgoing degree is small, which flags potential accumulation.
    3.  Extract transaction timestamps, sort chronologically, and verify if the threshold number of transfers occurs within `time_window_hours`.
*   **Time Complexity**: $O(V \cdot E_{in} \log E_{in})$ due to sorting timestamps on high-in-degree nodes.
*   **Space Complexity**: $O(E_{in})$ to hold incoming transaction records.
*   **Advantages**: Successfully catches central consolidation points.
*   **Weaknesses**: Requires flat thresholds which might miss distributed patterns.
*   **False Positives**: Legitimate merchants or donation links.

---

## 📤 3. Fan-Out Detection
*   **Purpose**: Detect accounts acting as distribution hubs, dispersing large balances to multiple recipients.
*   **Algorithm**: Out-degree sliding window check.
*   **Logic**:
    1.  Examine each node's outgoing edge list.
    2.  Identify nodes where unique receivers count is above `threshold` and incoming degree is small.
    3.  Verify if the outgoing transactions occur within the specified sliding time window.
*   **Time Complexity**: $O(V \cdot E_{out} \log E_{out})$ for timestamp sorting.
*   **Space Complexity**: $O(E_{out})$ to hold outgoing transaction records.
*   **Advantages**: Detects mule distribution points.
*   **Weaknesses**: Threshold dependencies make it easy to bypass if transfers are spread out.
*   **False Positives**: Corporate payroll engines or dividend payout networks.

---

## 🔗 4. Layering Detection
*   **Purpose**: Identify multi-hop transaction paths (layering) where money is sequentially forwarded through low-degree pass-through accounts.
*   **Algorithm**: Recursive path tracing.
*   **Logic**:
    1.  Locate candidate start nodes with low incoming degrees (in-degree <= `max_degree`).
    2.  Run DFS forward.
    3.  Continue path if the neighbor's total degree is low (in-degree + out-degree <= `max_degree`).
    4.  End the path and record a ring once a higher-degree target or terminal node is encountered.
*   **Time Complexity**: $O(V_{start} \cdot b^{max\_depth})$ where branching factor $b$ is limited by `max_degree`.
*   **Space Complexity**: $O(d)$ for recursion stack depth.
*   **Advantages**: Traces serial hops.
*   **Weaknesses**: Assumes strict maximum degree limits; intermediate accounts that mix funds will break the chain tracker.
*   **False Positives**: Normal chain structures like supply chains.

---

## ⚡ 5. Burst Detection
*   **Purpose**: Flag dormant accounts that suddenly show high-velocity transactions, indicating compromised accounts or newly activated mules.
*   **Algorithm**: Dormancy index and temporal transaction clustering.
*   **Logic**:
    1.  Collect all transactions for a node and sort them.
    2.  Find windows containing at least `burst_threshold` transactions within `burst_window_hours`.
    3.  Check the preceding `dormant_days` period to verify that transactions count is <= 3.
*   **Time Complexity**: $O(V \cdot K \log K)$ where $K$ represents transactions per node.
*   **Space Complexity**: $O(K)$ to hold sorted timestamps.
*   **Advantages**: Detects newly activated mule profiles.
*   **Weaknesses**: Does not account for seasonal business changes.
*   **False Positives**: Holiday shopping sprees or corporate funding cycles.

---

## 📊 6. Suspicion Scoring
*   **Logic**: Combined scores computed via fixed rule weights:
    *   Cycle presence: +40
    *   Fan-in/out: +25
    *   Burst: +25
    *   Layering: +20
    *   Multi-ring bonus: +5 per additional ring (cap at +20).
    *   Final score capped at 100.
*   **Limitations**: Entirely heuristic; weights are static, preventing adaptation to evolving fraud typologies.
