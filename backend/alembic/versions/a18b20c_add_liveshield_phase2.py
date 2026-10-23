"""Add LiveShield Phase 2 Detection, Decisions and Evaluation tables

Revision ID: a18b20c67890
Revises: f92a10b12345
Create Date: 2026-09-25 19:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a18b20c67890'
down_revision: Union[str, None] = 'f92a10b12345'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add detection columns to liveshield_simulations and liveshield_presets
    with op.batch_alter_table('liveshield_simulations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('detection_mode', sa.String(length=50), nullable=False, server_default='shadow'))
        batch_op.add_column(sa.Column('detection_config', sa.JSON(), nullable=True))

    with op.batch_alter_table('liveshield_presets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('detection_config', sa.JSON(), nullable=True))

    # 2. decisions table
    op.create_table(
        'liveshield_decisions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('simulation_id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.String(length=100), nullable=False),
        sa.Column('sequence_id', sa.String(length=100), nullable=True),
        sa.Column('step_index', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('sender_account', sa.String(length=100), nullable=False),
        sa.Column('receiver_account', sa.String(length=100), nullable=False),
        sa.Column('amount', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('detection_mode', sa.String(length=50), nullable=False, server_default='shadow'),
        sa.Column('initial_decision', sa.String(length=50), nullable=False, server_default='APPROVE'),
        sa.Column('final_decision', sa.String(length=50), nullable=False, server_default='APPROVE'),
        sa.Column('decision_reason', sa.Text(), nullable=True),
        sa.Column('fast_screening_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('fast_screening_signals', sa.JSON(), nullable=True),
        sa.Column('dclcg_score', sa.Float(), nullable=True),
        sa.Column('dclcg_disguise_score', sa.Float(), nullable=True),
        sa.Column('dclcg_top_paths', sa.JSON(), nullable=True),
        sa.Column('model_version', sa.String(length=100), nullable=True),
        sa.Column('graph_version', sa.Integer(), nullable=True),
        sa.Column('combined_risk_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('risk_tier', sa.String(length=20), nullable=False, server_default='LOW'),
        sa.Column('t_generated', sa.DateTime(timezone=True), nullable=True),
        sa.Column('t_ingested', sa.DateTime(timezone=True), nullable=True),
        sa.Column('t_screened', sa.DateTime(timezone=True), nullable=True),
        sa.Column('t_decided', sa.DateTime(timezone=True), nullable=True),
        sa.Column('t_graph_inferred', sa.DateTime(timezone=True), nullable=True),
        sa.Column('latency_screening_ms', sa.Float(), nullable=True),
        sa.Column('latency_model_ms', sa.Float(), nullable=True),
        sa.Column('latency_total_ms', sa.Float(), nullable=True),
        sa.Column('operator_action', sa.String(length=50), nullable=True),
        sa.Column('operator_notes', sa.Text(), nullable=True),
        sa.Column('operator_user_id', sa.Integer(), nullable=True),
        sa.Column('operator_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('synthetic_ground_truth', sa.String(length=50), nullable=False, server_default='legitimate'),
        sa.Column('scenario_id', sa.String(length=50), nullable=True),
        sa.Column('evaluation_label', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['operator_user_id'], ['users.id'], name=op.f('fk_liveshield_decisions_operator_user_id_users')),
        sa.ForeignKeyConstraint(['simulation_id'], ['liveshield_simulations.id'], ondelete='CASCADE', name=op.f('fk_liveshield_decisions_simulation_id_liveshield_simulations')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_liveshield_decisions'))
    )
    with op.batch_alter_table('liveshield_decisions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_liveshield_decisions_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_decisions_simulation_id'), ['simulation_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_decisions_transaction_id'), ['transaction_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_decisions_sender_account'), ['sender_account'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_decisions_receiver_account'), ['receiver_account'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_decisions_timestamp'), ['timestamp'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_decisions_scenario_id'), ['scenario_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_decisions_evaluation_label'), ['evaluation_label'], unique=False)
        batch_op.create_index('ix_ls_dec_sim_decision', ['simulation_id', 'final_decision'], unique=False)
        batch_op.create_index('ix_ls_dec_sim_tier', ['simulation_id', 'risk_tier'], unique=False)
        batch_op.create_index('ix_ls_dec_sim_eval', ['simulation_id', 'evaluation_label'], unique=False)

    # 3. evaluations table
    op.create_table(
        'liveshield_evaluations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('simulation_id', sa.Integer(), nullable=False),
        sa.Column('evaluated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('total_transactions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_legitimate', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_fraudulent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('approved_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('flagged_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('held_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rejected_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('true_positives', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('true_negatives', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('false_positives', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('false_negatives', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('precision', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('recall', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('f1_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('accuracy', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('false_positive_rate', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('false_negative_rate', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('total_sequences', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('network_true_positives', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('network_false_positives', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('network_false_negatives', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('network_precision', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('network_recall', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('network_f1', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('latency_screening_p50', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('latency_screening_p95', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('latency_screening_p99', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('latency_model_p50', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('latency_model_p95', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('latency_model_p99', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('latency_total_p50', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('latency_total_p95', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('latency_total_p99', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('scenario_metrics', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['simulation_id'], ['liveshield_simulations.id'], ondelete='CASCADE', name=op.f('fk_liveshield_evaluations_simulation_id_liveshield_simulations')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_liveshield_evaluations'))
    )
    with op.batch_alter_table('liveshield_evaluations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_liveshield_evaluations_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_evaluations_simulation_id'), ['simulation_id'], unique=False)


def downgrade() -> None:
    op.drop_table('liveshield_evaluations')
    op.drop_table('liveshield_decisions')
    with op.batch_alter_table('liveshield_presets', schema=None) as batch_op:
        batch_op.drop_column('detection_config')
    with op.batch_alter_table('liveshield_simulations', schema=None) as batch_op:
        batch_op.drop_column('detection_config')
        batch_op.drop_column('detection_mode')
