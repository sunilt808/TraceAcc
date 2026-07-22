# TraceAcc — Interview & Presentation Reference Guide

> **For: Technical Interviews · Academic Presentations · Hackathon Pitches · Placement Drives**
> Project: TraceAcc Money Muling Detection Engine
> Author: Sunil | RIFT 2026 — Graph Theory & Financial Fraud Track

---

## 🎤 THE 30-SECOND ELEVATOR PITCH

> *"I built TraceAcc — a graph-based Anti-Money Laundering detection platform. It converts raw bank transaction data into a directed financial graph and automatically identifies money laundering patterns like circular fund routing, aggregation hubs, shell account chains, and sudden burst activity. The detection runs 4 graph heuristics and 3 ML anomaly detectors simultaneously, scores each flagged account from 0–100, and visualizes the entire transaction network through an interactive Cytoscape.js dashboard. It's built on FastAPI, React, NetworkX, and scikit-learn."*

---

## 🧠 THE 2-MINUTE DEEP DIVE (For Technical Rounds)

> *"The core problem I solved is this: traditional fraud detection looks at transactions in isolation. But money mules rarely act alone — they operate in coordinated networks. So I modeled the problem as a directed graph where nodes are bank accounts and edges are transactions with amounts and timestamps.*

> *On this graph I run four distinct heuristics simultaneously:*
> - ***Cycle detection*** — finds circular paths (A→B→C→A) using DFS with lexicographic pruning to eliminate duplicate reports. Score: 40 points.*
> - ***Fan-In/Fan-Out*** — identifies aggregation/disbursement hubs by degree thresholding with a temporal sliding window. Score: 25 points.*
> - ***Layering chains*** — traces shell account pass-through sequences where intermediate nodes have very low degrees. Score: 20 points.*
> - ***Burst activity*** — flags accounts dormant for 180 days that suddenly execute 10+ transfers in 72 hours (classic mule activation pattern). Score: 25 points.*

> *Then I augment the graph heuristics with unsupervised ML — Isolation Forest, LOF, and DBSCAN — running on 11-dimensional behavioral feature vectors built per account: total sent/received, pass-through ratio, net flow, activity span, etc.*

> *Each account gets a weighted suspicion score from 0–100. Everything is rendered on a React dashboard with Cytoscape.js for interactive graph exploration."*

---

## ❓ COMMON INTERVIEW QUESTIONS & ANSWERS

### Q1: "Why did you use NetworkX instead of a proper graph database like Neo4j?"

> *"NetworkX was the right choice for a prototype because it's Python-native and doesn't require infrastructure. For this scale (thousands of accounts per CSV), in-memory graph operations complete in sub-second time. In production, I'd migrate to Neo4j using Cypher queries because it supports persistent storage, billions of relationships, and sub-second path traversals via native graph indexes. The current architecture is designed to make that migration clean — the graph object is abstracted through a TransactionGraph class."*

---

### Q2: "How does your cycle detection avoid reporting the same ring multiple times?"

> *"I use lexicographic pruning. In DFS, when I find a potential cycle back to the start node, I only record it if every neighbor I'd traverse is lexicographically greater than the start node. So for ring A→B→C→A, B→C→A→B, and C→A→B→C — only the one starting with A (the lexicographically smallest) is recorded. This reduces output by a factor of N for an N-length cycle and prevents the fraud ring table from being cluttered with duplicates."*

---

### Q3: "What does the suspicion score actually mean? How did you calibrate the weights?"

> *"The suspicion score is a weighted sum of detected patterns: cycle presence adds 40, fan-in/out adds 25, burst adds 25, and layering adds 20. Accounts in multiple rings get a bonus of 5 per additional ring, capped at 20. The total is capped at 100.*

> *Honest answer: the weights are based on domain reasoning from FATF typology reports, not empirically trained against a labeled dataset. Cycles are the strongest indicator (40 points) because circular routing is the most direct evidence of deliberate obfuscation. For production, I'd calibrate these weights against real fraud datasets or train a GNN classifier to replace the manual scoring entirely."*

---

### Q4: "What ML models do you use and why three different ones?"

> *"I use three models because each detects anomalies through a fundamentally different mechanism:*

