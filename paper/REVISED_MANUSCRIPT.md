# TraceAcc: Evidence-Fused Dual-View Graph Learning for UPI Fraud and Money-Mule Detection

**Authors**: Mahadev Prasad R$^*$ and Sunil T  
*Department of Computer Science and Engineering, Dayananda Sagar College of Engineering, Bengaluru 560078, India*  
$^*$*Corresponding Author: prasad79755@gmail.com*  
*Co-Author: sunilt808@gmail.com*

---

## Abstract
Instant payment fraud is increasingly characterized by coordinated, distributed transaction behavior rather than isolated anomalous transfers. Money-mule syndicates routinely receive funds from compromised accounts, rapidly pass them through layered intermediary nodes, and disperse them across circular structures that make individual transfers appear benign. In this paper, we present **TraceAcc**, an evidence-fused graph intelligence framework for high-volume instant payment systems such as the Unified Payments Interface (UPI). TraceAcc builds upon the Dual-View Graph Representation Learning architecture (DC-LCG) as its foundational supervised graph learner and augments it with explicit structural pattern detection, temporal burst and velocity signals, community boundary analytics, and multi-algorithm unsupervised anomaly scoring. These heterogeneous signals are normalized into a unified evidence vector and fused into calibrated account- and transaction-level risk scores. In addition to risk prioritization, TraceAcc couples deep relational inference with auditable evidentiary trails, temporal event timelines, and cryptographic integrity markers. Extensive evaluation on IBM's synthetic anti-money-laundering (AML) benchmark and a controlled UPI transaction dataset shows that TraceAcc Hybrid attains **0.94 precision, 0.92 recall, 0.93 F1-score, 0.97 ROC-AUC, and 0.91 PR-AUC**, consistently outperforming standalone DC-LCG and strong GNN baselines. A synthetic case study of 1,000 transactions over 50 accounts illustrates how TraceAcc uncovers complex laundering typologies including circular flows, fan-in/fan-out dispersal, and diamond pass-through networks.

**Keywords**: Anti-money laundering, UPI fraud, money mule, graph neural networks, DC-LCG, graph anomaly detection, temporal fraud detection, evidence fusion, financial intelligence.

---

## I. Introduction
Unified Payments Interface (UPI) has emerged as one of the world's most transaction-dense instant payment infrastructures. Data published by the National Payments Corporation of India (NPCI) demonstrates exponential volume growth, while reports from the Reserve Bank of India (RBI) highlight digital payment fraud and mule account exploitation as the predominant category among institutional banking frauds [49], [50]. These operational dynamics make isolated, point-in-time transaction screening insufficient. Financial adversaries operate across coordinated rings, systematically varying transfer amounts, exploiting mule accounts as transitory conduits, and dispersing funds through layered hops to evade threshold-based rules [51], [52].

A financial transaction stream is naturally modeled as a directed, temporal multigraph where accounts correspond to vertices and financial transfers form weighted, time-stamped edges. Consequently, graph neural networks (GNNs) have garnered considerable interest due to their capacity to capture relational structure that tabular learning pipelines neglect [7], [17], [18]. Among recent advances, the Dual-View Graph Representation Learning method (DC-LCG) addresses two pervasive challenges in financial graphs: feature/relation camouflage across heterogeneous neighborhoods and the tracking of extended illicit paths through dual local and contextual views [1].

However, in fast-clearing environments like UPI, relying exclusively on a deep graph classifier has several practical limitations:
1. Deep latent embeddings act as black boxes, providing minimal explainability to compliance officers and law enforcement.
2. High-velocity pass-through transfers and deterministic topological motifs (such as cyclic loops, diamond splits, and structuring) can be verified explicitly without relying solely on latent representation approximations.
3. Class imbalance in financial data causes pure classifiers to suffer false negatives when fraudsters alter transaction cadences.

To bridge this gap, this paper introduces **TraceAcc**, an evidence-fused detection framework. Rather than supplanting DC-LCG, TraceAcc positions DC-LCG as the primary supervised graph learner and embeds it within an evidence-fusion architecture. The system integrates five orthogonal evidence channels:
1. Learned dual-view graph representations ($G$),
2. Deterministic structural pattern rules ($B$),
3. Temporal velocity and burst features ($T$),
4. Community and bridge metrics ($C$), and
5. Unsupervised anomaly ensembles (Isolation Forest, LOF, and DBSCAN) ($M$).

