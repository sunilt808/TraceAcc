"""
schemas/liveshield.py — Pydantic schemas for TraceAcc LiveShield Transaction Simulator & Detection (Phase 1 & Phase 2).

Financial accuracy:
- All financial amounts use Decimal with two decimal places.
"""
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, field_validator


# ============================================================
# SCENARIO CONFIGURATION SCHEMAS (F01 to F18)
# ============================================================

class ScenarioConfigItem(BaseModel):
    scenario_id: str = Field(..., description="Unique scenario ID, e.g., 'F01'")
    enabled: bool = True
    weight: Optional[Decimal] = Field(default=Decimal("1.0"), ge=0, le=100, description="Relative weight or percentage")
    params: Dict[str, Any] = Field(default_factory=dict, description="Scenario-specific parameters")


class BasicSimulationConfig(BaseModel):
    # Mode
    mode: str = Field(default="basic", pattern="^basic$")
    
    # Detection Mode: 'shadow' | 'assisted' | 'automated'
    detection_mode: str = Field(default="shadow", pattern="^(shadow|assisted|automated)$")
    
    # 4.1 Transaction Count & Rate
    total_transactions: Optional[int] = Field(default=1000, ge=1, le=1000000)
    target_tps: Decimal = Field(default=Decimal("50.0"), ge=Decimal("0.1"), le=Decimal("2000.0"))
    duration_seconds: Optional[int] = Field(default=None, ge=1, le=86400, description="Max duration in seconds")
    unlimited: bool = Field(default=False, description="Run until manually stopped")
    
    # 4.2 Traffic Composition
    traffic_composition: str = Field(default="mixed", pattern="^(legitimate_only|fraudulent_only|mixed)$")
    legitimate_percentage: Decimal = Field(default=Decimal("80.0"), ge=Decimal("0.0"), le=Decimal("100.0"))
    fraudulent_percentage: Decimal = Field(default=Decimal("20.0"), ge=Decimal("0.0"), le=Decimal("100.0"))
    
    # 4.3 Fraud Selection
    fraud_selection_mode: str = Field(default="all", pattern="^(all|random_single|single|selected)$")
    selected_scenarios: List[str] = Field(default_factory=lambda: ["F01", "F02", "F03", "F04", "F05", "F06"])
    
    # 4.4 Basic Transaction Parameters
    min_amount: Decimal = Field(default=Decimal("10.00"), ge=Decimal("0.01"))
    max_amount: Decimal = Field(default=Decimal("10000.00"), ge=Decimal("0.01"))
    currency: str = Field(default="USD", max_length=10)
    num_accounts: int = Field(default=60, ge=2, le=50000)
    txn_prefix: str = Field(default="TXN", max_length=20)
    random_seed: Optional[int] = None
    
    # Phase 2 Detection parameters
    detection_config: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @field_validator("fraudulent_percentage")
    @classmethod
    def validate_percentages(cls, v, info):
        legit = info.data.get("legitimate_percentage", Decimal("80.0"))
        comp = info.data.get("traffic_composition", "mixed")
        if comp == "mixed" and (legit + v) != Decimal("100.0"):
            if abs((legit + v) - Decimal("100.0")) > Decimal("0.1"):
                raise ValueError(f"Legitimate ({legit}%) and Fraudulent ({v}%) must sum to 100%")
        return v


