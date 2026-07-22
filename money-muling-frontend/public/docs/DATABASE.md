# Database Schema Document

This document outlines the database design, active tables, ORM mappings, constraints, and suggested production schemas.

---

## 🗄️ Database Choice
*   **Engine**: PostgreSQL (accessed using `psycopg` 3) is target production engine, with a local SQLite file database fallback for developer workstations.
*   **ORM**: SQLAlchemy with `declarative_base` model structures.

---

## 📋 Implemented Tables & Models

### 1. User Model (`models/user.py`)
*   **Table Name**: `users`
*   **Purpose**: Stores analyst login credentials.
*   **Columns**:
    *   `id`: `Integer`, Primary Key, auto-incrementing.
    *   `username`: `String(150)`, Unique, Nullable=False, indexed.
    *   `password`: `String(255)`, Nullable=False (stores bcrypt hash).

### 2. Audit Log Model (`models/audit_log.py`)
*   **Table Name**: `audit_logs`
*   **Purpose**: Logs analyst actions and API request lifecycles.
*   **Columns**:
    *   `id`: `Integer`, Primary Key.
    *   `timestamp`: `DateTime`, Default: UTC timezone.now.
    *   `event_type`: `String(50)`, Nullable=False.
    *   `event_action`: `String(100)`, Nullable=False.
    *   `event_status`: `String(20)`, Nullable=False.
    *   `user_id`: `Integer`, Nullable=True.
    *   `username`: `String(150)`, Nullable=True.
    *   `ip_address`: `String(45)`, Nullable=True.
    *   `user_agent`: `String(500)`, Nullable=True.
    *   `endpoint`: `String(255)`, Nullable=True.
    *   `method`: `String(10)`, Nullable=True.
    *   `details`: `Text`, Nullable=True (stores serialized JSON string).
    *   `error_message`: `Text`, Nullable=True.
    *   `duration_ms`: `Integer`, Nullable=True.

---

## 🗂️ Indexes & Constraints
*   `users`: Unique index on `username`.
*   `audit_logs`:
    *   Composite index `ix_audit_user_timestamp` on `(user_id, timestamp)`.
    *   Composite index `ix_audit_type_action` on `(event_type, event_action)`.
    *   Individual indexes on `id`, `timestamp`, `event_type`, `event_action`, `event_status`, `user_id`, and `username`.

---

## ⚠️ Current Database Limitations
1.  **No Transaction Storage**: Transaction history, accounts, and fraud rings are not persisted to database.
2.  **Unstructured Context Logging**: `details` is stored as a flat `Text` string. This prevents database queries from filtering by specific transaction attributes.
3.  **No Foreign Key Constraints**: No hard relationship exists between `users.id` and `audit_logs.user_id`, relying on application-level integrity.

---

## 🚀 Suggested Production Schema (Future Expansion)
To persist transactions and fraud rings, the database should be updated with the following models:

```sql
CREATE TABLE accounts (
    account_id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    risk_score DECIMAL(5, 2) DEFAULT 0.00
);

CREATE TABLE transactions (
    transaction_id VARCHAR(50) PRIMARY KEY,
    sender_id VARCHAR(50) REFERENCES accounts(account_id),
    receiver_id VARCHAR(50) REFERENCES accounts(account_id),
    amount DECIMAL(15, 2) NOT NULL,
    timestamp TIMESTAMP NOT NULL
);

CREATE TABLE analysis_jobs (
    job_id UUID PRIMARY KEY,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    record_count INT,
    duration_ms INT
);

CREATE TABLE detected_rings (
    ring_id VARCHAR(50) PRIMARY KEY,
    pattern_type VARCHAR(50) NOT NULL,
    risk_score DECIMAL(5, 2) NOT NULL,
    member_accounts JSONB NOT NULL
);
```