### Summary of Contributions
1. **Evidence-Fused Detection Architecture**: A formal fusion layer that normalizes and combines latent graph representations with behavioral, temporal, community, and unsupervised signals into an auditable account risk score.
2. **UPI-Specific Pattern Layer**: Deterministic identification of rapid fund movement, circular cycles, fan-in pooling, fan-out dispersal, structuring, and diamond forwarding.
3. **End-to-End Forensic Workflow**: An investigation-driven pipeline integrating risk ranking, visual graph exploration, temporal transaction reconstruction, and SHA-256 integrity-sealed reporting.
4. **Rigorous Empirical Evaluation**: Validation on both IBM's synthetic AML benchmark [2] and a controlled UPI dataset, featuring ablation studies, weight sensitivity analysis, temporal holdout tests, and latency profiling.

---

## II. Problem Formulation and Mathematical Modeling

### A. Temporal Directed Multigraph
Let a continuous financial transaction stream be defined as a dynamic directed multigraph:
$$\mathcal{G}_t = (\mathcal{V}_t, \mathcal{E}_t, \mathbf{X}_t)$$
where $\mathcal{V}_t = \{v_1, v_2, \dots, v_N\}$ denotes the set of unique financial accounts observed up to time $t$. The edge set $\mathcal{E}_t = \{e_k = (u_k, v_k, t_k, \mathbf{w}_k)\}_{k=1}^M$ represents directed transfer events from source account $u_k$ to destination $v_k$ at timestamp $t_k \le t$. The edge attribute vector $\mathbf{w}_k \in \mathbb{R}^{d_e}$ captures transactional features including monetary amount, payment channel, and settlement status. The vertex attribute matrix $\mathbf{X}_t \in \mathbb{R}^{|\mathcal{V}_t| \times d_v}$ captures static and rolling account metadata (e.g., account age, KYC tier, aggregate turnover).

### B. Risk Scoring and Unified Evidence Vector
For each account $v \in \mathcal{V}_t$, the objective is to compute an account risk score $R(v, t) \in [0, 1]$ that prioritizes fraudulent or mule accounts while minimizing false positives. Unlike pure node classification, TraceAcc produces an inspectable evidence vector:
$$\mathbf{e}_v(t) = \big[ e_{\text{graph}}(v),\, e_{\text{behavioral}}(v),\, e_{\text{temporal}}(v),\, e_{\text{community}}(v),\, e_{\text{ML}}(v) \big]^\top \in [0, 1]^5$$
where each component represents a normalized risk score corresponding to $G, B, T, C,$ and $M$.

### C. Research Questions
- **RQ1**: Does fusing DC-LCG with explicit structural, temporal, community, and unsupervised signals improve detection over standalone DC-LCG?
- **RQ2**: What is the relative sensitivity and contribution of each evidence family under feature ablation?
- **RQ3**: How robust is the evidence-fused model against temporal drift under forward-chaining evaluation?
- **RQ4**: Can decomposed evidence vectors accelerate analyst triage without requiring exhaustive manual graph traversals?

---

## III. Related Work

### A. Graph Representation Learning in Financial Fraud
GNNs have transformed anti-financial crime modeling [7], [17]. Classical architectures such as GCN [19], GraphSAGE [20], and GAT [21] aggregate local neighborhood context. However, fraudsters actively disguise relations by interweaving legitimate transactions. To counter camouflage, specialized models have been proposed: CARE-GNN uses reinforcement learning to filter deceptive neighbors [26], GraphConsis addresses relation and context inconsistency [27], and PC-GNN introduces balanced sub-sampling [28]. Further studies explore heterogeneous graph embeddings and contrastive pretraining [9], [10], [12], [13].

### B. Temporal and Dynamic Graph Networks
Dynamic graph architectures such as EvolveGCN [29], DySAT [36], Temporal Graph Networks (TGN) [37], and TGAT [38] incorporate temporal evolution. MTPNet uses multi-temporal partitioned attention to monitor transaction flows across multiple scales [3]. TraceAcc leverages explicit temporal velocity and burst features to inform its hybrid fusion layer.

### C. Unsupervised Anomaly Detection and AML Benchmarks
Unsupervised detectors remain critical because supervised training data in financial crime is heavily skewed and labels are often delayed [16], [18]. Established techniques include Isolation Forest [39], Local Outlier Factor (LOF) [40], and DBSCAN [41]. Synthetic benchmarks such as IBM's AML dataset [2], AMLSim [31], and PaySim [32] provide essential baselines for reproducible evaluation.

---

## IV. System Architecture and Differentiation from Baselines
TraceAcc differs fundamentally from black-box ensemble classifiers. Rather than treating sub-models as interchangeable voters, TraceAcc coordinates heterogeneous analytical lenses, mapping each to distinct forensic properties. 

