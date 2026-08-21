# TraceAcc Pro — Codebase Overview & Workflow Completion Status

## Summary
TraceAcc Pro is an enterprise AML (Anti-Money Laundering) / money-mule detection operations platform built as a final-year academic project (RIFT 2026 — Graph Theory & Financial Fraud Detection track). It combines a heuristic+ML graph detection engine with a governed 4-workspace business workflow: **Client Portal** (request intake), **Admin Workspace** (routing/review/release), **TraceLab** (analyst technical analysis), and **InvoSpace** (investigator case work). The user's current state: **Admin and Client workflows are finished; TraceLab (Analyst) and InvoSpace (Investigator) workflows still need implementation work**. The base paper (`basepaper.pdf`) is *"Exposing Disguises and Tracing Illicit Flows: Dual-View Graph Representation Learning for Money Laundering Detection" (DC-LCG, IEEE TCSS 2026)* — it informs the detection-engine roadmap, not the workflow layer.

---

## 1. Architecture

- **Pattern**: Decoupled monolith — FastAPI REST backend + React SPA frontend, multi-tenant via `organization_id` scoping on every table.
- **Backend**: Python 3.10+, FastAPI, SQLAlchemy ORM, PostgreSQL (Supabase) with SQLite fallback (`app.db` at root), JWT auth (python-jose HS256), bcrypt/passlib hashing.
- **Frontend**: React 19 + Vite 7, React Router v7, React-Bootstrap, Cytoscape.js (graph viz), Recharts, Axios, framer-motion, lucide icons.
- **Detection engine**: Stateless in-memory NetworkX pipeline — 4 core detectors (cycle/fan/layering/burst) + ~15 extended detectors (centrality, community/Louvain, k-core, bridges, motifs, temporal, velocity, amount patterns, repeat pairs, ML anomaly via IsolationForest/LOF/DBSCAN, risk propagation) fused by `hybrid_engine.py` (weights: graph=0.35, behaviour=0.20, temporal=0.15, community=0.10, ml=0.20).
- **Entry points**: `backend/main.py` (registers 14 routers + legacy `/analyze` + `/sample-generator`); `money-muling-frontend/src/main.jsx` → `App.jsx` (route map).

### Roles (DB string values — do NOT rename)
| DB role | Operational name | Workspace |
|---|---|---|
| `CLIENT_USER` | Client | Client Portal |
| `ADMIN` (+legacy `SUPER_ADMIN`) | Admin | Admin Hub + can enter TraceLab/InvoSpace |
| `TRACE_LAB_ANALYST` | Analyst | TraceLab |
| `INVESTIGATOR` | Investigator | InvoSpace |

---

## 2. The Governed Workflow (core of the app)

### State machine (documented on `models/service_request.py`)
```
SUBMITTED → UNDER_REVIEW → NEEDS_INFORMATION → APPROVED →
ASSIGNED_ANALYST | ASSIGNED_INVOSPACE →
ANALYSIS_IN_PROGRESS | INVESTIGATION_IN_PROGRESS →
ALERT_ESCALATED → REPORT_SUBMITTED → ADMIN_REVIEW → REVISION_REQUIRED →
APPROVED → RELEASED | CLOSED | REJECTED
```

### Entity chain (who creates what)
1. **Client** submits `ServiceRequest` (+ optional dataset upload) → auto-creates `WorkflowInstance` (status SUBMITTED, stage REQUEST_CREATED) + first `ActivityTimeline` event.
2. **Admin** reviews via `PATCH /admin/service-requests/{id}/review` with action ∈ {ACCEPT, REJECT, ASSIGN_TRACELAB, ASSIGN_INVOSPACE, REASSIGN} → sets `assigned_to_id`, status IN_PROGRESS, workflow stage TRACE_LAB or INVOSPACE, records `Assignment` row.
3. **Analyst (TraceLab)** runs analysis (`POST /analyze`, `/analyze/advanced`), which persists an `AnalysisJob`; `/analyze/advanced` auto-generates `Alert`s for hybrid score ≥ 70. Analyst triages alerts and **escalates to Admin only** (`POST /alerts/{id}/escalate`). Analyst may create/upload a technical `ClientReport` and submit-for-review.
4. **Admin** routes an ESCALATED alert to an investigator (`PATCH /alerts/{id}/assign` requires `alert.route_to_invospace`).
5. **Investigator (InvoSpace)** — ONLY role allowed to create `Case`s (per model docstring). Case links to alert/service_request/workflow. Investigator adds Evidence, Hypotheses, Tasks, Findings, Notes; records decision (NO_SUSPICION/SUSPICIOUS_ACTIVITY/ESCALATE/INSUFFICIENT_INFORMATION/INCONCLUSIVE); produces investigation report.
6. **Admin** reviews reports (`PATCH /admin/reports/{id}/review`: APPROVE / REQUEST_CHANGES / REJECT / RELEASE). RELEASE requires APPROVED status + uploaded file → workflow closes at REPORT_RELEASED. There is also a digital-sign endpoint `POST /reports/{id}/sign` (sets SIGNED status + placeholder hash `SIGNED-BY-{uid}-{rid}`).
7. **Client** sees only `is_released=True` reports and downloads them.