class AdvancedSimulationConfig(BaseModel):
    mode: str = Field(default="advanced", pattern="^advanced$")
    detection_mode: str = Field(default="shadow", pattern="^(shadow|assisted|automated)$")
    
    # 5.1 Throughput & Traffic Pattern
    total_transactions: Optional[int] = Field(default=5000, ge=1, le=5000000)
    target_tps: Decimal = Field(default=Decimal("100.0"), ge=Decimal("0.1"), le=Decimal("5000.0"))
    min_tps: Optional[Decimal] = Field(default=Decimal("10.0"), ge=Decimal("0.1"))
    max_tps: Optional[Decimal] = Field(default=Decimal("200.0"), ge=Decimal("0.1"))
    duration_seconds: Optional[int] = Field(default=None, ge=1, le=604800)
    unlimited: bool = Field(default=False)
    
    # Traffic Curve Pattern: constant, random, burst, ramp, wave, scheduled, custom
    traffic_pattern: str = Field(default="constant", pattern="^(constant|random|burst|ramp|wave|scheduled|custom)$")
    burst_size: Optional[int] = Field(default=50, ge=1)
    burst_interval_seconds: Optional[int] = Field(default=30, ge=1)
    ramp_up_seconds: Optional[int] = Field(default=10, ge=0)
    ramp_down_seconds: Optional[int] = Field(default=10, ge=0)
    timing_jitter_ms: Optional[int] = Field(default=5, ge=0, le=5000)
    batch_size: int = Field(default=25, ge=1, le=1000)
    
    # 5.2 Traffic Composition & Exact vs Probabilistic
    traffic_composition: str = Field(default="mixed", pattern="^(legitimate_only|fraudulent_only|mixed)$")
    legitimate_percentage: Decimal = Field(default=Decimal("80.0"), ge=Decimal("0.0"), le=Decimal("100.0"))
    fraudulent_percentage: Decimal = Field(default=Decimal("20.0"), ge=Decimal("0.0"), le=Decimal("100.0"))
    composition_mode: str = Field(default="exact", pattern="^(exact|probabilistic)$")
    
    # 6. Scenario-specific distributions & parameters (F01 to F18)
    scenarios: List[ScenarioConfigItem] = Field(default_factory=list)
    
    # 7. Fraud Timing & Scheduling
    fraud_start_delay_seconds: int = Field(default=0, ge=0)
    fraud_min_delay_ms: int = Field(default=50, ge=0)
    fraud_max_delay_ms: int = Field(default=500, ge=0)
    fraud_free_intervals: List[Dict[str, int]] = Field(default_factory=list)
    
    # 8. Legitimate categories weights
    legitimate_category_weights: Dict[str, Decimal] = Field(default_factory=lambda: {
        "p2p": Decimal("20.0"),
        "merchant": Decimal("25.0"),
        "salary": Decimal("10.0"),
        "bill": Decimal("10.0"),
        "subscription": Decimal("5.0"),
        "ecommerce": Decimal("15.0"),
        "refund": Decimal("3.0"),
        "b2b": Decimal("5.0"),
        "everyday": Decimal("5.0"),
        "high_value": Decimal("2.0"),
    })
    
    # 9. Synthetic Population
    num_accounts: int = Field(default=100, ge=5, le=100000)
    personal_account_ratio: Decimal = Field(default=Decimal("0.75"), ge=Decimal("0.0"), le=Decimal("1.0"))
    business_account_ratio: Decimal = Field(default=Decimal("0.20"), ge=Decimal("0.0"), le=Decimal("1.0"))
    merchant_account_ratio: Decimal = Field(default=Decimal("0.05"), ge=Decimal("0.0"), le=Decimal("1.0"))
    dormant_account_ratio: Decimal = Field(default=Decimal("0.05"), ge=Decimal("0.0"), le=Decimal("1.0"))
    
    min_amount: Decimal = Field(default=Decimal("5.00"), ge=Decimal("0.01"))
    max_amount: Decimal = Field(default=Decimal("50000.00"), ge=Decimal("0.01"))
    currency: str = Field(default="USD", max_length=10)
    txn_prefix: str = Field(default="TXN", max_length=20)
    random_seed: Optional[int] = None
    
    # Phase 2 Detection parameters
    detection_config: Optional[Dict[str, Any]] = Field(default_factory=dict)


# ============================================================
# API REQUEST & RESPONSE SCHEMAS
# ============================================================

class SimulationCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    mode: str = Field(default="basic", pattern="^(basic|advanced)$")
    detection_mode: str = Field(default="shadow", pattern="^(shadow|assisted|automated)$")
    target_organization_id: Optional[int] = None
    case_creation_policy: Optional[str] = Field(default="NONE", pattern="^(NONE|ON_CRITICAL_ALERT|ON_SIMULATION_START|MANUAL)$")
    config: Union[BasicSimulationConfig, AdvancedSimulationConfig, Dict[str, Any]]
    detection_config: Optional[Dict[str, Any]] = Field(default_factory=dict)


class SimulationUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    detection_mode: Optional[str] = Field(None, pattern="^(shadow|assisted|automated)$")
    case_creation_policy: Optional[str] = Field(None, pattern="^(NONE|ON_CRITICAL_ALERT|ON_SIMULATION_START|MANUAL)$")
    config: Optional[Union[BasicSimulationConfig, AdvancedSimulationConfig, Dict[str, Any]]] = None
    detection_config: Optional[Dict[str, Any]] = None


class SimulationResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    mode: str
    detection_mode: str = "shadow"
    status: str
    case_creation_policy: str = "NONE"
    worker_id: Optional[str] = None
    heartbeat_at: Optional[datetime] = None
    config: Dict[str, Any]
    detection_config: Optional[Dict[str, Any]] = None
    stats: Dict[str, Any]
    organization_id: int
    created_by_id: int
    case_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SimulationValidationResult(BaseModel):
    valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    estimated_duration_seconds: Optional[float] = None
    estimated_total_transactions: Optional[int] = None
    estimated_legitimate_count: Optional[int] = None
    estimated_fraudulent_count: Optional[int] = None


class SimulationStatsResponse(BaseModel):
    simulation_id: int
    status: str
    detection_mode: str = "shadow"
    configured_tps: float
    actual_tps: float
    published_tps: float
    total_generated: int
    total_legitimate: int
    total_fraudulent: int
    fraud_percentage: float
    total_volume: float
    elapsed_seconds: float
    remaining_seconds: Optional[float] = None
    active_scenarios: List[str] = Field(default_factory=list)
    scenario_counts: Dict[str, int] = Field(default_factory=dict)
    queue_backlog: int = 0
    held_count: int = 0
    worker_status: str = "IDLE"
    latency_ms: float = 0.0
    evaluation: Optional[Dict[str, Any]] = None
    graph_worker_stats: Optional[Dict[str, Any]] = None


class TransactionResponse(BaseModel):
    id: int
    simulation_id: int
    sequence_id: Optional[str] = None
    step_index: Optional[int] = 0
    transaction_id: str
    sender_account: str
    receiver_account: str
    amount: Decimal
    currency: str
    transaction_type: str
    channel: Optional[str] = None
    timestamp: datetime
    scheduled_timestamp: Optional[datetime] = None
    source_country: Optional[str] = "US"
    dest_country: Optional[str] = "US"
    scenario_id: Optional[str] = None
    synthetic_ground_truth: str
    is_synthetic: bool = True

    class Config:
        from_attributes = True


class DecisionRecordResponse(BaseModel):
    id: Optional[int] = None
    simulation_id: int
    transaction_id: str
    sequence_id: Optional[str] = None
    step_index: Optional[int] = 0
    sender_account: str
    receiver_account: str
    amount: Decimal
    timestamp: datetime
    detection_mode: str
    initial_decision: str
    final_decision: str
    decision_reason: Optional[str] = None
    fast_screening_score: float
    fast_screening_signals: Optional[List[Dict[str, Any]]] = None
    dclcg_score: Optional[float] = None
    dclcg_disguise_score: Optional[float] = None
    dclcg_top_paths: Optional[List[Any]] = None
    model_version: Optional[str] = None
    graph_version: Optional[int] = None
    combined_risk_score: float
    risk_tier: str
    latency_screening_ms: Optional[float] = None
    latency_model_ms: Optional[float] = None
    latency_total_ms: Optional[float] = None
    operator_action: Optional[str] = None
    operator_notes: Optional[str] = None
    synthetic_ground_truth: str
    scenario_id: Optional[str] = None
    evaluation_label: Optional[str] = None

    class Config:
        from_attributes = True


class DecisionOverrideRequest(BaseModel):
    action: str = Field(..., pattern="^(MANUAL_APPROVE|MANUAL_REJECT)$")
    notes: Optional[str] = None


