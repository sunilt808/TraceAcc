# Upgrade & Implementation Guide

This guide provides step-by-step instructions to refactor and upgrade the Money Muling Detection System for production.

---

## 🛠️ 1. Asynchronous Graph Processing (Celery & Redis)
To prevent blocking FastAPI's event loop, graph analysis must run in the background.

### Step 1: Install Dependencies
Add the following to your virtual environment:
```bash
pip install celery redis
```

### Step 2: Configure Celery App
Create `backend/config/celery_app.py`:
```python
from celery import Celery
import os

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("tasks", broker=redis_url, backend=redis_url)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)
```

### Step 3: Define Asynchronous Task
Create `backend/tasks/analysis.py`:
```python
from config.celery_app import celery_app
from utils.csv_parser import parse_csv
from detectors.cycle import find_cycles
from detectors.fan import detect_fan_patterns
from detectors.layering import find_layered_shells
from detectors.burst import detect_burst_activity
from detectors.score import compute_scores_and_rings

@celery_app.task(bind=True)
def run_graph_analysis(self, file_content: str):
    self.update_state(state="PROGRESS", meta={"status": "Parsing CSV"})
    graph = parse_csv(file_content)
    
    self.update_state(state="PROGRESS", meta={"status": "Running Detectors"})
    cycle_rings = find_cycles(graph)
    fan_rings = detect_fan_patterns(graph)
    shell_rings = find_layered_shells(graph)
    burst_accounts = detect_burst_activity(graph)
    
    self.update_state(state="PROGRESS", meta={"status": "Consolidating Scores"})
    suspicious_accounts, fraud_rings = compute_scores_and_rings(
        cycle_rings, fan_rings, shell_rings, burst_accounts
    )
    
    return {
        "suspicious_accounts": suspicious_accounts,
        "fraud_rings": fraud_rings
    }
```

---

## 🗄️ 2. Persisting Transaction History (SQLAlchemy)
To transition from a stateless CSV analyzer to a stateful audit platform, save transactional entities.

### Models Definition
Create `backend/models/transaction.py`:
```python
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from db.database import Base

class Account(Base):
    __tablename__ = "accounts"
    account_id = Column(String(50), primary_key=True)
    risk_score = Column(Float, default=0.0)

class Transaction(Base):
    __tablename__ = "transactions"
    transaction_id = Column(String(50), primary_key=True)
    sender_id = Column(String(50), ForeignKey("accounts.account_id"))
    receiver_id = Column(String(50), ForeignKey("accounts.account_id"))
    amount = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False)
```

---

## 🐳 3. Containerization (Docker)
Provide uniform environments for API service, databases, and message brokers.

### Create Dockerfile
Write `backend/Dockerfile`:
```dockerfile
FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```
