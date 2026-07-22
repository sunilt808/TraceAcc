# Project TODO List

This document tracks completed, active, and upcoming tasks for the Money Muling Detection System.

---

## 🎯 Task Checklist

### 🔴 Critical
*   [☑] Sanitize Git history and rotate database credentials (force `.env` deletion).
*   [☑] Optimize burst detection algorithm to use $O(V + E)$ adjacency traversals.
*   [☐] Offload CPU-bound NetworkX traversals to asynchronous background tasks.

### 🟡 High
*   [☐] Extract transaction-based endpoints from `main.py` into dedicated route controllers.
*   [☐] Enforce maximum payload limits (e.g. 10MB) and content checks on CSV uploads.
*   [☐] Transition JWT tokens from `localStorage` to HttpOnly, SameSite=Strict cookies.

### 🟢 Medium
*   [☐] Dockerize backend and frontend services using Docker Compose.
*   [☐] Expand schema to persist transaction histories and analysis results.
*   [☐] Add custom charts and visualizations to React components.

### 🔵 Low
*   [☐] Write pytest integration cases for detectors.
*   [☐] Add real-time Kafka transaction ingestion logic.