class EvaluationSummaryResponse(BaseModel):
    simulation_id: int
    total_transactions: int
    total_legitimate: int
    total_fraudulent: int
    approved_count: int
    flagged_count: int
    held_count: int
    rejected_count: int
    true_positives: int
    true_negatives: int
    false_positives: int
    false_negatives: int
    precision: float
    recall: float
    f1_score: float
    accuracy: float
    false_positive_rate: float
    false_negative_rate: float
    total_sequences: int
    network_true_positives: int
    network_false_positives: int
    network_false_negatives: int
    network_precision: float
    network_recall: float
    network_f1: float
    latency_screening_p50: float
    latency_screening_p95: float
    latency_screening_p99: float
    latency_model_p50: float
    latency_model_p95: float
    latency_model_p99: float
    latency_total_p50: float
    latency_total_p95: float
    latency_total_p99: float
    scenario_metrics: Optional[Dict[str, Any]] = None


class ModelStatusResponse(BaseModel):
    model_loaded: bool
    model_version: str
    device: str
    model_path: str
    weights_shape: Optional[Dict[str, Any]] = None
    graph_stats: Optional[Dict[str, Any]] = None


class PresetCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    mode: str = Field(default="basic", pattern="^(basic|advanced)$")
    config: Dict[str, Any]
    detection_config: Optional[Dict[str, Any]] = None


class PresetResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    mode: str
    config: Dict[str, Any]
    detection_config: Optional[Dict[str, Any]] = None
    is_builtin: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScenarioInfoResponse(BaseModel):
    scenario_id: str
    name: str
    category: str
    description: str
    default_params: Dict[str, Any]
    param_schema: Dict[str, Any]


# ============================================================
# PHASE 2.5: CONTINUOUS RISK RE-EVALUATION SCHEMAS
# ============================================================

class RiskAssessmentResponse(BaseModel):
    id: Optional[int] = None
    simulation_id: int
    transaction_id: str
    assessment_version: int
    payment_status: str
    previous_risk_score: Optional[float] = None
    current_risk_score: float
    previous_risk_status: Optional[str] = None
    current_risk_status: str
    assessment_type: str
    triggering_event_id: Optional[int] = None
    triggering_transaction_id: Optional[str] = None
    model_version: Optional[str] = None
    graph_version: Optional[int] = None
    feature_schema_version: Optional[str] = "v2.5"
    evidence_references: Optional[Dict[str, Any]] = None
    assessment_timestamp: Optional[datetime] = None
    processing_latency_ms: Optional[float] = 0.0
    assessment_reason: Optional[str] = None
    is_current: bool = True
    synthetic_ground_truth: str = "legitimate"

    class Config:
        from_attributes = True


class RetrospectiveAlertResponse(BaseModel):
    transaction_id: str
    simulation_id: int
    sender_account: str
    receiver_account: str
    amount: float
    initial_decision: str
    initial_risk_score: float
    current_risk_status: str
    current_risk_score: float
    escalated_at: Optional[datetime] = None
    escalation_reason: str
    assessment_version: int
    synthetic_ground_truth: str


class ClearedTransactionResponse(BaseModel):
    transaction_id: str
    simulation_id: int
    sender_account: str
    receiver_account: str
    amount: float
    initial_decision: str
    initial_risk_status: str
    initial_risk_score: float
    current_risk_status: str
    current_risk_score: float
    cleared_at: Optional[datetime] = None
    clearance_reason: str
    is_investigator_verified: bool
    assessment_version: int
    synthetic_ground_truth: str


class ManualReassessmentRequest(BaseModel):
    transaction_id: Optional[str] = None
    account_id: Optional[str] = None
    verified_clean: bool = False
    evidence_type: str = "INVESTIGATOR_OVERRIDE"
    notes: str = Field(..., min_length=3, max_length=1000)


class ReevaluationStatsResponse(BaseModel):
    simulation_id: int
    total_events_processed: int
    total_reassessments: int
    total_escalations: int
    total_deescalations: int
    total_retrospective_alerts: int
    total_cleared: int
    total_duplicates_prevented: int
    queue_backlog: int
    avg_latency_ms: float
    last_latency_ms: float
    is_running: bool


class SpeedUpdateRequest(BaseModel):
    target_tps: Decimal = Field(..., ge=Decimal("0.1"), le=Decimal("1000.0"), description="New target transactions per second")


