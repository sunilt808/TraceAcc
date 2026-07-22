# Changelog

All notable changes to the Money Muling Detection System will be documented in this file.

---

## [1.0.0] - 2026-07-22

### Added
*   **Graph Engine**: Implemented `TransactionGraph` abstraction using in-memory NetworkX directed graphs.
*   **Detectors**: Created detection modules for Cycle DFS, Fan-In / Fan-Out hub checks, Layering path traversals, and dormant-to-burst checks.
*   **Audit Logger**: Created audit trail services storing user activity logs in database tables.
*   **Auth Service**: JWT-based session checks and password encryption using bcrypt.
*   **React UI**: React Bootstrap dashboard listing flagged accounts and transaction statistics.

### Optimized
*   **Burst Detection**: Refactored the detector to access adjacency lists instead of scanning the full transaction ledger.

### Removed
*   **Cloudflare Turnstile**: Removed unused Turnstile scripts and markup containers from the index file.

---

## [Future Milestones]
*   **Celery Workers**: Offload graph analyses to background processes.
*   **Neo4j Migration**: Store and traverse graph networks at database-level.
*   **Interactive Visualizations**: Render node connections in UI graphs.
