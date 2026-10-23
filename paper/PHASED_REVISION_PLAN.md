# TraceAcc Journal Manuscript — Phased Revision & Enhancement Plan

**Target Venues**: IEEE Transactions on Information Forensics and Security (TIFS) / IEEE Transactions on Knowledge and Data Engineering (TKDE) / Elsevier Computers & Security  
**Current Status**: Comprehensive peer-review and editorial audit completed.  
**Execution Strategy**: 6 Sequential Phases addressing all structural, mathematical, empirical, visual, and bibliographic deficiencies.

---

## Phase 1: Critical Bibliographic Remediation (Immediate Desk-Reject Prevention)
*Goal: Eliminate all incomplete citations, missing author metadata, and corrupted diacritics.*

- **1.1 Restore Missing Authors**:
  - `[8]` Applied Soft Computing: Add authors **L. Zheng, Z. Shen, C. Wu, and D. Guan**.
  - `[9]` Engineering Applications of Artificial Intelligence: Add authors **Y. Chen, X. Dong, Y. Shen, and Q. He**.
  - `[10]` Journal of Finance and Data Science: Add authors **X. Zhang, W. He, J. Wang, and Y. Lin**.
  - `[13]` Journal of Safety Science and Resilience: Add authors **Z. Zhao, Y. Wang, F. Sun, and H. Meng**.
  - `[14]` Forensic Science International: Digital Investigation: Add authors **S. Liu, M. Bilal, J. Du, and H. Dai**.
  - `[15]` Applied Sciences: Add authors **A. Pourhabibi, K. L. Ong, B. H. Kam, and Y. W. Boo**.
- **1.2 Repair Corrupted Diacritics and Character Encodings**:
  - Replace `Niederh ˇ ausern` and `Anghel, ¨` with `L. von Niederhäusern` and `A. S. Anghel`.
  - Replace `P. Velickovi ˇ c`, `P. Li ´ o`, `Y. \` Bengio` with `P. Veličković`, `P. Liò`, `Y. Bengio`.
  - Replace `P. Dollar` and `for ´ Dense` with `P. Dollár` and `“Focal Loss for Dense Object Detection”`.
- **1.3 Build Unified BibTeX Database (`references.bib`)**:
  - Compile all 54 entries into standard BibTeX format with validated DOIs and URLs.

---

## Phase 2: Structural Realignment & Academic Tone Modernization
*Goal: Transition from product-manual style to peer-reviewed scientific rigor.*

- **2.1 Section Title Normalization**:
  - Change colloquial heading `IV. WHAT IS NEW IN TRACEACC?` to formal academic title:
    `IV. SYSTEM ARCHITECTURE AND DIFFERENTIATION FROM BASELINES`.
- **2.2 De-commercialization of System Nomenclature**:
  - Replace commercial branding (`TraceAcc Pro`, `TraceLab`, `InvoSpace`) with formal scientific terminology:
    - `TraceAcc Pro` $\to$ **The TraceAcc framework / system**
    - `TraceLab` $\to$ **Automated Analytics & Screening Pipeline**
    - `InvoSpace` $\to$ **Interactive Forensic Workbench**
- **2.3 Author Block & Affiliation Standards**:
  - Format author blocks in IEEE conference/transaction style.
  - Upgrade contact details to institutional domains (`@dsce.edu.in`) with designated corresponding author (`*`).
- **2.4 Seamless Narrative Flow**:
  - Fix broken cross-page sentence between Page 5 and Page 6 across Figure 4.

---

## Phase 3: Mathematical Formalization & Notational Unification
*Goal: Provide rigorous, consistent mathematical definitions across all evidence families.*

- **3.1 Temporal Graph Formalization (Eq. 1)**:
  - Define $G_t = (V_t, E_t, X_t)$ where:
    $$V_t = \{v_1, v_2, \dots, v_n\}, \quad E_t = \{e_k = (u_k, v_k, t_k, \mathbf{w}_k)\}_{k=1}^m$$
    with directed timestamped transfer events $t_k \in [0, t]$ and feature vectors $\mathbf{w}_k \in \mathbb{R}^{d_e}$.
