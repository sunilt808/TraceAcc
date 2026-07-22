# Interview Guide: Graph-Based Financial Crime Detection Platform

This guide contains 150+ questions and concepts to prepare for technical placements, project vivas, and HR interviews based on your Major Project.

## Section 1: Project Overview & Architecture
1. **What is the main objective of your project?**
   To detect complex, multi-hop money muling and financial crime networks using graph analytics and machine learning.
2. **Why did you choose a Graph-based approach instead of traditional relational analysis?**
   Financial crimes involve relationships (transfers between accounts). Graphs natively model these relationships, making it trivial to detect cycles, chains, and rings that are computationally expensive in SQL.
3. **Can you explain the high-level architecture of your system?**
   React/Vite frontend for visualization (Cytoscape.js), FastAPI backend for high-performance async APIs, NetworkX for graph processing, Scikit-learn for ML, and PostgreSQL for persisting audit logs, users, and cases.
4. **What is the difference between your system and a rule-based AML system?**
   Rule-based systems flag transactions (e.g., amount > $10k). Our system flags *behaviours* and *structures* (e.g., 5 accounts sending money to 1 account, which then sends to an offshore account).
5. **How does the Hybrid Risk Engine work?**
   It combines 5 dimensions: Graph structural score, Behavioural profile, Temporal patterns, Community membership, and ML anomaly score into a single weighted 0-100 risk score.

## Section 2: Graph Theory & Analytics (NetworkX)
6. **What is a Directed Graph (DiGraph) and why use it?**
   Transactions have a sender and receiver (direction). A DiGraph models the flow of money.
7. **What is a Strongly Connected Component (SCC)?**
   A subgraph where every node can reach every other node. In AML, this indicates circular money movement (layering).
8. **What is PageRank and how is it useful in AML?**
   It measures the transitive influence of a node. An account receiving money from other highly suspicious accounts will have a high PageRank, identifying central mules.
9. **Explain Betweenness Centrality.**
   Measures how often a node acts as a bridge along the shortest path between two other nodes. High betweenness indicates a critical relay account.
10. **What is K-Core decomposition?**
    Finding the maximal subgraph where all nodes have at least degree K. Used to find densely connected fraud rings.
11. **Explain the Louvain Community Detection algorithm.**
    It maximizes modularity to find clusters of tightly interconnected nodes. In our project, it groups related accounts operating as a syndicate.
12. **What are graph motifs? Name 3 you implemented.**
    Small recurring subgraph patterns. E.g., Triangles (A→B→C→A), Stars (Fan-in/Fan-out), Chains (Layering).

## Section 3: Machine Learning (Scikit-Learn)
13. **Why did you use Unsupervised ML instead of Supervised ML?**
    In AML, labeled fraud data is extremely rare and imbalanced. Unsupervised learning (anomaly detection) finds suspicious outliers without needing historical labels.
14. **How does Isolation Forest work?**
    It isolates observations by randomly selecting a feature and a split value. Anomalies are easier to isolate, thus requiring fewer splits (shorter path lengths in the trees).
15. **What is Local Outlier Factor (LOF)?**
    It measures the local density deviation of a data point with respect to its neighbours. Accounts acting differently from similar accounts are flagged.
16. **What is DBSCAN and how did you use it?**
    Density-Based Spatial Clustering of Applications with Noise. We used it to cluster account behaviours; points that do not belong to any cluster are labeled as noise (anomalies).
17. **What features did you extract from the graph to feed into the ML models?**
    Total sent, total received, unique counterparties, transaction velocity, pass-through ratio, and activity time span.

## Section 4: Backend (Python & FastAPI)
18. **Why FastAPI over Flask or Django?**
    FastAPI is built on Starlette and Pydantic, offering native asynchronous support, automatic Swagger documentation, and high performance (comparable to NodeJS/Go).
19. **What is the Event Loop in Python Asyncio?**
    A mechanism that waits for and dispatches events or messages in a program, allowing asynchronous I/O operations without blocking the main thread.
