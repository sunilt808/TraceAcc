# TraceAcc Pro — Enterprise AML Operations Platform
> **Admin-centered workflow platform for client intake, TraceLab analysis, InvoSpace investigation, and governed client release**

[![FastAPI](https://img.shields.io/badge/FastAPI-2.0-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://reactjs.org)
[![NetworkX](https://img.shields.io/badge/NetworkX-Graph-orange?style=flat)](https://networkx.org)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-ML-F7931E?style=flat&logo=scikit-learn)](https://scikit-learn.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=flat&logo=postgresql)](https://supabase.com)

---

## 🧠 What Is This?

**TraceAcc Pro** is an AML operations platform that keeps the client, technical analysis, investigation, and release stages separated but connected through one governed workflow.

- **Admin Workspace** receives client requests, routes work, tracks progress, and reviews reports before release.
- **TraceLab** performs technical AML analysis, generates findings, and creates alerts only.
- **InvoSpace** receives escalations, owns cases, collects evidence, and produces final investigation reports.
- **Client Portal** submits requests and downloads only approved final reports.

The platform still uses graph analytics, heuristics, and risk scoring, but those outputs now feed a workflow chain instead of existing as a standalone demo.

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
│   │   │   ├── analysis.py        # /analyze/jobs (job history)
│   │   │   ├── graph.py           # /graph/* endpoints
│   │   │   └── cases.py           # /cases/* case management
│   │   └── deps.py                # JWT auth dependency injection
│   ├── detectors/                 # Core fraud detection algorithms
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
│   │   └── hybrid_engine.py       # Combined heuristic + ML scoring pipeline
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
│   │   │   ├── pages/             # OverviewPage, GraphViewer, CommunitiesPage, RiskMapPage, TimelinePage, StatisticsPage, ReportsPage, CasesPage, LandingPage
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

---

## 🗄️ Workflow Schema

```sql
- service_requests track client submissions and status
- workflow_instances track the lifecycle across admin, TraceLab, InvoSpace, and report release
- activity_timeline records every workflow transition and handoff
- assignments track ownership changes and due dates
- client_reports track draft, review, approval, and release states
```

> **Note:** The workflow foundation now persists service requests, workflow instances, alerts, cases, reports, assignments, and timeline events. The detection layer still remains stateless per uploaded dataset.

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
### Workflow Coverage

- Client request submission
- Admin acceptance, rejection, and assignment
- TraceLab analysis and alert generation
- InvoSpace case handling and investigation reports
- Admin report review and client release

---

## 🧪 Validation

Backend workflow regression coverage lives in `backend/tests/test_workflow_foundation.py` and now covers request creation, alert escalation, case handoff, and report release.

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
| **Machine Learning** | scikit-learn (Isolation Forest, LOF, DBSCAN) |
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

The system expects a CSV with the following columns:

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

---

## 🔒 Security Notes

- JWT tokens are stored in `localStorage`. For production, use secure `HttpOnly` cookies.
- Rate limiting on `/auth/login` is recommended (e.g., SlowAPI or Redis limiter).
- File size limit on `/analyze` (recommend ≤10MB) should be enforced.
- The `.env` file must **never** be committed to version control.

---

## 🗺️ Roadmap (v3 Production)

- [ ] **Celery + Redis** — Offload graph analysis to background workers
- [ ] **WebSocket progress** — Real-time analysis progress streaming to UI
- [ ] **Transaction persistence** — Store accounts, transactions, rings in PostgreSQL
- [ ] **Neo4j integration** — Replace in-memory NetworkX with a production graph database
- [ ] **GNN classifier** — Graph Neural Network for probability-based mule prediction
- [ ] **Docker Compose** — One-command local setup
- [ ] **API versioning** — `/api/v1/` prefix
- [ ] **Kafka ingestion** — Real-time transaction stream processing

---

## 👨‍💻 Author

**Sunil** — Final Year CSE Student  
Project: RIFT 2026 — Graph Theory & Financial Fraud Detection Track  
Stack: FastAPI · React · NetworkX · Cytoscape.js · scikit-learn · PostgreSQL

---

## 📚 Interview & Career Resources
*Auto-generated study guides based on this project's architecture.*
- **[Master Interview Guide](file:///d:/rift/temp/Master_Interview_Guide.md):** Complete technical breakdown, architecture analysis, and simulated interview Q&A.
- **[Resume Action Points](file:///d:/rift/temp/Resume_Points.md):** High-impact bullet points utilizing the XYZ formula for your CV.
