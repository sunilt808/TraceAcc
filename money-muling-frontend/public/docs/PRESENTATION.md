# Graph-Based Financial Crime Detection Platform
## Final Year Major Project Presentation

---

## 1. Abstract
Financial institutions face massive challenges in detecting organized money muling rings. Traditional rule-based systems generate high false positives and fail to uncover complex, multi-hop syndicates. This project proposes a **Graph-Based Financial Crime Detection Platform** that leverages graph theory (NetworkX), advanced heuristics, and Machine Learning anomaly detection to uncover layered transaction networks.

## 2. Problem Statement
- **Volume:** Millions of transactions daily make manual review impossible.
- **Complexity:** Fraudsters use "smurfing" and multi-hop layering through mule accounts.
- **Limitation of current systems:** Existing systems look at individual accounts (silos) rather than the holistic network of relationships.

## 3. Literature Survey
- **Traditional AML:** Rule-based (e.g., amount > $10,000). Easily bypassed.
- **Machine Learning (Isolation Forests):** Good at finding outliers but lacks context of money flow.
- **Graph Analytics:** The state-of-the-art approach. Models accounts as nodes and transactions as edges to find cycles, fans, and bridges.

## 4. Objectives
1. Build a scalable transaction graph engine.
2. Implement 14+ advanced graph detectors (Cycles, Fans, Layering, Motifs, Community, Centrality).
3. Augment graph heuristics with unsupervised ML (Isolation Forest, LOF, DBSCAN).
4. Provide a rich, interactive visualization dashboard for investigators.

## 5. Architecture
- **Frontend:** React, Vite, Cytoscape.js (Graph Visualization), Recharts.
- **Backend:** FastAPI, Python, SQLAlchemy, PostgreSQL.
- **Analysis Engine:** NetworkX (Graph Theory), Scikit-Learn (ML Anomaly Detection).

## 6. Modules
1. **Ingestion Module:** Parses CSV transaction logs and builds a `MultiDiGraph`.
2. **Graph Detection Engine:** Runs 14 parallel detectors (e.g., K-Core, SCC, Bridges).
3. **ML Anomaly Engine:** Extracts 10 behavioural features per account and runs Isolation Forest.
4. **Hybrid Risk Engine:** Combines Graph + ML + Temporal + Community signals into a 0-100 score.
5. **Investigation Module:** Case management, interactive graph viewer, and reporting.

## 7. Algorithms & Techniques
- **Louvain / Label Propagation:** Community detection to find isolated fraud rings.
- **PageRank / Betweenness Centrality:** Identifies critical hub/relay accounts.
- **Strongly Connected Components (SCC):** Detects closed-loop money recirculation (cycles).
- **K-Core Decomposition:** Finds densely connected subgraphs.
- **Temporal Analysis:** Detects night-time, weekend, or rapid burst activity.

## 8. Results
- Accurately detects synthetic money muling patterns with >95% precision.
- Reduces false positives by aggregating multiple weak signals into a strong hybrid score.
- Visualization allows investigators to trace funds across 5+ hops instantly.

## 9. Advantages
- **Explainability:** Hybrid score breakdown shows exactly *why* an account is flagged.
- **Holistic View:** Analyzes the whole network, not just individual nodes.
- **Scalable:** Modular architecture allows adding new detectors easily.

## 10. Limitations
- In-memory graph processing (NetworkX) limits analysis to ~100k transactions per batch.
- Relies on structured CSV input; real-time streaming (Kafka) is not yet implemented.

## 11. Future Scope
- **Graph Database Integration:** Migrate from NetworkX to Neo4j for persistent graph storage and Cypher queries.
- **Real-Time Streaming:** Implement Apache Kafka and WebSockets for live detection.
- **Deep Learning:** Implement Graph Neural Networks (GNNs) for predictive scoring.

## 12. Expected Viva Questions
1. *Why did you choose FastAPI over Django/Flask?* (Asynchronous, fast, native Pydantic validation).
2. *What is a Strongly Connected Component?* (A directed subgraph where every node can reach every other node).
3. *How does Isolation Forest work?* (Isolates anomalies by randomly partitioning data; anomalies have shorter path lengths in the trees).
4. *Why use Cytoscape.js instead of D3?* (Cytoscape is explicitly designed for heavy graph/network visualization with built-in layout algorithms).
5. *How is the Final Risk Score calculated?* (Weighted sum: Graph 35%, Behaviour 20%, ML 20%, Temporal 15%, Community 10%).