Every transition writes to `ActivityTimeline` (workflow-level audit) and/or `CaseEvent` (case-level audit).

---

## 3. Completion Status by Workspace

### ✅ DONE — Client Portal
- `ClientPortal.jsx` (my requests), `ClientRequestForm.jsx` (create request), `ClientReportsPage.jsx` (released reports only).
- Backend: `/service-requests` CRUD scoped so CLIENT sees only own rows; dataset upload; released-report download.

### ✅ DONE — Admin Workspace
- `AdminDashboard.jsx` (stats from `/admin/dashboard`), `AdminUsersPage.jsx` (user CRUD), `AdminOrgsPage.jsx` (org approval — ADMIN can approve PENDING orgs), `AdminRequestsPage.jsx` (request queue + review actions), `AdminReportsPage.jsx` (report review queue), `AdminOperationsPage.jsx` (operations queue).
- Backend `/admin/*` is complete: users CRUD (role-gated creation rules), orgs, request queue with grouped counts, report review, operations feed.

### 🔶 PARTIAL — TraceLab (Analyst) — REMAINING WORK
Backend exists but frontend wiring is incomplete/inconsistent:
1. **OverviewPage is generic** — shows analysis jobs + audit stats, not workflow-aware. Needs "My Assigned Requests" panel (analyst has `request.view_assigned` but there is **no endpoint that filters service requests by assignee** — `GET /service-requests` returns all org requests for internal users; needs `?assigned_to_me=true` or similar).
2. **Dashboard analysis is disconnected from workflow** — `Dashboard.jsx` posts to legacy `/analyze` which does NOT persist an AnalysisJob nor create Alerts. Only `/analyze/advanced` persists jobs + auto-alerts (score ≥70). Dashboard should use `/analyze/advanced` and offer "attach result to ServiceRequest".
3. **AlertsPage escalate redirect is wrong** — after escalating it navigates to `/cases?id={res.case_id}`, but escalation goes to *Admin*, not to a case (escalate endpoint returns the alert dict, no case_id). Also uses old statuses TRIAGED/FALSE_POSITIVE while `alerts.py` VALID_STATUSES = {NEW, TRIAGED, FALSE_POSITIVE, ESCALATED} vs model docstring {NEW, UNDER_REVIEW, ESCALATED, CONVERTED_TO_CASE, DISMISSED, CLOSED} — status vocabulary mismatch to reconcile.
4. **Technical report flow missing UI** — permissions `technical_report.create/submit` exist; `/reports` create + upload + submit-for-review endpoints exist; ReportsPage needs a "submit technical report for this request" flow tied to the assigned ServiceRequest.
5. **Dataset validation UI** — `/datasets` create/validate exists (validation is mocked: hardcodes 1000/998/2 counts); no frontend page calls it.