> *Isolation Forest works by building random decision trees and measuring how quickly an account is isolated. Fraudulent accounts, being behavioral outliers, tend to be isolated in fewer splits.*

> *Local Outlier Factor measures density. Fraud accounts often exist in sparse regions of the feature space — they don't cluster with normal accounts.*

> *DBSCAN clusters accounts by behavioral similarity. Accounts labeled as noise (cluster -1) don't fit any cluster — they're structural anomalies.*

> *Running all three and flagging accounts that appear in multiple models gives a more robust signal than any single model alone."*

---

### Q5: "Your system is stateless. Doesn't that make it useless for real investigation?"

> *"Yes — that's the primary production gap I'm aware of. Currently, the database only stores users and audit logs. Transaction data, detected rings, and suspicion scores are computed per request and discarded. For production I'd add four tables: analysis_jobs (job history with results JSON), accounts (discovered entities), transactions (persisted edges), and detected_rings (fraud ring records). The analysis endpoint would return a job_id immediately, compute in a Celery background worker, and update the DB — allowing analysts to revisit, compare, and build cases over time."*

---

### Q6: "What is money muling? Can you explain it like I'm an analyst?"

> *"A money mule is someone who transfers illegally obtained money on behalf of criminals, often without knowing (or willfully ignoring) its source. The three main patterns are:*

> *Structuring (Smurfing): Breaking large amounts into smaller deposits below reporting thresholds. My burst detector catches the sudden activity spike.*

> *Layering: Moving money through multiple accounts to obscure its origin — my layering chain detector traces these pass-through sequences.*

> *Integration: Cycling money back through legitimate-looking businesses or accounts. My cycle detector finds these circular fund routing rings."*

---

### Q7: "Can this scale to real bank transaction volumes?"

> *"Not in its current form. The main bottleneck is that the graph analysis runs synchronously inside the FastAPI event loop, blocking all other requests. For a 50,000-row CSV this would freeze the server for 30+ seconds.*

> *The solution is a task queue: the /analyze endpoint returns a job_id immediately, a Celery worker processes the graph in a separate process, and the frontend polls or receives a WebSocket notification when done. For true scale — hundreds of millions of transactions — I'd use Apache Kafka for ingestion and Neo4j for graph storage, queried via Cypher. The in-memory NetworkX approach caps out at roughly 500,000 edges before memory becomes the bottleneck."*

---

### Q8: "Tell me about the frontend. Why Cytoscape.js?"

> *"Cytoscape.js is the industry standard for interactive network graph visualization in the browser. It handles thousands of nodes efficiently via canvas rendering, supports physics-based layouts (CoSE, Dagre), and has rich event APIs for click-to-highlight, tooltips, and zoom. For a fraud detection system where the analyst needs to visually trace money flows between accounts, a graph visualization isn't optional — it's the primary interface. I added layout controls (Force Layout, Circle View, Fraud Ring Highlight) so analysts can explore the network from different perspectives."*

---

## 📊 KEY NUMBERS TO REMEMBER

| Metric | Value |
|--------|-------|
| Detection algorithms | 21 distinct modules |
| Graph heuristics | 4 (cycle, fan, layering, burst) |
| ML models | 3 (Isolation Forest, LOF, DBSCAN) |
| Feature dimensions | 11 per account behavioral vector |
| Max suspicion score | 100 |
| Score weights | Cycle:40 · Fan:25 · Burst:25 · Layer:20 |
| Frontend pages | 14 distinct routes |
| Audit log indexes | 2 composite (user+time, type+action) |
| Tech layers | FastAPI · NetworkX · sklearn · React · Cytoscape · PostgreSQL |

---

## 🏗️ ARCHITECTURE DIAGRAM (Verbal Description for Whiteboard)

