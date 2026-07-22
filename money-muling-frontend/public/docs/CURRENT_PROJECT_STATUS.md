# Current Project Status

This document captures the exact implementation status of the Money Muling Detection System. It represents only what is currently coded and functional, without referencing proposed features or future upgrades.

---

## 🏛️ Current Architecture
The system is implemented as a decoupled, monolithic client-server application:
*   **Frontend**: Single Page React Application built with Vite, React Router, React Bootstrap, and Axios.
*   **Backend**: Python FastAPI app powered by Uvicorn.
*   **Database**: PostgreSQL (using SQLAlchemy) for authentication and audit log persistence, with an active fallback to SQLite.
*   **Analysis Layer**: Stateless, synchronous, in-memory graph analyzer built using Python `pandas` and `networkx`.

---

## ⚙️ Implemented Modules

### 1. Backend (FastAPI)
*   **Framework**: FastAPI serving endpoints defined in `main.py` and `api/routes/`.
*   **Routing**: Routes are split between `api/routes/auth.py`, `api/routes/audit.py`, and primary endpoints in `main.py` (`/analyze` and `/sample-generator`).
*   **Validation**: Handled using Pydantic schemas under `schemas/`.
*   **Error Handling**: Handled locally via `try-except` blocks returning specific response payloads.

### 2. Frontend (React)
*   **Client Setup**: React 18 SPA compiled using Vite.
*   **Authentication Flow**: Context-driven `AuthContext` capturing JWT tokens in `localStorage`.
*   **API Interception**: Axios client in `services/api.js` intercepting outgoing requests to attach `Authorization: Bearer <token>`.
*   **UI Components**: Divided into `components/auth` (Login, Register), `components/dashboard` (Stats panels and data tables), and `components/layout` (Header, Navbars).

### 3. Database
*   **ORM**: SQLAlchemy `declarative_base` setup with automatic schema creation (`Base.metadata.create_all`) on startup.
*   **Active Schema**:
    *   `users`: Stores `id` (int), `username` (varchar, unique, indexed), and `password` (varchar, hashed).
    *   `audit_logs`: Stores `id` (int), `timestamp` (datetime), `event_type` (varchar), `event_action` (varchar), `event_status` (varchar), `user_id` (int), `username` (varchar), `ip_address` (varchar), `user_agent` (varchar), `endpoint` (varchar), `method` (varchar), `details` (text), `error_message` (text), and `duration_ms` (int).

### 4. Authentication & Authorization
*   **Hashing**: Passwords hashed using `passlib[bcrypt]`.
*   **Session Management**: JSON Web Tokens (JWT) using `python-jose` HS256 algorithm.
*   **Authorization Dependents**: Route security applied using FastAPI dependency injection (`Depends(get_current_user)`).

### 5. Audit Logging System
*   **Unified Logger**: `log_event` function in `services/audit_service.py` records IP address (supporting `X-Forwarded-For`), HTTP headers, response statuses, and operational latency (in milliseconds).
*   **Error Logger**: `log_error` helper records unhandled exceptions alongside tracebacks to the audit logs.

### 6. CSV Processing & Ingestion
*   **Parser**: `parse_csv` in `utils/csv_parser.py` parses uploaded content.
*   **Required Fields**: CSV must contain columns `transaction_id`, `sender_id`, `receiver_id`, `amount`, and `timestamp`.
*   **Coercion**: Non-numeric amounts and invalid timestamps are coerced to NaN, and their rows are dropped from ingestion.

### 7. Detection Algorithms
*   **Cycle Detection**: Depth-first search (DFS) with a maximum length of 4. Lexicographical comparisons prune duplicate paths.
*   **Fan-In Detection**: Identifies hubs receiving transactions from multiple unique senders within a sliding time window.
*   **Fan-Out Detection**: Identifies hubs distributing transfers to multiple unique receivers.
*   **Layering Detection**: Traces chains of transactions where intermediates are low-degree nodes.
*   **Burst Detection**: Identifies accounts that have had long periods of dormancy, followed by high-frequency transaction spikes.
*   **Suspicion Scoring**: Computes suspicion scores (0-100) using weights: `Cycle: 40`, `Fan: 25`, `Burst: 25`, `Layering: 20`, plus multi-involvement bonuses.

---

## 🔌 API Endpoints
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/auth/register` | No | Creates a new user profile. |
| `POST` | `/auth/login` | No | Verifies credentials, returns access token. |
| `GET` | `/auth/me` | Yes | Retrieves profile info of current user. |
| `POST` | `/auth/change-password`| Yes | Changes current user password. |
| `POST` | `/analyze` | Yes | Receives CSV file, parses, runs detectors, returns JSON results. |
| `POST` | `/sample-generator` | No | Receives configuration parameters, returns synthetic transactions. |
| `GET` | `/audit/login-history` | Yes | Retrieves historical user login records. |
| `GET` | `/audit/failed-attempts` | Yes | Retrieves failed login actions. |
| `GET` | `/audit/analyze-history` | Yes | Retrieves log history of file analysis events. |
| `GET` | `/audit/activity` | Yes | Lists general user activity records. |
| `GET` | `/audit/stats` | Yes | Retrieves overall event metrics. |

---

## ⚠️ Current Limitations
1.  **Stateless Transaction Processing**: Transactions are not stored. All graph calculations are processed on-the-fly from the CSV.
2.  **Blocking CPU Execution**: Heavy Graph DFS traverses execute synchronously in the FastAPI loop.
3.  **Local Token Storage**: Frontend JWTs are stored in `localStorage`, making them vulnerable to XSS.
4.  **No Inbound Rate Limiting**: The API does not throttle client requests.
5.  **Lack of Network Visualizations**: Frontend lists fraud matches in text tables; no network nodes or paths are visualised.