### 🔶 PARTIAL — InvoSpace (Investigator) — REMAINING WORK
1. **Case creation lacks linkage fields** — `CasesPage.jsx` create form sends only title/description/priority/notes. Backend `CaseCreate` accepts `workflow_instance_id`, `linked_accounts`, `linked_rings`, `analysis_job_id` but **not `alert_id` or `service_request_id`**, even though the `Case` model HAS both columns. Gap: add these to schema + form so cases can be created from routed alerts ("Convert Alert → Case" action).
2. **CaseDetail missing investigation artifacts tabs** — backend exposes POST `/cases/{id}/hypotheses`, `/tasks`, `/findings` (and notes) but there are **no GET/list endpoints** for hypotheses/tasks/findings, and the UI has none. Need list endpoints + tabs.
3. **Decision recording absent in UI** — backend supports `decision` ∈ {NO_ACTION, SAR_FILED, REFERRED_TO_LAW_ENFORCEMENT, MONITORING} via PATCH (note: model docstring lists a different set NO_SUSPICION/SUSPICIOUS_ACTIVITY/... — another vocabulary mismatch), plus `investigation_risk_score` reassessment. No UI.
4. **CasesPage DELETE button violates immutability principle** (rev.txt explicitly flags case deletion as regulator-noncompliant) and there's no DELETE route in `cases.py` anyway → the button will 405. Remove it.
5. **Investigation report generation flow** — investigator should produce the final report (create ClientReport with report_type INVESTIGATION, upload file, submit-for-review). Permissions exist; UI flow doesn't.
6. **Evidence works** (upload/list/download wired in CaseDetail) ✅.

---

## 4. Known Issues (from `isssues.task` + code findings)
1. **"All APIs failing"** — likely causes found: frontend `API_BASE = 'http://127.0.0.1:8000'` hardcoded in `services/api.js` (breaks deployed backend); CORS regex only allows localhost origins; download URLs append `?token=` query param but backend reads Bearer header only (report/evidence downloads will 401 when opened via `<a href>`).
2. **Role-based route restriction** — `App.jsx` RoleRoute + Sidebar filtering already implement per-role pages; the remaining gap is data-level: OverviewPage etc. fetch org-wide endpoints regardless of role.
3. **Stats calculations** — admin dashboard counts are simple `.count()` queries; `grouped[request.status]` in request_queue will KeyError if a status outside the 5 keys appears (uses `.get` fallback actually — safe); OverviewPage caps jobs display at 5.
4. **Digital signature badge before client release** — `POST /reports/{id}/sign` exists with placeholder hash; needs real signing (e.g., SHA-256 over report content + signer id + timestamp) and a badge UI in AdminReportsPage/ClientReportsPage.

---

## 5. Base Paper (DC-LCG) — Relationship to This Codebase
The base paper proposes a **dual-view GNN** for money-laundering detection:
- **Local view**: soft-label-guided dynamic grouping/aggregation — separates neighbors into illicit/licit groups using predicted probabilities, probability-weighted intragroup aggregation + attention intergroup fusion → defeats camouflaged nodes that connect to many licit accounts (homophily violation).
- **Contextual view**: random-walk path generation → soft-label-similarity dynamic path pruning → transformer-based multipath semantic fusion → captures multihop illicit fund flows (>70% of illicit nodes propagate ≥2 hops on Elliptic).
- **Mutual attention fusion** merges both views; focal loss handles class imbalance; iterative soft-label updates.
- Results: F1 92.0 (Elliptic), 85.45 (RD), 89.97 (T-Finance) — beats DGT+XGBoost, MLaD², Care-GNN, PC-GNN baselines.

**Current engine vs paper**: The implemented detectors are rule/heuristic + classical ML (IsolationForest/LOF/DBSCAN) — they detect the same phenomena the paper targets (cycles ≈ illicit rings, layering ≈ multihop paths, fan ≈ hub disguise, burst ≈ activation) but without learned representations. The README roadmap item "**GNN classifier — Graph Neural Network for probability-based mule prediction**" is where DC-LCG fits: it would replace/augment `ml_anomaly.py` + `hybrid_engine.py`. Practical integration point: train offline on labeled datasets (Elliptic/RD/T-Finance), serve scores per account through the same `AnalysisJob`→`Alert` pipeline; the dual-view outputs (local camouflaging score + contextual path score) map naturally onto two new detector entries in the hybrid weight vector.

---

