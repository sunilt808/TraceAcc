# Money Muling Detection System

A high-performance graph-analytical application designed to identify suspicious financial transaction patterns, money mule networks, and layering chains. This project combines a **FastAPI** Python backend utilizing **NetworkX** for in-memory graph traversals with a responsive **React (Vite)** dashboard.

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Problem Statement](#problem-statement)
3. [Features](#features)
4. [Tech Stack](#tech-stack)
5. [Architecture](#architecture)
6. [Folder Structure](#folder-structure)
7. [Installation & Setup](#installation--setup)
8. [Configuration](#configuration)
9. [API Overview](#api-overview)
10. [Screenshots Placeholder](#screenshots-placeholder)
11. [Future Work](#future-work)
12. [License](#license)

---

## 🔍 Project Overview
The Money Muling Detection System analyzes transaction datasets to detect multi-hop money laundering schemes. By modeling accounts as nodes and transactions as directed edges, it runs structural graph heuristics to highlight rings, cycles, split-merge (fan) networks, and sudden activity bursts.

## 💡 Problem Statement
Financial institutions lose billions to money laundering, where illegal proceeds are routed through intermediary accounts ("mules") to decouple the source of funds from their criminal origin. Traditional rule-based monitors analyze transactions in isolation, failing to detect multi-party networks (e.g., circular pathways or split-transfer layering). This project solves that by analyzing transaction topologies as a unified network graph to trace interconnected relationships.

## ✨ Features
*   **Heuristic Detection Engines**: Built-in detectors identifying Cycles, Fan-In (many-to-one), Fan-Out (one-to-many), Layered Chains, and dormant accounts experiencing sudden transaction Bursts.
*   **Analyst Dashboard**: A front-end interface listing flagged accounts, suspicious networks, and general ledger statistics.
*   **Interactive Synthetic Data Generator**: In-app generation of customizable transaction CSVs to seed specific fraud types for validation.
*   **Stateful Audit Trails**: Real-time database logging of all user activities, failed auth requests, password changes, and CSV upload events (tracking IPs, agent metrics, and run durations).

## 🛠️ Tech Stack
*   **Backend**: Python 3.10+, FastAPI, SQLAlchemy, NetworkX, Pandas, Uvicorn.
*   **Database**: PostgreSQL / SQLite (managed via SQLAlchemy ORM).
*   **Frontend**: React 18 (Vite, Javascript), React Router v6, React Bootstrap, Axios.

---

## 🏛️ Architecture
The project is built on a decoupled client-server architecture:
1.  **Frontend**: Single Page React Application handles file uploads, requests audit histories, and renders fraud tables.
2.  **Backend**: FastAPI acts as the API Gateway, handling request validation, auth middleware, and serving endpoints.
3.  **Engine**: A specialized computational layer running deterministic graph traversals using NetworkX structures.
4.  **Database**: SQLAlchemy handles operations on `users` and `audit_logs` tables.

---

## 📂 Folder Structure
```
d:/rift/
├── backend/
│   ├── api/                 # API Routes & Dependency Injection
│   ├── config/              # Global Configuration Settings
│   ├── db/                  # Database Connections & Session Management
│   ├── detectors/           # Graph Pattern Heuristics
│   ├── models/              # SQLAlchemy Database Models
│   ├── schemas/             # Pydantic Request/Response validation
│   ├── services/            # Authentication & Logging logic
│   └── utils/               # File parsers & synthetic generation helpers
└── money-muling-frontend/
    ├── src/
    │   ├── components/      # Views and card elements
    │   ├── context/         # Auth contexts
    │   └── services/        # Axios API clients
```

---

## 🚀 Installation & Setup

### Backend Setup
1.  Navigate to `backend`:
    ```bash
    cd backend
    ```
2.  Create and activate virtual environment:
    ```bash
    python -m venv venv
    # Windows:
    venv\Scripts\activate
    # Unix:
    source venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Configure your environment (see Configuration below).
5.  Start FastAPI:
    ```bash
    uvicorn main:app --reload
    ```

### Frontend Setup
1.  Navigate to `money-muling-frontend`:
    ```bash
    cd money-muling-frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Start dev server:
    ```bash
    npm run dev
    ```

---

## ⚙️ Configuration
Create a `.env` file in the `backend/` directory:
```env
DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<dbname>
JWT_SECRET_KEY=your_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
```

---

## 🔌 API Overview
*   `POST /auth/register` - Create user credentials.
*   `POST /auth/login` - Authenticate user and receive access token.
*   `GET /auth/me` - Fetch authenticated user profile details.
*   `POST /analyze` - Upload CSV and run detection heuristics.
*   `POST /sample-generator` - Generate synthetic CSV dataset.
*   `GET /audit/activity` - Fetch system activity logs.

---

## 🖼️ Screenshots Placeholder
*(Screenshots to be added showing Dashboard, Upload panel, and Ring tables.)*

## 🔮 Future Work
*   Move to Neo4j graph database for sub-second database-level queries.
*   Offload CPU-bound algorithms to Celery tasks with Redis brokers.
*   Implement interactive graph visualization using D3.js or Cytoscape.js.

## 📄 License
This project is licensed under the MIT License.
