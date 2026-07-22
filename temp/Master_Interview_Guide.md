# TraceAcc: Master Interview Guide

## PART 1 — PROJECT OVERVIEW
**One-line project description:** An enterprise-grade Anti-Money Laundering (AML) platform using Graph Analytics, Heuristic Detection, and Unsupervised Machine Learning.
**Elevator pitch (30s):** TraceAcc converts raw transaction logs into directed graphs and applies ML models and heuristics to uncover complex fraud topologies like circular routing, layering, and burst activity, enabling banks to cut down manual investigation time by over 80%.
**Business problem:** Financial institutions struggle to detect multi-hop laundering and hidden shell networks using traditional rule-based SQL queries.
**Value proposition:** Moves away from simple threshold alerts to structural anomaly detection, catching sophisticated fraud rings that traditional systems miss.

## PART 2 — ARCHITECTURE
- **Frontend:** React 18 with Vite, using Cytoscape.js for interactive graph visualization.
- **Backend:** FastAPI (Python) for high-performance async endpoints. NetworkX handles in-memory graph processing.
- **Database:** PostgreSQL (via Supabase) with SQLAlchemy ORM.
- **Machine Learning:** Scikit-learn (Isolation Forest, LOF, DBSCAN) for unsupervised anomaly detection.

```text
CSV Upload -> FastAPI Backend -> Chunk Processing -> Feature Extraction -> Graph Analysis (NetworkX) + ML Models (Scikit) -> Risk Scoring -> PostgreSQL -> React Dashboard (Cytoscape.js)
```

## PART 3 — FEATURES
**Cycle Detection (Fraud Rings):** Uses recursive DFS to find circular money flows (e.g., A->B->C->A).
**Burst Activity:** Detects sudden surges in dormant accounts using temporal sliding windows.
**ML Anomaly Detection:** Extracts structural features (in-degree, out-degree, pass-through ratio) and runs Isolation Forest.

## PART 4 — DATABASE
**Schema:** `users` (auth), `audit_logs` (tracking), `cases` (investigation tracking). 
**Design decisions:** Chose PostgreSQL for relational integrity and JSONB support for flexible audit logs.
**Trade-offs:** Currently, graph data is built in-memory per request (stateless for transactions). Future scalable version requires Neo4j or Amazon Neptune.

## PART 5 — API
- `/auth/login`: Issues JWT.
- `/analyze/jobs`: Triggers the fraud detection pipeline. Validates CSV format and file size.
- `/graph/*`: Serves parsed graph components to the frontend.
- `/cases/*`: CRUD operations for investigators to manage suspicious entities.

## PART 6 — AUTHENTICATION
Uses JWT (JSON Web Tokens) with bcrypt for password hashing.
**Flow:** User submits credentials -> Backend verifies bcrypt hash -> Returns signed JWT (HS256) -> Frontend stores in localStorage -> Attached to `Authorization` header on subsequent requests.

## PART 7 — MULTI-TENANT ARCHITECTURE (If applied to Banks/Institutions)
**Why:** To serve multiple banks on a single SaaS instance.
**Isolation:** Logical isolation using a `tenant_id` column on all tables. Row-Level Security (RLS) in PostgreSQL ensures queries automatically filter by the user's JWT tenant claim.

## PART 8 — TECHNICAL DECISIONS
- **FastAPI:** Chosen for async support, high performance (Starlette/Pydantic), and automatic OpenAPI docs. Trade-off: Python GIL limits true multithreading for CPU-bound graph tasks.
- **React/Vite:** Fast HMR, rich ecosystem (Cytoscape).
- **NetworkX:** Fast prototyping for graph algorithms. Trade-off: Memory-bound. Needs Neo4j for massive datasets.

## PART 9 — CHALLENGES
**Problem:** Processing >10MB CSV files crashed the application due to memory spikes.
**Solution:** Implemented chunk processing using Pandas/Polars, streaming data instead of loading everything at once. 

## PART 10 — PERFORMANCE
**Bottlenecks:** In-memory graph processing (NetworkX) does not scale to millions of nodes.
**Optimizations:** Background tasks (Celery/Redis) to prevent blocking the API event loop. Client-side caching of graph structures.

## PART 11 — SECURITY
- **Auth:** JWT and Role-Based Access Control (Analyst vs. Admin).
- **Injection:** SQLAlchemy prevents SQL injection.
- **Vulnerabilities:** Storing JWT in localStorage is vulnerable to XSS. Improvement: Move to `HttpOnly` cookies.

## PART 12 — SCALABILITY
- **10 Institutions:** Single monolithic FastAPI server, larger PostgreSQL instance.
- **1,000 Institutions:** Migrate graph processing to a cluster of worker nodes (Celery), use Neo4j for distributed graph storage, put a CDN (Cloudflare) in front of the React app.

## PART 13 — DEPLOYMENT
- **Frontend:** Vercel (serverless React hosting).
- **Backend:** Render/AWS ECS (containerized FastAPI).
- **Database:** Supabase (managed Postgres).

---

## PART 14-16: INTERVIEW Q&A COMPENDIUM

### Architecture & Backend
**Q: Why FastAPI over Django?**
*A:* Django is great for MVC monoliths, but this project is an API-first ML/Graph processing engine. FastAPI provides async support out of the box, faster execution, and seamless Pydantic validation for complex JSON payloads.

**Q: How does your Cycle Detection work?**
*A:* It uses Depth-First Search (DFS) restricted to 3-4 hops to find loops. I implemented lexicographic pruning to ensure the same cycle isn't counted multiple times starting from different nodes.

**Q: What happens when the CSV is too large for memory?**
*A:* Currently it triggers an out-of-memory error. My proposed fix (and architectural upgrade) is to stream the CSV using Polars, insert edges into a graph database (Neo4j), and run graph algorithms natively in the database instead of in-memory Python.

### Security
**Q: Why is JWT in localStorage bad? How do you fix it?**
*A:* It's vulnerable to Cross-Site Scripting (XSS). An attacker who injects JS can read the token. The fix is moving it to an `HttpOnly`, `Secure`, `SameSite=Strict` cookie, which JS cannot access.

### Scalability
**Q: How do you scale this for real-time transaction processing?**
*A:* I would introduce Apache Kafka. Transactions flow into a Kafka topic. Stream processors (like Flink or Spark Streaming) update a graph database in real-time. The ML models would score transactions as they arrive using sliding windows.

---

## PART 18 — IMPROVEMENTS
1. **Neo4j Integration (High Impact):** Replace NetworkX. Solves memory limits and drastically improves graph traversal speeds.
2. **Celery/Redis Workers (High Impact):** Offloads heavy ML/Graph calculations from the FastAPI event loop, ensuring the API remains responsive.
3. **HttpOnly Cookies (Medium Impact):** Secures authentication against XSS.
4. **WebSocket Progress Bar (Low Impact):** Provides UX feedback while long analysis jobs run.