## 6. Directory Structure (annotated)
```
d:/rift/
├── backend/
│   ├── main.py                  # App entry; CORS; legacy /analyze + /sample-generator
│   ├── api/
│   │   ├── deps.py              # Bearer auth, get_current_workspace (X-Organization-Id), RoleChecker
│   │   └── routes/
│   │       ├── auth.py          # login/register/me/change-password/client-register
│   │       ├── admin.py         # users/orgs/request-queue/report-queue/operations/dashboard
│   │       ├── service_requests.py  # client intake + workflow instance creation
│   │       ├── workflow.py      # transitions/assign/timeline on WorkflowInstance
│   │       ├── alerts.py        # list/triage/assign(route)/escalate/create
│   │       ├── cases.py         # case CRUD + assign + notes + hypotheses/tasks/findings (POST-only)
│   │       ├── evidence.py      # case evidence upload/list/download
│   │       ├── reports.py       # ClientReport create/upload/sign/approve/release/download
│   │       ├── analysis.py      # /analyze/advanced (all detectors + job persist + auto-alerts), /analyze/jobs
│   │       ├── datasets.py      # dataset upload + mock validation
│   │       ├── messages.py      # client↔admin messaging
│   │       └── notifications.py # per-user notification list/read
│   ├── core/permissions.py     # RBAC matrix — single source of truth
│   ├── models/                  # SQLAlchemy models (user, role, organization, service_request,
│   │                            #   workflow_instance, activity_timeline, assignment, alert, case,
│   │                            #   evidence, investigation_{hypothesis,task,finding,note,report},
│   │                            #   client_report, technical_report, report_version, analysis_job,
│   │                            #   dataset, transaction, message, notification, audit_log, case_event)
│   ├── detectors/               # cycle, fan, layering, burst, score + 15 extended + hybrid_engine
│   ├── services/                # auth_service, audit_service (log_event), storage_service (files)
│   ├── utils/                   # csv_parser, graph (TransactionGraph), synthetic generator
│   ├── alembic/versions/        # 5 migrations incl. phase_3_client_portal_and_gap_fixes
│   └── tests/                   # test_auth_rbac, test_admin_operations, test_tenant_isolation,
│                                #   test_workflow_foundation
├── money-muling-frontend/
│   └── src/
│       ├── App.jsx              # Full route map + workspace redirects (routeMap/adminWorkspacePaths)
│       ├── context/AuthContext  # JWT state, role normalization (CLIENT_USER→CLIENT, SUPER_ADMIN→ADMIN)
│       ├── services/api.js      # Axios instance + authAPI/casesAPI/alertsAPI/evidenceAPI/
│       │                        #   serviceRequestsAPI/adminAPI/reportsAPI
│       └── components/
│           ├── auth/            # LoginCard, ProtectedRoute, RoleRoute
│           ├── layout/          # AppLayout, Sidebar (role-filtered nav)
│           ├── pages/           # Landing, WorkspaceSelector, Client* (3), Admin* (6),
│           │                    #   Overview, GraphViewer, Communities, RiskMap, Timeline,
│           │                    #   Statistics, Reports, Cases, CaseDetail, Alerts
│           └── dashboard/       # Dashboard (analyze), UploadCard, GraphPanel, FraudRingTable,
│                                #   MetricsBar, SampleGenerator, Navbar
├── basepaper.pdf                # DC-LCG IEEE TCSS 2026 paper
├── doc/rev.txt                  # Principal-engineer architecture review + gap roadmap
└── isssues.task                 # Current sprint issue list
```

---

## 7. Key Abstractions

### WorkflowInstance (`models/workflow_instance.py`)
Single lifecycle spine per request/case/report. Links `service_request_id` OR `case_id` OR `report_id`; carries `current_status`, `current_stage`, owner/assignee. All handoffs mutate this row + append ActivityTimeline.

### ServiceRequest (`models/service_request.py`)
Client intake record. Has BOTH `assigned_analyst_id`/`assigned_invospace_id` (new) and legacy `assigned_to_id` — admin review currently writes only `assigned_to_id`. Statuses follow the controlled machine above.

### Alert (`models/alert.py`)
Created by ANALYST (or auto by `/analyze/advanced`). Escalation path: ANALYST escalates → ADMIN routes (`routed_by_id/routed_to_id`) → INVOSPACE converts to Case. Rich detection context JSON (`detection_reason`, related accounts/transactions/entities).

### Case (`models/case.py`)
INVESTIGATOR-only creation. Holds both `tracelab_risk_score` (never overwrite) and `investigation_risk_score` (reassessment). Decision fields + linked accounts/rings/alert/service_request/workflow.

### Permission system (`core/permissions.py`)
Dict-of-sets `_PERMISSIONS` keyed by canonical role; SUPER_ADMIN inherits ADMIN. Use `require_permission("x.y")` / `require_any_permission(...)` dependencies. NOTE: some routes still use raw `RoleChecker([...])` instead (admin.py, evidence.py, workflow.py) — two authorization styles coexist.

