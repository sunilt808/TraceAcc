"""Add LiveShield Phase 2.5 Continuous Risk Re-evaluation tables

Revision ID: b25c30d78901
Revises: a18b20c67890
Create Date: 2026-09-25 23:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b25c30d78901'
down_revision: Union[str, None] = 'a18b20c67890'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create liveshield_risk_assessments table
    op.create_table(
        'liveshield_risk_assessments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('simulation_id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.String(length=100), nullable=False),
        sa.Column('assessment_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('payment_status', sa.String(length=50), nullable=False, server_default='APPROVED'),
        sa.Column('previous_risk_score', sa.Float(), nullable=True),
        sa.Column('current_risk_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('previous_risk_status', sa.String(length=50), nullable=True),
        sa.Column('current_risk_status', sa.String(length=50), nullable=False, server_default='LOW_RISK'),
        sa.Column('assessment_type', sa.String(length=50), nullable=False, server_default='INITIAL'),
        sa.Column('triggering_event_id', sa.Integer(), nullable=True),
        sa.Column('triggering_transaction_id', sa.String(length=100), nullable=True),
        sa.Column('model_version', sa.String(length=100), nullable=True),
        sa.Column('graph_version', sa.Integer(), nullable=True),
        sa.Column('feature_schema_version', sa.String(length=50), nullable=True, server_default='v2.5'),
        sa.Column('evidence_references', sa.JSON(), nullable=True),
        sa.Column('assessment_timestamp', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('processing_latency_ms', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('assessment_reason', sa.Text(), nullable=True),
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('synthetic_ground_truth', sa.String(length=50), nullable=False, server_default='legitimate'),
        sa.ForeignKeyConstraint(['simulation_id'], ['liveshield_simulations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ls_ra_sim_txn_ver', 'liveshield_risk_assessments', ['simulation_id', 'transaction_id', 'assessment_version'], unique=True)
    op.create_index('ix_ls_ra_sim_status', 'liveshield_risk_assessments', ['simulation_id', 'current_risk_status'], unique=False)
    op.create_index('ix_ls_ra_current', 'liveshield_risk_assessments', ['simulation_id', 'transaction_id', 'is_current'], unique=False)

    # 2. Create liveshield_reevaluation_events table
    op.create_table(
        'liveshield_reevaluation_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('simulation_id', sa.Integer(), nullable=False),
        sa.Column('trigger_type', sa.String(length=50), nullable=False),
        sa.Column('triggering_transaction_id', sa.String(length=100), nullable=True),
        sa.Column('affected_transaction_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('queued_transaction_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completed_transaction_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed_transaction_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processing_status', sa.String(length=50), nullable=False, server_default='COMPLETED'),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['simulation_id'], ['liveshield_simulations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ls_rev_sim_trigger', 'liveshield_reevaluation_events', ['simulation_id', 'trigger_type'], unique=False)


def downgrade() -> None:
    op.drop_table('liveshield_reevaluation_events')
    op.drop_table('liveshield_risk_assessments')