### Table I: Qualitative Comparison of Detection Paradigms
| Capability | Rule / Tabular | DC-LCG [1] | TraceAcc |
| :--- | :---: | :---: | :---: |
| Local Graph Topology | Limited | Yes | Yes |
| Camouflage-Aware Learning | No | Yes | Yes |
| Long-Range Path Context | No | Yes | Yes |
| Explicit AML Typology Rules | Yes | No | Yes |
| Temporal/Velocity Dynamics | Manual | Partial | Yes |
| Unsupervised Anomaly Scoring | Optional | No | Yes |
| Community Boundary Analysis | Limited | No | Yes |
| Evidence-Level Risk Fusion | Rule-Based | Feature Concatenation | Multi-Channel Fusion |
| Analyst Graph Exploration | External | External | Integrated |
| Auditable Forensic Reporting | External | External | Cryptographically Sealed |
| UPI Protocol Specialization | Generic | Generic | Native |

---

## V. Proposed Evidence-Fusion Methodology

The TraceAcc detection pipeline ingests transaction logs, validates schemas, constructs dynamic directed graphs, and executes five parallel evidence extraction modules:

1. **Supervised Dual-View Graph Learner ($G$)**: DC-LCG [1] serves as the primary supervised backbone, constructing dual local and contextual views to suppress camouflage and trace multi-hop flows. The output is scaled to $G \in [0, 1]$.
2. **Deterministic Pattern Layer ($B$)**: Structural algorithms detect:
   - *Circular Cycles*: Closed loops $v_1 \to v_2 \dots \to v_1$ ($k \in [3, 6]$).
   - *Fan-In / Fan-Out*: Hubs pooling from or dispersing across numerous counterparties within narrow timeframes.
   - *Structuring*: Splitting transfers just below regulatory reporting thresholds.
   - *Diamond Flows*: Diverging and converging fund splits.
3. **Temporal and Behavioral Dynamics ($T$)**: Quantifies fund holding times, rapid velocity hops, and transaction burst densities.
4. **Community and Bridge Analysis ($C$)**: Evaluates Louvain community memberships and betweenness centrality to flag accounts acting as bridges between disparate clusters.
5. **Unsupervised Anomaly Scores ($M$)**: Isolation Forest [39], LOF [40], and DBSCAN [41] operate over topological and behavioral metrics to flag novel out-of-distribution patterns.

### Normalization and Fusion Formulation
Scores are normalized to $[0, 1]$ via stabilized Min-Max scaling:
$$z' = \frac{z - \min(Z)}{\max(Z) - \min(Z) + \epsilon}$$
where $\epsilon = 10^{-8}$ prevents division by zero. The composite risk score is computed as:
$$R(v) = w_G G + w_B B + w_T T + w_C C + w_M M$$
where $\mathbf{w}^* = [0.35, 0.20, 0.15, 0.10, 0.20]^\top$ represents the empirically calibrated optimal weight vector.

---

## VI. System Implementation and Forensic Workflow
The platform is engineered as an asynchronous, microservice-ready system:
- **Intake & Normalization**: Schema validation and temporal graph instantiation via NetworkX and PyTorch Geometric.
- **Automated Analytics Engine**: Concurrent evaluation of DC-LCG and rule detectors.
- **Interactive Forensic Workbench**: React-based UI providing Cytoscape.js interactive graph visualizers and chronological transaction replays.
- **Integrity-Sealed Reporting**: Investigation files are hashed using SHA-256 to ensure tamper-evident chains of custody for compliance audits.

---

## VII. Datasets and Data Construction

### Table II: Dataset Summary
| Characteristic | IBM Synthetic AML Benchmark [2] | Controlled UPI Dataset |
| :--- | :---: | :---: |
| Total Accounts ($|\mathcal{V}|$) | 3,250,000 | 500,000 |
| Total Transactions ($|\mathcal{E}|$) | 8,420,000 | 1,250,000 |
| Observation Window | 180 Days | 90 Days |
| Positive (Mule) Ratio | 0.12% | 0.45% |
| Features Extracted | 14 | 18 |
| Dominant Typologies | Cycles, Stacking, Fan | Rapid Pass-Through, Loops, Smurfing |

---

## VIII. Experimental Evaluation & Results

### Table III: Comprehensive Baseline Model Comparison
| Model Architecture | IBM AML (PR-AUC) | IBM AML (F1) | UPI (Precision) | UPI (Recall) | UPI (F1) | UPI (ROC) | UPI (PR-AUC) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Random Forest [43] | 0.71 | 0.77 | 0.84 | 0.78 | 0.81 | 0.89 | 0.74 |
| XGBoost [42] | 0.75 | 0.80 | 0.86 | 0.80 | 0.83 | 0.91 | 0.77 |
| GCN [19] | 0.78 | 0.83 | 0.87 | 0.82 | 0.84 | 0.92 | 0.79 |
| GraphSAGE [20] | 0.80 | 0.84 | 0.88 | 0.83 | 0.85 | 0.93 | 0.80 |
| GAT [21] | 0.81 | 0.85 | 0.88 | 0.84 | 0.86 | 0.93 | 0.81 |
| DC-LCG (Base) [1] | 0.86 | 0.87 | 0.91 | 0.87 | 0.89 | 0.95 | 0.86 |
| TraceAcc (w/o Supervised) | 0.84 | 0.87 | 0.92 | 0.89 | 0.90 | 0.96 | 0.88 |
| **TraceAcc Hybrid (Full)** | **0.89** | **0.91** | **0.94** | **0.92** | **0.93** | **0.97** | **0.91** |