### Tenant isolation (`api/deps.get_current_workspace`)
Resolves org from user; SUPER_ADMIN may pass `X-Organization-Id` header to impersonate another tenant; everyone else is locked to own org (mismatched header → 403). Every list endpoint filters by org.

### Hybrid scoring (`detectors/hybrid_engine.py` + `score.py`)
Legacy weights: Cycle 40, Fan 25, Burst 25, Layering 20, +5/ring bonus (max 20), capped 100. Advanced: 5-dimension weighted fusion producing `hybrid_scores` used for auto-alert threshold (≥70 HIGH, ≥90 CRITICAL).

---

## 8. Non-Obvious Behaviors & Gotchas
- **Two parallel permission systems**: `RoleChecker` (role-list based, deps.py) vs `require_permission` (permission-string based, core/permissions.py). New code should use the latter.
- **Status vocabularies drift**: Alert statuses differ between model docstring, route validation, and frontend badges; Case decisions likewise. Pick one canon before building more UI.
- **`/analyze` (main.py) vs `/analyze/advanced` (analysis.py)**: only advanced persists jobs/alerts; Dashboard.jsx still calls legacy.
- **Escalation ≠ case creation**: analyst cannot create cases (permission `case.create` is INVOSPACE-only); CasesPage's "+ New Case" will 403 for analysts if ever rendered for them (currently hidden by sidebar roles, but App.jsx route allows ADMIN too — fine).
- **Report release requires file_path** — releasing without upload returns 400; sign endpoint is separate and currently cosmetic.
- **Downloads need Authorization header** — `downloadUrl()` helpers build plain URLs; browsers won't attach Bearer tokens → must fetch as blob with axios instead.
- **CORS allow_origin_regex** only matches localhost/127.0.0.1 any port — production frontend origin must be added.
- **Alembic migrations exist** but `init_db()` also runs `Base.metadata.create_all` — schema changes should go through alembic versions (5 present).
- **Storage**: `evidence_storage/` directory at repo root via StorageService.save_evidence(org_id, entity_id) — local-disk only.
- **Tests**: pytest suite covers auth/RBAC, admin ops, tenant isolation, workflow foundation — run before touching workflow routes.

---

## 9. Recommended Next Steps (Analyst + InvoSpace finish line)
**TraceLab**
1. Add `GET /service-requests?assigned_to_me=true` (or `/workbench/my-requests`) and a TraceLab workbench page listing assigned requests w/ stage.
2. Switch Dashboard to `/analyze/advanced`; after run, offer "Create Alert(s)" preview + "link to ServiceRequest".
3. Fix AlertsPage escalate UX (no case redirect; show "Escalated to Admin"); align status enums.
4. Technical report builder: create ClientReport(report_type=ANALYSIS, service_request_id) → upload PDF → submit-for-review.

**InvoSpace**
1. Extend `CaseCreate` with `alert_id`, `service_request_id`; add "Create Case from Alert" action on escalated/routed alerts.
2. Add GET endpoints for hypotheses/tasks/findings + CaseDetail tabs; wire note creation.
3. Decision panel (decision + reason + investigation_risk_score) → syncs workflow stage.
4. Investigation report flow (report_type=INVESTIGATION) → submit-for-review → Admin approves/releases.
5. Remove Delete-case button; enforce immutability.

**Cross-cutting**
- Replace hardcoded API_BASE with env var; fix download auth; extend CORS; implement real digital-signature hash + badge; unify status enums; add notifications on assignment/escalation (model exists, nothing writes Notification rows yet).

---

## 10. Suggested Reading Order
1. `backend/core/permissions.py` — the RBAC contract everything depends on.
2. `backend/models/service_request.py` + `workflow_instance.py` + `alert.py` + `case.py` docstrings — the workflow state machines.
3. `backend/api/routes/admin.py` — reference implementation of review/assignment patterns.
4. `backend/api/routes/analysis.py` — how detection results become persisted jobs + alerts.
5. `money-muling-frontend/src/App.jsx` — routing/workspace model.
6. `doc/rev.txt` — the gap analysis driving the transformation roadmap.
7. `basepaper.pdf` §IV — DC-LCG methodology for the future GNN upgrade.
