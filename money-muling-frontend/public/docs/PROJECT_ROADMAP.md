# Project Roadmap

This document outlines the evolutionary phases to transition the Money Muling Detection System from a hackathon prototype to an enterprise-grade platform.

---

## 🗺️ Phases Overview

```
Phase 1: Feature Completion ──> Phase 2: Performance ──> Phase 3: DB Layer
      │                                                        │
      v                                                        v
Phase 4: Security Hardening ──> Phase 5: Visualization ──> Phase 6: ML/GNN
      │                                                        │
      v                                                        v
Phase 7: Cloud Production   ──> Phase 8: Enterprise Scale
```

---

## 🛠️ Detailed Tasks & Tasks Parameters

### Phase 1: Feature Completion
*   **Task 1.1: Move routes out of main.py**
    *   *Description*: Extract analysis endpoints to `api/routes/analyze.py`.
    *   *Priority*: High | *Difficulty*: Easy | *Dependencies*: None | *Est. Time*: 1 day.
*   **Task 1.2: Implement file size and type validation**
    *   *Description*: Restrict uploads to CSVs below 10MB.
    *   *Priority*: High | *Difficulty*: Easy | *Dependencies*: None | *Est. Time*: 1 day.

### Phase 2: Performance Optimization
*   **Task 2.1: Implement background queues**
    *   *Description*: Set up Celery and Redis to handle CPU-heavy graph calculations asynchronously.
    *   *Priority*: Critical | *Difficulty*: Medium | *Dependencies*: Task 1.1 | *Est. Time*: 4 days.

### Phase 3: Database Layer Improvements
*   **Task 3.1: Persist transaction history**
    *   *Description*: Create schemas for `accounts`, `transactions`, and `detected_rings`.
    *   *Priority*: High | *Difficulty*: Medium | *Dependencies*: None | *Est. Time*: 3 days.
*   **Task 3.2: Convert log details to JSONB**
    *   *Description*: Update model types and write migrations to move `details` string data to queryable JSONB.
    *   *Priority*: Medium | *Difficulty*: Easy | *Dependencies*: None | *Est. Time*: 2 days.

### Phase 4: Security Improvements
*   **Task 4.1: Rotate credentials and sanitize Git history**
    *   *Description*: Generate new keys, clean git commits using filter-repo, and ignore `.env`.
    *   *Priority*: Critical | *Difficulty*: Easy | *Dependencies*: None | *Est. Time*: 1 day.
*   **Task 4.2: Implement HttpOnly Cookie Auth**
    *   *Description*: Update client API to read token from secure cookies instead of local storage.
    *   *Priority*: High | *Difficulty*: Medium | *Dependencies*: None | *Est. Time*: 2 days.
*   **Task 4.3: Add Rate Limiting**
    *   *Description*: Apply `slowapi` decorators to auth and upload routes.
    *   *Priority*: Medium | *Difficulty*: Easy | *Dependencies*: None | *Est. Time*: 1 day.

### Phase 5: Graph Visualization
*   **Task 5.1: Integrate Cytoscape.js / D3.js**
    *   *Description*: Renders node connections interactively, allowing analysts to trace transaction rings visually.
    *   *Priority*: Medium | *Difficulty*: High | *Dependencies*: Task 3.1 | *Est. Time*: 5 days.

### Phase 6: Machine Learning Integration
*   **Task 6.1: Node2Vec structural embedding extraction**
    *   *Description*: Generate embeddings using transaction graphs.
    *   *Priority*: Low | *Difficulty*: High | *Dependencies*: Task 3.1 | *Est. Time*: 5 days.
*   **Task 6.2: Train Isolation Forest / XGBoost mule classifier**
    *   *Description*: Predict risk scores using node structural and transactional features.
    *   *Priority*: Low | *Difficulty*: High | *Dependencies*: Task 6.1 | *Est. Time*: 7 days.

### Phase 7: Production Deployment
*   **Task 7.1: Containerize App**
    *   *Description*: Author `Dockerfile` and `docker-compose.yml` for local and cloud orchestration.
    *   *Priority*: High | *Difficulty*: Easy | *Dependencies*: None | *Est. Time*: 2 days.
*   **Task 7.2: Deploy to AWS ECS / GCP Cloud Run**
    *   *Description*: Set up infrastructure pipelines to scale persistent containers.
    *   *Priority*: Medium | *Difficulty*: Medium | *Dependencies*: Task 7.1 | *Est. Time*: 4 days.

### Phase 8: Enterprise Scale
*   **Task 8.1: Integrate Neo4j Graph Database**
    *   *Description*: Replace in-memory NetworkX with a dedicated Neo4j instance using Cypher queries.
    *   *Priority*: Low | *Difficulty*: Critical | *Dependencies*: Task 3.1 | *Est. Time*: 10 days.