```
                    ┌────────────────────────────────┐
                    │    React + Vite Frontend        │
                    │  (Cytoscape.js · 14 routes)     │
                    └────────────────┬───────────────┘
                                     │ HTTP / JSON
                    ┌────────────────▼───────────────┐
                    │    FastAPI + Uvicorn            │
                    │    (JWT auth · CORS · Audit)    │
                    └───┬────────────────────────┬───┘
                        │                        │
            ┌───────────▼──────────┐  ┌──────────▼──────────┐
            │   Detection Engine   │  │   PostgreSQL / ORM   │
            │  ┌────────────────┐  │  │  users · audit_logs  │
            │  │ Cycle Detector │  │  └─────────────────────┘
            │  │ Fan Detector   │  │
            │  │ Layer Detector │  │
            │  │ Burst Detector │  │
            │  │ ML Anomaly (3) │  │
            │  │ Score Engine   │  │
            │  └────────────────┘  │
            │   NetworkX Graph     │
            └──────────────────────┘
```

---

## 💡 WHAT MAKES THIS DIFFERENT FROM A BASIC PROJECT

Most student fraud projects:
- ❌ One algorithm (usually just cycle detection)
- ❌ No real ML (or toy sklearn usage without feature engineering)
- ❌ Table-only output with no visualization
- ❌ No audit trail

TraceAcc:
- ✅ **21 detection modules** — exhaustive coverage of AML typologies
- ✅ **Real unsupervised ML** — feature-engineered 11-dim vectors + 3 models
- ✅ **Interactive Cytoscape.js graph** — visual network exploration
- ✅ **Database audit logging** — composite-indexed event trail
- ✅ **Synthetic data generator** — self-contained demo capability
- ✅ **Settings-configurable thresholds** — per-deployment customization
- ✅ **14-page full-stack dashboard** — production-quality frontend

---

## 🔮 PRODUCTION ROADMAP (Show You're Thinking Ahead)

When asked "what would you add?", say this in order:

1. **Async compute**: `run_in_executor` or Celery workers to unblock the event loop
2. **Transaction persistence**: Store analysis results in PostgreSQL so analysts can revisit
3. **WebSocket progress**: Real-time analysis updates to the frontend
4. **Neo4j migration**: Replace in-memory NetworkX with a proper graph database
5. **GNN classifier**: Graph Neural Network trained on labeled fraud data
6. **Kafka ingestion**: Real-time stream processing instead of batch CSV uploads
7. **Docker Compose**: One-command local setup for new engineers
8. **Pytest suite**: Unit tests for every detector module

---

## 🎯 DOMAIN VOCABULARY (Know These Cold)

| Term | Definition |
|------|-----------|
| **Money Mule** | Person who transfers illegally obtained money on behalf of criminals |
| **Structuring (Smurfing)** | Breaking large deposits into small amounts to avoid reporting thresholds |
| **Layering** | Moving money through multiple accounts to obscure origin |
| **Fan-In** | Multiple accounts sending money to one aggregation hub |
| **Fan-Out** | One account distributing money to multiple recipients |
| **Burst Activity** | Sudden surge in transactions after a long dormant period |
| **Fraud Ring** | Coordinated group of accounts involved in the same laundering scheme |
| **Suspicion Score** | Weighted composite risk score (0–100) per account |
| **AML** | Anti-Money Laundering — regulatory/technical prevention of financial crime |
| **FATF** | Financial Action Task Force — global AML standards body |
| **KYC** | Know Your Customer — identity verification requirement |
| **SAR** | Suspicious Activity Report — formal report filed with regulators |
| **DFS** | Depth-First Search — graph traversal algorithm used for cycle detection |
| **LOF** | Local Outlier Factor — density-based anomaly detection algorithm |
| **GNN** | Graph Neural Network — deep learning on graph-structured data |

---

## 📝 PRESENTATION SLIDE OUTLINE (5 Minutes)

**Slide 1 — The Problem** (30s)
> "₹7 trillion is laundered globally every year. Traditional rule-based systems miss coordinated network fraud."

**Slide 2 — The Approach** (60s)
> "We model transactions as a directed graph. Each account is a node. Each transfer is an edge. We detect money laundering patterns in the graph topology."

**Slide 3 — Detection Engine** (90s)
> Show the 4 heuristics + 3 ML models. Use the diagram. Explain cycle detection and burst detection with examples.

**Slide 4 — Live Demo** (90s)
> Upload sample CSV → show analysis → show Cytoscape graph → highlight a fraud ring.

**Slide 5 — What's Next** (30s)
> "Neo4j for scale. Celery for async. GNN for probability-based classification."

---

*This document was generated for RIFT 2026. Keep it confidential.*
