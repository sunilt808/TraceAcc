# TraceAcc Pro — Enterprise AML Operations Platform <a href="https://deepwiki.com/sunilt808/TraceAcc1">
  <img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki">
</a>

> **Admin-centered workflow platform for client intake, TraceLab analysis, InvoSpace investigation, and governed client release**

[![FastAPI](https://img.shields.io/badge/FastAPI-2.0-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://reactjs.org)
[![NetworkX](https://img.shields.io/badge/NetworkX-Graph-orange?style=flat)](https://networkx.org)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-ML-F7931E?style=flat&logo=scikit-learn)](https://scikit-learn.org)
[![PyTorch](https://img.shields.io/badge/PyTorch-DC--LCG%20GNN-EE4C2C?style=flat&logo=pytorch)](https://pytorch.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=flat&logo=postgresql)](https://supabase.com)

---

## 🧠 What Is This?

**TraceAcc Pro** is an AML operations platform that keeps the client, technical analysis, investigation, and release stages separated but connected through one governed workflow.

- **Admin Workspace** receives client requests, routes work, tracks progress, and reviews reports before release.
- **TraceLab** performs technical AML analysis with a 15-pattern automated suite, generates findings, and creates alerts only. Every completed analysis auto-stores its results into the linked DRAFT technical report.
- **InvoSpace** receives escalations, owns cases, collects evidence, produces final investigation reports, and works from the Intel Hub (cross-job account dossiers, similar-account search, follow-the-money paths).
- **Client Portal** submits requests and downloads only approved final reports.

The detection stack combines graph heuristics, behavioural/temporal signals, unsupervised anomaly models and the **DC-LCG dual-view graph neural network** (trained on labeled datasets, registered as versioned artifacts, fused into every advanced analysis as a supervised scoring dimension).

---
<a href="https://deepwiki.com/sunilt808/TraceAcc1"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
## 🏗️ System Architecture

### High-Level Layers

```
┌────────────────────────────────────────────────────────────────────────┐
│  FRONTEND — React 18 + Vite (role-routed SPA)                          │
│  Landing · Client Portal · Admin Hub · TraceLab · InvoSpace            │
│  Cytoscape.js graph viewer · Patterns page · Intel Hub                 │
└───────────────▲───────────────────────────────▲────────────────────────┘
                │ JWT (Axios)                   │ REST
┌───────────────▼───────────────────────────────▼────────────────────────┐
│  API LAYER — FastAPI (api/routes/*)                                    │
│  auth · service_requests · workflow · admin · assignments              │
│  analysis · patterns · dclcg · intel · alerts · cases · reports        │
│  audit · datasets · messages · workbench                               │
│  RBAC via RoleChecker + workspace scoping (get_current_workspace)      │
└───────────────▲───────────────────────────────▲────────────────────────┘
                │                               │
┌───────────────▼───────────────┐   ┌───────────▼────────────────────────┐
│  DETECTION CORE (detectors/*) │   │  PERSISTENCE                        │
│  Graph heuristics (4)         │   │  SQLAlchemy ORM → SQLite/PostgreSQL │
│  Behavioural · Temporal       │   │  (alembic migrations)               │
│  Community · Centrality …     │   │  evidence_storage/ (datasets, docs) │
│  ML anomalies (IF/LOF/DBSCAN) │   │  models_artifacts/ (.pt DC-LCG)     │
│  Pattern suite (15)           │   └─────────────────────────────────────┘
│  Hybrid engine (0–100 fuse)   │
│  DC-LCG GNN (PyTorch)         │
└───────────────────────────────┘
```

### Governed Workflow (Request Lifecycle)

```
 CLIENT                    ADMIN                      TRACELAB                  INVOSPACE
   │  submit request         │                          │                         │
   │  + dataset upload       │ accept / reject          │                         │
   ├────────────────────────►│ assign to workspace      │                         │
   │                         ├─────────────────────────►│ validate dataset        │
   │                         │                          │ run /analyze/advanced   │
   │                         │                          │  → hybrid + DC-LCG      │
   │                         │                          │  → 15-pattern suite     │
   │                         │                          │  → auto-stored DRAFT    │
   │                         │                          │    technical report     │
   │                         │                          │ escalate alerts ───────►│ convert to case
   │                         │                          │                         │ evidence · notes
   │                         │◄─────────────────────────┼─────────────────────────┤ hypotheses · findings
   │                         │ review report            │                         │ investigation report
   │                         │ approve + SHA-256 seal   │                         │
   │◄────────────────────────┤ release final report     │                         │
   │  download sealed PDF    │                          │                         │
```

Every transition is appended to `activity_timeline` and `audit_logs`; only sealed reports are client-visible.

### Analysis Pipeline Data Flow

```
CSV/XLSX upload
   │
   ▼
parse_csv() ──► TransactionGraph (NetworkX DiGraph)
   │
   ▼
┌────────────────────────── detectors ──────────────────────────┐
│ cycle · fan · layering · burst          (topology signals)    │
│ account_profile · temporal · velocity   (behavioural/time)    │
│ community · centrality · motifs · kcore (structure)           │
│ ml_anomaly: IF / LOF / DBSCAN           (unsupervised)        │
│ dclcg inference (optional artifact)     (supervised GNN prob) │
└──────────────────────────────┬────────────────────────────────┘
                               ▼
                     HYBRID ENGINE (weighted 0–100)
                     base 5-dim  OR  6-dim with DC-LCG
                               ▼
        result = {summary, hybrid_scores[], breakdowns, rings,
                  patterns?, dclcg?}  ── stored on AnalysisJob.meta["_result"]
                               ▼
        ┌──────────────────────┼───────────────────────┐
        ▼                      ▼                       ▼
  auto-stored DRAFT     alerts (risk ≥ 70)     frontend panels
  TechnicalReport                              (graph / patterns / intel)
```

### DC-LCG Train ↔ Score Loop

```
labeled CSV ──► POST /dclcg/train ──► train.py (dual-view forward,
                                      BCE loss, AdamW)
                                        │ save versioned .pt
                                        ▼
                                models_artifacts/<name>_v<n>.pt
                                        │ registry.py load
                                        ▼
POST /analyze/advanced (use_dclcg=true) ──► inference.py
    per-account illicit_prob · disguise score · pruned paths
    ──► fused as 6th hybrid dimension + analyst explanations
```

---

## 📁 Repository Structure

```
d:/rift/
├── backend/                       # FastAPI Python backend
│   ├── main.py                    # Application entrypoint, CORS, route registration
│   ├── requirements.txt           # Python dependencies
│   ├── vercel.json                # Vercel serverless deployment config
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py            # /auth/login, /auth/register, /auth/me
│   │   │   ├── audit.py           # /audit/logs, /audit/stats
│   │   │   ├── analysis.py        # /analyze/advanced (+ auto-stored technical reports)
│   │   │   ├── graph.py           # /graph/* endpoints
│   │   │   ├── cases.py           # /cases/* case management
│   │   │   ├── patterns.py        # /patterns/analyze — 15-pattern suite (CSV/XLSX or stored job)
│   │   │   ├── dclcg.py           # /dclcg/models registry + /dclcg/train (labeled CSV)
│   │   │   └── intel.py           # /intel/accounts/{id}/overview|similar|paths
│   │   └── deps.py                # JWT auth dependency injection
│   ├── detectors/                 # Core fraud detection algorithms
│   │   ├── dclcg/                 # DC-LCG dual-view GNN package (PyTorch)
│   │   │   ├── value_encoder.py   # Transaction value embeddings
│   │   │   ├── model.py           # Local grouping view + pruned random-walk context transformer
│   │   │   ├── train.py           # Supervised / weak-heuristic training loop
│   │   │   ├── inference.py       # Scoring: illicit prob, disguise score, pruned evidence paths
│   │   │   └── registry.py        # Versioned model artifact save/load (.pt in models_artifacts/)
│   │   ├── cycle.py               # DFS cycle detection (fraud rings)
│   │   ├── fan.py                 # Fan-In / Fan-Out hub detection
│   │   ├── layering.py            # Layering shell chain detection
│   │   ├── burst.py               # Burst activity detection
│   │   ├── score.py               # Multi-heuristic scoring engine
│   │   ├── ml_anomaly.py          # Isolation Forest, LOF, DBSCAN
│   │   ├── account_profile.py     # Structural feature extraction per account
│   │   ├── temporal.py            # Time-series pattern analysis
│   │   ├── velocity.py            # Transaction velocity calculations
│   │   ├── centrality.py          # Graph centrality metrics
│   │   ├── community.py           # Community detection (Louvain)
│   │   ├── motifs.py              # Network motif detection
│   │   ├── paths.py               # Path analysis
│   │   ├── bridges.py             # Bridge edge detection
│   │   ├── kcore.py               # K-core decomposition
│   │   ├── components.py          # Weakly/Strongly connected components
│   │   ├── amount_patterns.py     # Amount structuring detection
│   │   ├── repeat.py              # Repeat transaction pattern detection
│   │   ├── risk_propagation.py    # Risk score propagation through graph
│   │   ├── risk_propagation.py    # Risk score propagation through graph
│   │   ├── pattern_suite.py       # 15-pattern orchestrator (basic / intermediate / advanced ML)
│   │   └── hybrid_engine.py       # Combined heuristic + ML + DC-LCG scoring pipeline
│   ├── models/                    # SQLAlchemy ORM models
│   ├── schemas/                   # Pydantic request/response schemas
│   ├── services/                  # Business logic services (auth, audit)
│   ├── utils/
│   │   ├── csv_parser.py          # CSV → TransactionGraph converter
│   │   ├── graph.py               # TransactionGraph data structure
│   │   └── synthetic.py          # Synthetic dataset generator
│   ├── db/
│   │   └── database.py            # SQLAlchemy engine, session factory
│   └── config/                    # Settings and environment configuration
│
├── money-muling-frontend/         # React + Vite frontend
│   ├── index.html
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx                # Route definitions
│   │   ├── main.jsx               # React DOM entry
│   │   ├── assets/
│   │   │   ├── landing.css        # Landing page 3D/glassmorphic styles
│   │   │   ├── sidebar.css        # App shell, sidebar, stat-cards, panels
│   │   │   └── theme.css          # Global dark theme overrides
│   │   ├── components/
│   │   │   ├── auth/              # LoginCard, ProtectedRoute
│   │   │   ├── dashboard/         # Dashboard, GraphPanel, UploadCard, MetricsBar, FraudRingTable, Navbar, SampleGenerator
│   │   │   ├── layout/            # AppLayout (sidebar shell), Sidebar
│   │   │   ├── pages/             # OverviewPage, GraphViewer, CommunitiesPage, RiskMapPage, TimelinePage, StatisticsPage, ReportsPage, CasesPage, AnalystPatternsPage, InvestigatorIntelPage, LandingPage
│   │   │   ├── profile/           # ProfilePage
│   │   │   ├── audit/             # AuditHistory
│   │   │   └── settings/          # SettingsPage
│   │   ├── context/
│   │   │   ├── AuthContext.jsx    # JWT auth state, login/logout
│   │   │   └── AnalysisContext.jsx # Analysis results global state
│   │   └── services/
│   │       └── api.js             # Axios instance, base URL, token injection
│
├── temp/                          # Developer notes and presentation docs
├── review.txt                     # Production readiness review
├── tech.txt                       # Technical architecture document
└── README.md                      # This file
```

---

## 🔬 Detection Engine — Analysis Layer

### 1. Cycle Detection (`detectors/cycle.py`)
Finds **circular money flows** using recursive DFS with lexicographic pruning to eliminate duplicate cycle reports. Searches paths of length 3–4 hops (configurable).

```
A → B → C → A  (3-hop fraud ring)
```

**Score weight: 40 points**

### 2. Fan-In / Fan-Out Detection (`detectors/fan.py`)
Identifies accounts acting as **aggregation hubs** (Fan-In) or **disbursement hubs** (Fan-Out) based on configurable degree thresholds and temporal sliding windows.

```
[A, B, C, D] → HUB → [E, F, G, H]   (Fan-In then Fan-Out)
```

**Score weight: 25 points**

### 3. Layering Chain Detection (`detectors/layering.py`)
Traces **shell account chains** — recursive paths through low-degree pass-through nodes that are used to obscure the money trail. Finds source → shell₁ → shell₂ → ... → target structures.

**Score weight: 20 points**

### 4. Burst Activity Detection (`detectors/burst.py`)
Detects **dormancy-followed-by-surge** patterns. Accounts with ≤3 transactions in the prior 180 days that suddenly execute ≥10 transfers within a 72-hour window are flagged as money mule activations.

**Score weight: 25 points**

### 5. ML Anomaly Detection (`detectors/ml_anomaly.py`)
Three unsupervised ML models run concurrently on per-account behavioral feature vectors (11 features: total_sent, total_received, net_flow, tx_count, unique_receivers, pass_through_ratio, etc.):

| Model | Method | Description |
|-------|--------|-------------|
| **Isolation Forest** | Ensemble | Flags accounts isolated quickly in random decision trees (anomalies) |
| **Local Outlier Factor** | Density | Flags accounts in sparse regions of the behavioral feature space |
| **DBSCAN** | Clustering | Accounts labeled as noise (-1) cluster are structural anomalies |

### 6. Suspicion Scoring (`detectors/score.py`)

```
Score = Σ(pattern_weights) + min(20, 5 × ring_count)
Score = min(Score, 100)
```

| Pattern | Weight |
|---------|--------|
| Cycle | 40 |
| Fan-In/Out | 25 |
| Burst | 25 |
| Layering | 20 |
| Multi-ring bonus | +5/ring (max 20) |

> This is the base heuristic layer. The advanced pipeline (`/analyze/advanced`) fuses all signals through the hybrid engine below.

### 7. Hybrid Engine (`detectors/hybrid_engine.py`)
Weighted fusion of every detector family into one 0–100 score plus a per-dimension breakdown:

| Dimension | Weight (base) | Weight (with DC-LCG) |
|-----------|--------------|---------------------|
| Graph heuristics | 0.35 | 0.30 |
| Behavioural | 0.20 | 0.17 |
| Temporal | 0.15 | 0.12 |
| Community | 0.10 | 0.08 |
| ML anomaly | 0.20 | 0.13 |
| DC-LCG GNN | — | 0.20 |

When a trained DC-LCG artifact is available (and `use_dclcg=true`, the default), its per-account illicit probability joins the blend as a sixth supervised dimension; otherwise the engine degrades gracefully to the base weights.

### 8. 15-Pattern Suite (`detectors/pattern_suite.py`)
One orchestrated pass over the transaction graph returning 15 uniform result blocks, exposed to analysts via `POST /patterns/analyze` (CSV/Excel upload or re-run of any stored analysis job):

| Tier | Patterns |
|------|----------|
| **Basic** | Circular transaction · Fan-in hub · Fan-out hub · Burst activity · Structuring (smurfing) |
| **Intermediate / Hard** | Layering shells · Rapid movement (velocity chains) · Night-window activity · Periodic bot-like transfers · Dormant-account activation |
| **Advanced ML** | DC-LCG GNN scores · Isolation Forest · LOF · DBSCAN noise · Risk-propagation hotspots |

Each block reports `flagged_count`, up to 50 flagged accounts with per-pattern details (e.g., cycle membership, shell depth, night-window ratio, periodicity confidence), and runtime.

### 9. DC-LCG Dual-View GNN (`detectors/dclcg/`)
The implemented basepaper model: a **D**ual-**C**ontext **L**earned **C**lassification **G**raph network trained on labeled transaction CSVs (or weak-supervised heuristics when no labels exist).

- **Local view** — soft-label propagation over immediate neighbourhoods with degree-normalized weight sums.
- **Contextual view** — pruned random-walk transformer over multi-hop paths for long-range evidence.
- **Mutual attention fusion** — both views gate each other before classification.
- **Outputs per account** — illicit probability, disguise (camouflage) score, top pruned evidence paths used in analyst explanations.
- **Registry** — versioned `.pt` artifacts under `backend/models_artifacts/`, listed via `GET /dclcg/models`, trained via `POST /dclcg/train`.

Reference results on the synthetic benchmark: F1 = AUC = AP = 1.0 (epochs ≥ 25).

---

## 🗄️ Workflow Schema

```sql
- organizations / roles / users          — tenancy and RBAC
- service_requests                       — client submissions, status, dataset_path
- workflow_instances                     — lifecycle across admin/TraceLab/InvoSpace/release
- activity_timeline + audit_logs         — every transition, handoff and access
- assignments                            — ownership changes and due dates
- analysis_jobs                          — per-run status, filename, meta (stored result, SR link)
- alerts                                 — analyst escalations with risk scores
- cases                                  — investigator workspace (from alerts)
- case_events · evidence · investigation_notes/hypotheses/tasks/findings/reports
- technical_reports (+ report_version)   — auto-stored drafts → review → seal → release
- messages · notifications               — cross-workspace communication
```

> **Note:** The workflow foundation persists service requests, workflow instances, alerts, cases, reports (technical + investigation), assignments, and timeline events. Analysis results are additionally persisted on each `AnalysisJob` (`meta["_result"]`) so the Intel Hub can serve dossiers, similar accounts and money paths without re-analysis.

---

## 🖥️ Frontend — Pages & Components

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `LandingPage` | TraceAcc Pro product and workflow overview |
| `/login` | `LoginCard` | Enterprise sign-in and workspace routing |
| `/overview` | `OverviewPage` | Stat cards + recent analysis jobs table |
| `/dashboard` | `Dashboard` | CSV upload, analysis trigger, graph panel |
| `/graph-viewer` | `GraphViewer` | Full-screen Cytoscape interactive graph |
| `/communities` | `CommunitiesPage` | Community cluster visualization |
| `/risk-map` | `RiskMapPage` | Account risk heatmap |
| `/timeline` | `TimelinePage` | Temporal transaction timeline |
| `/statistics` | `StatisticsPage` | Quantitative distribution charts |
| `/reports` | `ReportsPage` | Export-ready analyst reports |
| `/cases` | `CasesPage` | Case management and triage |
| `/tracelab/patterns` | `AnalystPatternsPage` | 15-pattern suite run + tier-grouped results (analyst/admin) |
| `/invospace/intel` | `InvestigatorIntelPage` | Intel Hub: account dossiers, similar accounts, money paths (investigator) |
### Workflow Coverage

- Client request submission
- Admin acceptance, rejection, and assignment
- TraceLab analysis and alert generation
- InvoSpace case handling and investigation reports
- Admin report review and client release

---

## 🧪 Validation

Backend regression coverage lives in `backend/tests/`:

- `test_workflow_foundation.py` — request creation, alert escalation, case handoff, report release.
- `test_dclcg.py` — DC-LCG model round-trip (NaN-safe forward on isolated nodes), `/dclcg` API + RBAC, 15-pattern suite endpoint (+ Excel upload, client rejection), and auto-storage of analysis results into technical reports.

---
| `/audit-history` | `AuditHistory` | Complete audit log viewer |
| `/profile` | `ProfilePage` | Analyst user profile |
| `/settings` | `SettingsPage` | Heuristic threshold configuration |
| `/sample-generator` | `SampleGenerator` | Synthetic dataset generator with presets |

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend Framework** | FastAPI 2.0 + Uvicorn |
| **Graph Processing** | NetworkX (in-memory directed graph) |
| **Machine Learning** | scikit-learn (Isolation Forest, LOF, DBSCAN) · PyTorch (DC-LCG dual-view GNN) |
| **ORM & Database** | SQLAlchemy + PostgreSQL (Supabase) / SQLite fallback |
| **Auth** | JWT (python-jose) + bcrypt (passlib) |
| **CSV Processing** | Python csv module + pandas |
| **Frontend** | React 18 + Vite |
| **Graph Visualization** | Cytoscape.js |
| **UI Components** | React-Bootstrap + custom glassmorphic CSS |
| **HTTP Client** | Axios |
| **Routing** | React Router v6 |
| **Fonts** | Inter, Outfit (Google Fonts) |

---

## 🚀 Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL (or use the SQLite fallback)

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in `backend/`:
```env
DATABASE_URL=postgresql+psycopg://user:password@host/dbname
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRY_MINUTES=120
```

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Frontend

```bash
cd money-muling-frontend
npm install
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

---

## 📊 CSV Format

The analysis engine expects a CSV (Excel `.xlsx` also supported) with the following columns:

```csv
sender_id,receiver_id,amount,timestamp
ACC_001,ACC_002,1500.00,2024-01-15 10:30:00
ACC_002,ACC_003,1490.00,2024-01-15 11:00:00
ACC_003,ACC_001,1480.00,2024-01-15 11:30:00
```

| Column | Type | Description |
|--------|------|-------------|
| `sender_id` | string | Source account identifier |
| `receiver_id` | string | Destination account identifier |
| `amount` | float | Transaction amount |
| `timestamp` | datetime | ISO 8601 or common datetime string |

**DC-LCG training CSVs** may additionally include a label column (`label`, `class`, `is_fraud`, or `illicit`) — `1`/`illicit` for known mules, `0` otherwise. Datasets without labels fall back to weak heuristic supervision.

---

## 🔒 Security Notes

- JWT tokens are stored in `localStorage`. For production, use secure `HttpOnly` cookies.
- Rate limiting on `/auth/login` is recommended (e.g., SlowAPI or Redis limiter).
- File size limit on `/analyze` (recommend ≤10MB) should be enforced.
- The `.env` file must **never** be committed to version control.

---

## 🗺️ Roadmap (v3 Production)

- [x] **GNN classifier** — ✅ Shipped as the DC-LCG dual-view graph neural network (trainable via `/dclcg/train`, fused into `/analyze/advanced`)
- [ ] **Celery + Redis** — Offload graph analysis to background workers
- [ ] **WebSocket progress** — Real-time analysis progress streaming to UI
- [ ] **Transaction persistence** — Store accounts, transactions, rings in PostgreSQL
- [ ] **Neo4j integration** — Replace in-memory NetworkX with a production graph database
- [ ] **GNN scaling (GraphSAGE / GCN)** — Extend DC-LCG with neighbour-sampling variants and GPU training for larger graphs
- [ ] **Docker Compose** — One-command local setup
- [ ] **API versioning** — `/api/v1/` prefix
- [ ] **Kafka ingestion** — Real-time transaction stream processing

---

## 👨‍💻 Author

**Sunil**

Project: RIFT 2026 — Graph Theory & Financial Fraud Detection Track  
Stack: FastAPI · React · NetworkX · Cytoscape.js · scikit-learn · PostgreSQL

---

## 📚 Interview & Career Resources
*Auto-generated study guides based on this project's architecture.*
- **[Master Interview Guide](file:///d:/rift/temp/Master_Interview_Guide.md):** Complete technical breakdown, architecture analysis, and simulated interview Q&A.
- **[Resume Action Points](file:///d:/rift/temp/Resume_Points.md):** High-impact bullet points utilizing the XYZ formula for your CV.