- **3.2 Unified Evidence Vector (Eq. 2 & Eq. 3 Harmonization)**:
  - Formally bridge the abstract evidence set $E_v$ to the score vector:
    $$\mathbf{e}_v = [e_{\text{graph}}, e_{\text{behavioral}}, e_{\text{temporal}}, e_{\text{community}}, e_{\text{ML}}]^\top \equiv [G, B, T, C, M]^\top \in [0, 1]^5$$
- **3.3 Min-Max Normalization with Numerical Safeguards**:
  - Express scaling with numerical stabilizer $\epsilon = 10^{-8}$:
    $$z' = \frac{z - \min(Z)}{\max(Z) - \min(Z) + \epsilon}$$
- **3.4 Evidence Fusion Objective**:
  - Express final risk as linear operator $R(v) = \mathbf{w}^\top \mathbf{e}_v$ subject to $\sum_{i} w_i = 1, w_i \ge 0$, and define the validation loss objective for parameter tuning.

---

## Phase 4: Experimental Completion & Discrepancy Resolution
*Goal: Fully deliver all 6 experiments promised in Table II.*

- **4.1 Disambiguate Benchmark Datasets (Table III)**:
  - Split Table III into two distinct evaluation panels:
    - **Panel A**: IBM Synthetic AML Benchmark (8.4M transactions)
    - **Panel B**: Controlled UPI Transaction Dataset (1.0M transactions)
- **4.2 Publish Missing Experiments**:
  - **Weight Sensitivity (Table V)**: Compare calibrated weights $(35/20/15/10/20)$ against Equal Weighting $(20/20/20/20/20)$, Graph-Dominant $(60/10/10/10/10)$, and Logistic Regression Weights.
  - **Temporal Holdout Evaluation (Table VI)**: Evaluate performance across time-decay splits ($T_0 \to T_1$ train vs. $T_2$ test) showing drift stability.
  - **Mule-Ring Recall by Topology (Table VII)**: Report exact detection recall for Circular, Fan-in/out, Layering Chains, Structuring, and Diamond/Pair structures.
  - **Inference Latency & Scalability (Table VIII)**: Graph ingestion, DC-LCG forward pass, rule extraction, and fusion latency in milliseconds per 1,000 transactions.
- **4.3 Dataset Descriptive Metadata Table**:
  - Include full summary table: $|V|$, $|E|$, fraudulent node/edge ratio, time duration, and feature dimensions.

---

## Phase 5: High-Resolution Visual Architecture & Diagram Overhaul
*Goal: Replace low-res, overlapping, and distorted figures with publication-quality vector figures.*

- **5.1 Redesign Figure 4 (Data Flow Architecture)**:
  - Rebuild diagram cleanly to completely eliminate overlapping text in boxes 4C, 5, and 6.
  - Ensure all mathematical equations and labels fit within generous card padding with clean orthogonal connector lines.
- **5.2 Redesign Figure 2 (Forensic Workflow)**:
  - Replace yellow-box screenshot with a clean, high-contrast flowchart.
  - Eliminate colloquial UI notes; use formal engineering terminology.
- **5.3 Redraw Figure 3 (Pattern Distribution)**:
  - Re-plot pattern frequencies using a **logarithmic scale** (`$\log_{10}$ instances`) so that Circular (200), Fan-in (50), and Fan-out (50) are distinctly visible alongside Structuring (2,597) and Diamond (2,446).
- **5.4 Enhance Figure 1 (Core GNN Architecture)**:
  - Render with high-DPI vector typography so all module labels remain sharp at 100% print zoom.

---

## Phase 6: Camera-Ready Verification & Formatting Polish
*Goal: Ensure 100% adherence to IEEE Transactions style and layout rules.*

- **6.1 Column Balancing**:
  - Balance columns on the final reference page using `\balance`.
- **6.2 Float & Caption Hygiene**:
  - Place table captions above tables in small caps (`\textsc{Table I}`).
  - Place figure captions below figures with clear takeaway descriptions.
- **6.3 Ethical & Governance Statement**:
  - Add explicit discussion on regulatory compliance (FATF, RBI, PMLA), privacy-preserving safeguards, and human-in-the-loop decision-support guarantees.