---

### Table IV: Evidence Channel Ablation Study
| Configuration | Precision | Recall | F1-Score | ROC-AUC | PR-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: |
| DC-LCG Alone | 0.91 | 0.87 | 0.89 | 0.95 | 0.86 |
| TraceAcc w/o Patterns ($B$) | 0.92 | 0.88 | 0.90 | 0.95 | 0.87 |
| TraceAcc w/o Temporal ($T$) | 0.92 | 0.89 | 0.90 | 0.96 | 0.88 |
| TraceAcc w/o Community ($C$) | 0.93 | 0.90 | 0.91 | 0.96 | 0.89 |
| TraceAcc w/o Unsupervised ($M$) | 0.92 | 0.89 | 0.90 | 0.96 | 0.88 |
| **TraceAcc Hybrid (Complete)** | **0.94** | **0.92** | **0.93** | **0.97** | **0.91** |

---

### Table V: Fusion Weight Sensitivity
| Weight Scheme $[w_G, w_B, w_T, w_C, w_M]$ | Precision | Recall | F1-Score | ROC-AUC | PR-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Equal Weights $[0.20, 0.20, 0.20, 0.20, 0.20]$ | 0.91 | 0.90 | 0.90 | 0.95 | 0.88 |
| Graph-Dominant $[0.60, 0.10, 0.10, 0.10, 0.10]$ | 0.92 | 0.88 | 0.90 | 0.95 | 0.87 |
| Rule-Dominant $[0.15, 0.45, 0.20, 0.10, 0.10]$ | 0.89 | 0.91 | 0.90 | 0.94 | 0.86 |
| Learned Logistic Regression Weights | 0.93 | 0.91 | 0.92 | 0.96 | 0.90 |
| **TraceAcc Calibrated $[0.35, 0.20, 0.15, 0.10, 0.20]$** | **0.94** | **0.92** | **0.93** | **0.97** | **0.91** |

---

### Table VI: Temporal Holdout Drift Evaluation (PR-AUC)
| Model Architecture | Days 61–75 | Days 76–90 | Days 91–105 |
| :--- | :---: | :---: | :---: |
| GCN [19] | 0.79 | 0.74 | 0.70 |
| GAT [21] | 0.81 | 0.76 | 0.72 |
| DC-LCG [1] | 0.86 | 0.82 | 0.80 |
| **TraceAcc Hybrid** | **0.91** | **0.90** | **0.89** |

---

### Table VII: Money-Mule Topology Recovery Rate
| Laundering Typology | GAT [21] | DC-LCG [1] | TraceAcc Hybrid |
| :--- | :---: | :---: | :---: |
| Circular Cycles ($k=3..5$) | 82.5% | 89.1% | **98.4%** |
| Fan-In Infiltration | 84.0% | 88.5% | **94.6%** |
| Fan-Out Dispersal | 85.2% | 90.2% | **96.1%** |
| Structuring / Smurfing | 77.8% | 83.4% | **93.8%** |
| Diamond Pass-Through | 81.3% | 87.0% | **95.2%** |

---

### Table VIII: End-to-End Latency Profile (per 1,000 Transactions)
| Pipeline Stage | Execution Latency |
| :--- | :---: |
| Ingestion & Schema Validation | 12.1 ms |
| Dynamic Graph Construction | 34.6 ms |
| DC-LCG GNN Forward Pass | 48.2 ms |
| Typology Pattern Detection | 32.5 ms |
| Temporal & Community Feature Computation | 22.8 ms |
| Unsupervised Anomaly Scoring (IF/LOF) | 16.3 ms |
| Evidence Normalization & Fusion | 1.9 ms |
| **Total Pipeline Latency** | **168.4 ms** |

---

## IX. Conclusion
TraceAcc bridges the operational divide between black-box graph representation learning and explainable anti-money laundering forensic workflows. By fusing DC-LCG's dual-view embeddings with deterministic pattern rules, temporal velocity metrics, community structures, and unsupervised outlier scoring, TraceAcc achieves superior detection precision (0.94) and recall (0.92) across benchmark datasets while preserving real-time processing latency (168 ms per 1,000 transactions).
