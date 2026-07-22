# Software Architecture Document (SAD)

This document provides a detailed breakdown of the high-level architecture, module interactions, and request flows within the Money Muling Detection System.

---

## 🏛️ High-Level Architecture
The system utilizes a decoupled Client-Server architecture structure:

```
[React SPA Client] ──(HTTP/JSON)──> [FastAPI Router]
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
         [Database Services]                            [Graph Analysis Engine]
       (SQLAlchemy -> SQLite/PG)                       (Pandas / NetworkX / DFS)
```

1.  **React Frontend (Presentation Layer)**:
    *   Initiates API calls via Axios.
    *   Injects JWT credentials using request interceptors.
    *   Renders response tables.
2.  **FastAPI Backend (Application Layer)**:
    *   Exposes REST endpoints.
    *   Enforces authentication using custom route dependencies.
    *   Dispatches file uploads to the parsing service.
3.  **Graph Engine (Domain Layer)**:
    *   Parses CSV tabular columns into a network topology using NetworkX.
    *   Executes localized search heuristics (DFS/sliding window check).
4.  **Relational Database (Data Layer)**:
    *   Persists credentials and logs metadata.

---

## 🔄 Dynamic Flows

### Request Sequence Diagram
The sequence below outlines the operations triggered by a file upload:

```
Analyst              Vite/React            FastAPI Router          Graph Engine            Database
   │                      │                       │                      │                     │
   │── Uploads CSV ──────>│                       │                      │                     │
   │                      │── POST /analyze ─────>│                      │                     │
   │                      │   (With JWT Header)   │── verify token ───────────────────────────>│
   │                      │                       │   (Checks User)      │                     │
   │                      │                       │<── Token Valid ────────────────────────────│
   │                      │                       │                      │                     │
   │                      │                       │── parse & build ────>│                     │
   │                      │                       │                       │                     │
   │                      │                       │── run detectors ────>│                     │
   │                      │                       │                      │── Run Cycle DFS     │
   │                      │                       │                      │── Run Fan window    │
   │                      │                       │                      │── Run Layering      │
   │                      │                       │                      │── Run Burst check   │
   │                      │                       │                      │                     │
   │                      │                       │<── returns results ──│                     │
   │                      │                       │                      │                     │
   │                      │                       │── Log success ────────────────────────────>│
   │                      │                       │                                            │
   │                      │<── Returns JSON ──────│                                            │
   │<── Renders Tables ───│                                                                    │
```

---

## 📁 Module Organization
*   `main.py`: Entrypoint. Holds CORS, middleware initialization, and primary analytical endpoints.
*   `api/routes/`: Route modules mapping auth operations (`auth.py`) and audit histories (`audit.py`).
*   `api/deps.py`: Contains JWT verification logic (`get_bearer_token` and `get_current_user`).
*   `db/database.py`: Instantiates the SQLAlchemy engine, configures session pools, and sets auto-creation metadata rules.
*   `detectors/`: Independent files for each fraud type heuristic, plus `score.py` to merge outputs.
*   `models/`: Tables definitions (`user.py`, `audit_log.py`).
*   `schemas/`: Data models used by FastAPI request parsing.
*   `services/`: Core logic layers for user management (`auth_service.py`) and log generation (`audit_service.py`).
*   `utils/`: Secondary helper libraries (graph abstractions, CSV parsers, sample generator).

---

## 🛠️ Design Decisions & Trade-offs
1.  **In-Memory Graph Construction**:
    *   *Decision*: Load NetworkX graphs dynamically in memory during the request.
    *   *Trade-off*: Highly efficient for hackathon-scale datasets but does not scale to enterprise workloads, running out of memory on large files and blocking the single-threaded event loop.
2.  **Stateless Transaction Flow**:
    *   *Decision*: Do not store transaction datasets in the DB.
    *   *Trade-off*: Eliminates database storage overhead but forces analysts to re-upload files on every reload.
3.  **Relational Database for Auditing**:
    *   *Decision*: Use SQLite/PostgreSQL to track log entries.
    *   *Trade-off*: Safe for structured logs but makes searching metadata challenging, as log data is kept in flat text strings rather than JSONB formats.
