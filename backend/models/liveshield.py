"""
models/liveshield.py — Database models for TraceAcc LiveShield Transaction Simulator & Real-Time Detection (Phase 1 & Phase 2).

Phase 1 Models:
- Simulation: Tracks persistent simulation lifecycle state, configurations, detection settings, and progress metrics.
- SimulationTransaction: Persistent record of generated synthetic transactions with Numeric(18,2) precision.
- SimulationPreset: Reusable configuration templates (built-in and custom).
- SimulationEvent: Audit and state transition timeline log.

Phase 2 Models:
- SimulationDecisionRecord: Granular record of every payment decision, fast screening signals, DC-LCG inference, latency metrics, and operator overrides.
- SimulationEvaluationSummary: Aggregate performance metrics (Precision, Recall, F1, FPR, FNR, network-level metrics, and latency percentiles).
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    DateTime,
    Boolean,
    Float,
    ForeignKey,
    JSON,
    Index,
    Text,
)
from sqlalchemy.sql import func
from db.database import Base


class Simulation(Base):
    __tablename__ = "liveshield_simulations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    mode = Column(String(50), nullable=False, default="basic")  # 'basic' | 'advanced'
    
    # State machine: DRAFT, VALIDATING, READY, RUNNING, PAUSING, PAUSED, STOPPING, STOPPED, COMPLETED, FAILED
    status = Column(String(50), nullable=False, default="DRAFT", index=True)
    
    # Detection Mode: 'shadow' | 'assisted' | 'automated'
    detection_mode = Column(String(50), nullable=False, default="shadow")
    
    # Concurrency & Worker Lease
    worker_id = Column(String(100), nullable=True)
    heartbeat_at = Column(DateTime(timezone=True), nullable=True)
    
    # Full JSON configuration (BasicConfig or AdvancedConfig)
    config = Column(JSON, nullable=False, default=dict)
    
    # Phase 2: Detection engine & screening rules config
    detection_config = Column(JSON, nullable=True, default=dict)
    
    # Real-time / summary stats snapshot (JSON)
    stats = Column(JSON, nullable=False, default=dict)
    
    # Metadata & Relations
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Case creation policy: 'NONE' | 'ON_CRITICAL_ALERT' | 'ON_SIMULATION_START' | 'MANUAL'
    case_creation_policy = Column(String(50), nullable=False, default="NONE")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    stopped_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_liveshield_sim_org_status", "organization_id", "status"),
        Index("ix_liveshield_sim_created_at", "created_at"),
    )


class SimulationTransaction(Base):
    __tablename__ = "liveshield_transactions"

    id = Column(Integer, primary_key=True, index=True)
    simulation_id = Column(Integer, ForeignKey("liveshield_simulations.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_id = Column(String(100), nullable=True, index=True)
    step_index = Column(Integer, nullable=True, default=0)
    
    # Transaction core fields
    transaction_id = Column(String(100), nullable=False, index=True)
    sender_account = Column(String(100), nullable=False, index=True)
    receiver_account = Column(String(100), nullable=False, index=True)
    
    # Financial precision: Numeric(18, 2)
    amount = Column(Numeric(18, 2), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    transaction_type = Column(String(50), nullable=False, default="TRANSFER")
    channel = Column(String(50), nullable=True, default="ONLINE")
    
    # Timestamps
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    scheduled_timestamp = Column(DateTime(timezone=True), nullable=True)
    generated_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Metadata & Geography
    source_country = Column(String(5), nullable=True, default="US")
    dest_country = Column(String(5), nullable=True, default="US")
    device_id = Column(String(100), nullable=True)
    merchant_id = Column(String(100), nullable=True)
    
    # Ground Truth Separation (F01–F18 or legitimate)
    scenario_id = Column(String(50), nullable=True, index=True)
    synthetic_ground_truth = Column(String(50), nullable=False, default="legitimate")  # 'legitimate' | 'fraudulent'
    account_ground_truth = Column(String(50), nullable=True)
    sequence_ground_truth = Column(String(50), nullable=True)
    scenario_metadata = Column(JSON, nullable=True, default=dict)
    
    random_seed = Column(Integer, nullable=True)
    is_synthetic = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_ls_txn_sim_time", "simulation_id", "timestamp"),
        Index("ix_ls_txn_sim_scenario", "simulation_id", "scenario_id"),
        Index("ix_ls_txn_sim_truth", "simulation_id", "synthetic_ground_truth"),
    )


class SimulationPreset(Base):
    __tablename__ = "liveshield_presets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    mode = Column(String(50), nullable=False, default="basic")
    
    # Preset JSON config
    config = Column(JSON, nullable=False)
    detection_config = Column(JSON, nullable=True, default=dict)
    is_builtin = Column(Boolean, nullable=False, default=False)
    
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SimulationEvent(Base):
    __tablename__ = "liveshield_events"

    id = Column(Integer, primary_key=True, index=True)
    simulation_id = Column(Integer, ForeignKey("liveshield_simulations.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)  # 'STATE_CHANGE', 'BURST_START', 'SYSTEM_RECOVERY', 'DECISION_OVERRIDE', etc.
    message = Column(Text, nullable=False)
    details = Column(JSON, nullable=True, default=dict)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ============================================================
# PHASE 2: DETECTION, DECISIONS & EVALUATION MODELS
# ============================================================

class SimulationDecisionRecord(Base):
    __tablename__ = "liveshield_decisions"

    id = Column(Integer, primary_key=True, index=True)
    simulation_id = Column(Integer, ForeignKey("liveshield_simulations.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_id = Column(String(100), nullable=False, index=True)
    sequence_id = Column(String(100), nullable=True, index=True)
    step_index = Column(Integer, nullable=True, default=0)
    
    sender_account = Column(String(100), nullable=False, index=True)
    receiver_account = Column(String(100), nullable=False, index=True)
    amount = Column(Numeric(18, 2), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Mode & Decisions
    detection_mode = Column(String(50), nullable=False, default="shadow")  # 'shadow' | 'assisted' | 'automated'
    initial_decision = Column(String(50), nullable=False, default="APPROVE")  # APPROVE | FLAG | HOLD | REJECT
    final_decision = Column(String(50), nullable=False, default="APPROVE")    # APPROVE | FLAG | HOLD | REJECT | MANUAL_APPROVE | MANUAL_REJECT
    decision_reason = Column(Text, nullable=True)
    
    # Fast Screening Signals
    fast_screening_score = Column(Float, nullable=False, default=0.0)
    fast_screening_signals = Column(JSON, nullable=True, default=list)
    
    # DC-LCG Graph Inference
    dclcg_score = Column(Float, nullable=True)
    dclcg_disguise_score = Column(Float, nullable=True)
    dclcg_top_paths = Column(JSON, nullable=True, default=list)
    model_version = Column(String(100), nullable=True)
    graph_version = Column(Integer, nullable=True)
    
    # Calibrated Risk
    combined_risk_score = Column(Float, nullable=False, default=0.0)
    risk_tier = Column(String(20), nullable=False, default="LOW")  # LOW | MEDIUM | HIGH | CRITICAL
    
    # Granular Timing Telemetry (ISO & Epoch ms)
    t_generated = Column(DateTime(timezone=True), nullable=True)
    t_ingested = Column(DateTime(timezone=True), nullable=True)
    t_screened = Column(DateTime(timezone=True), nullable=True)
    t_decided = Column(DateTime(timezone=True), nullable=True)
    t_graph_inferred = Column(DateTime(timezone=True), nullable=True)
    
    latency_screening_ms = Column(Float, nullable=True)
    latency_model_ms = Column(Float, nullable=True)
    latency_total_ms = Column(Float, nullable=True)
    
    # Assisted Mode Operator Action
    operator_action = Column(String(50), nullable=True)  # 'MANUAL_APPROVE' | 'MANUAL_REJECT'
    operator_notes = Column(Text, nullable=True)
    operator_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    operator_at = Column(DateTime(timezone=True), nullable=True)
    
    # Synthetic Ground Truth & Evaluation
    synthetic_ground_truth = Column(String(50), nullable=False, default="legitimate")
    scenario_id = Column(String(50), nullable=True, index=True)
    evaluation_label = Column(String(50), nullable=True, index=True)  # 'TRUE_POSITIVE', 'TRUE_NEGATIVE', 'FALSE_POSITIVE', 'FALSE_NEGATIVE'

    __table_args__ = (
        Index("ix_ls_dec_sim_decision", "simulation_id", "final_decision"),
        Index("ix_ls_dec_sim_tier", "simulation_id", "risk_tier"),
        Index("ix_ls_dec_sim_eval", "simulation_id", "evaluation_label"),
    )


class SimulationEvaluationSummary(Base):
    __tablename__ = "liveshield_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    simulation_id = Column(Integer, ForeignKey("liveshield_simulations.id", ondelete="CASCADE"), nullable=False, index=True)
    evaluated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Transaction counts
    total_transactions = Column(Integer, nullable=False, default=0)
    total_legitimate = Column(Integer, nullable=False, default=0)
    total_fraudulent = Column(Integer, nullable=False, default=0)
    
    # Decision distribution
    approved_count = Column(Integer, nullable=False, default=0)
    flagged_count = Column(Integer, nullable=False, default=0)
    held_count = Column(Integer, nullable=False, default=0)
    rejected_count = Column(Integer, nullable=False, default=0)
    
    # Transaction-Level Confusion Matrix & Metrics
    true_positives = Column(Integer, nullable=False, default=0)
    true_negatives = Column(Integer, nullable=False, default=0)
    false_positives = Column(Integer, nullable=False, default=0)
    false_negatives = Column(Integer, nullable=False, default=0)
    
    precision = Column(Float, nullable=False, default=0.0)
    recall = Column(Float, nullable=False, default=0.0)
    f1_score = Column(Float, nullable=False, default=0.0)
    accuracy = Column(Float, nullable=False, default=0.0)
    false_positive_rate = Column(Float, nullable=False, default=0.0)
    false_negative_rate = Column(Float, nullable=False, default=0.0)
    
    # Network / Sequence-Level Metrics
    total_sequences = Column(Integer, nullable=False, default=0)
    network_true_positives = Column(Integer, nullable=False, default=0)
    network_false_positives = Column(Integer, nullable=False, default=0)
    network_false_negatives = Column(Integer, nullable=False, default=0)
    network_precision = Column(Float, nullable=False, default=0.0)
    network_recall = Column(Float, nullable=False, default=0.0)
    network_f1 = Column(Float, nullable=False, default=0.0)
    
    # Latency Percentiles (ms)
    latency_screening_p50 = Column(Float, nullable=False, default=0.0)
    latency_screening_p95 = Column(Float, nullable=False, default=0.0)
    latency_screening_p99 = Column(Float, nullable=False, default=0.0)
    latency_model_p50 = Column(Float, nullable=False, default=0.0)
    latency_model_p95 = Column(Float, nullable=False, default=0.0)
    latency_model_p99 = Column(Float, nullable=False, default=0.0)
    latency_total_p50 = Column(Float, nullable=False, default=0.0)
    latency_total_p95 = Column(Float, nullable=False, default=0.0)
    latency_total_p99 = Column(Float, nullable=False, default=0.0)
    
    # Detailed per-scenario metrics breakdown (F01–F18)
    scenario_metrics = Column(JSON, nullable=True, default=dict)


# ============================================================
# PHASE 2.5: CONTINUOUS RISK RE-EVALUATION (CRRE) MODELS
# ============================================================

class TransactionRiskAssessment(Base):
    __tablename__ = "liveshield_risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    simulation_id = Column(Integer, ForeignKey("liveshield_simulations.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_id = Column(String(100), nullable=False, index=True)
    assessment_version = Column(Integer, nullable=False, default=1)
    
    # Independent State Machine: Payment Status vs Risk Status
    payment_status = Column(String(50), nullable=False, default="APPROVED")  # PENDING, APPROVED, HELD, REJECTED, RELEASED, CANCELLED
    previous_risk_score = Column(Float, nullable=True)
    current_risk_score = Column(Float, nullable=False, default=0.0)
    previous_risk_status = Column(String(50), nullable=True)  # LOW_RISK, UNDER_OBSERVATION, SUSPICIOUS, HIGH_RISK, UNDER_REVIEW, CLEARED
    current_risk_status = Column(String(50), nullable=False, default="LOW_RISK")
    
    # Assessment Metadata
    assessment_type = Column(String(50), nullable=False, default="INITIAL")  # INITIAL, ASYNC_GRAPH, RETROSPECTIVE, INVESTIGATION_OVERRIDE, SCHEDULED
    triggering_event_id = Column(Integer, nullable=True)
    triggering_transaction_id = Column(String(100), nullable=True, index=True)
    model_version = Column(String(100), nullable=True)
    graph_version = Column(Integer, nullable=True)
    feature_schema_version = Column(String(50), nullable=True, default="v2.5")
    
    # Evidence & Audit Trail
    evidence_references = Column(JSON, nullable=True, default=dict)
    assessment_timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    processing_latency_ms = Column(Float, nullable=True, default=0.0)
    assessment_reason = Column(Text, nullable=True)
    is_current = Column(Boolean, nullable=False, default=True, index=True)
    
    # Ground Truth Separation
    synthetic_ground_truth = Column(String(50), nullable=False, default="legitimate")

    __table_args__ = (
        Index("ix_ls_ra_sim_txn_ver", "simulation_id", "transaction_id", "assessment_version", unique=True),
        Index("ix_ls_ra_sim_status", "simulation_id", "current_risk_status"),
        Index("ix_ls_ra_current", "simulation_id", "transaction_id", "is_current"),
    )


class RiskReevaluationEvent(Base):
    __tablename__ = "liveshield_reevaluation_events"

    id = Column(Integer, primary_key=True, index=True)
    simulation_id = Column(Integer, ForeignKey("liveshield_simulations.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_type = Column(String(50), nullable=False, index=True)  # NEW_TRANSACTION, NEW_GRAPH_PATTERN, INVESTIGATION_EVIDENCE, SCHEDULED
    triggering_transaction_id = Column(String(100), nullable=True, index=True)
    
    affected_transaction_count = Column(Integer, nullable=False, default=0)
    queued_transaction_count = Column(Integer, nullable=False, default=0)
    completed_transaction_count = Column(Integer, nullable=False, default=0)
    failed_transaction_count = Column(Integer, nullable=False, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    processing_status = Column(String(50), nullable=False, default="COMPLETED")  # PENDING, PROCESSING, COMPLETED, FAILED
    details = Column(JSON, nullable=True, default=dict)