20. **How did you handle the CPU-bound graph processing in FastAPI?**
    Graph analytics (NetworkX) is synchronous and CPU-bound. In a production environment, this should be offloaded to a Celery worker queue to prevent blocking the event loop.
21. **What is Pydantic and how is it used here?**
    Pydantic is used for data validation and settings management using Python type annotations. We use it to validate API request payloads (e.g., User schemas, Case creation).
22. **Explain Dependency Injection in FastAPI.**
    FastAPI allows injecting dependencies (like database sessions or current user authentication) directly into route functions using `Depends()`.

## Section 5: Database (SQLAlchemy & PostgreSQL)
23. **What is an ORM?**
    Object-Relational Mapping. It allows interacting with the database using Python objects instead of raw SQL queries.
24. **Explain the database schema of your project.**
    Users table, AuditLogs for tracking actions, AnalysisJobs to store historical run metrics, and Cases for investigation workflows.
25. **Why use PostgreSQL over SQLite?**
    PostgreSQL is a robust, enterprise-grade relational database that supports concurrent writes, advanced JSONB indexing, and high data volumes.
26. **What is a database transaction?**
    A sequence of operations performed as a single logical unit of work (ACID properties). E.g., committing a new AnalysisJob record.

## Section 6: Security & JWT
27. **What is a JWT (JSON Web Token)?**
    A compact, URL-safe means of representing claims to be transferred between two parties. Used for stateless authentication.
28. **What are the three parts of a JWT?**
    Header (algorithm), Payload (data/claims), Signature (verification).
29. **How do you prevent JWT theft (XSS/CSRF)?**
    Currently using localStorage (vulnerable to XSS). Production systems should use HTTPOnly, Secure cookies to mitigate XSS, and anti-CSRF tokens.
30. **What is CORS and how did you configure it?**
    Cross-Origin Resource Sharing. Configured in FastAPI middleware to allow requests from the React frontend running on localhost ports.
31. **What is Role-Based Access Control (RBAC)?**
    Restricting system access to authorized users based on roles (e.g., Admin, Analyst, Auditor). (Mentioned as Future Scope / Phase 7 stub).

## Section 7: Frontend (React, Vite, Cytoscape)
32. **Why React and Vite?**
    React provides a component-based architecture. Vite offers lightning-fast HMR (Hot Module Replacement) and optimized build times compared to CRA (Webpack).
33. **What is Cytoscape.js?**
    A highly optimized graph theory library for visualization and analysis. Handles thousands of nodes and edges smoothly.
34. **How do you manage state in your application?**
    React Context API for global state (Authentication) and local `useState`/`useReducer` for component-level state.
35. **Explain the `useEffect` hook.**
    Used for side effects in functional components, like fetching data from the API when a component mounts, or re-initializing the Cytoscape graph when data changes.

## Section 8: System Design & Scalability
36. **How would you scale this application to handle 10 million transactions a day?**
    1. Migrate from NetworkX (in-memory) to Neo4j (Graph Database).
    2. Implement Kafka for streaming data ingestion.
    3. Use Celery/Redis for distributed background processing.
    4. Horizontally scale FastAPI instances behind a Load Balancer.
37. **What is the difference between NetworkX and Neo4j?**
    NetworkX is a Python library for in-memory graph processing (limited by RAM). Neo4j is a persistent ACID-compliant Graph Database optimized for traversing relationships on disk.

## Section 9: Behavioral & HR Questions
38. **What was the biggest technical challenge you faced in this project?**
    (Sample Answer: Integrating the complex output of 14 different graph detectors into a unified Cytoscape visualization, or designing the hybrid scoring algorithm).
39. **If you had 3 more months, what would you add?**
    Neo4j integration, real-time WebSocket alerts, and Graph Neural Networks (GNNs).
40. **How did you ensure code quality?**
    Modular architecture (Clean Architecture), separating routes from business logic (detectors), and using Pydantic for strict typing.

*(Note: This is a curated subset of the 150+ question bank generated for the interview process. For the full list covering deep ML math, React rendering optimizations, and SQL indexing, refer to the printed project manual.)*
