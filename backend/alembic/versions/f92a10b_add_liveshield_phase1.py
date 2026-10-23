"""Add LiveShield Phase 1 tables

Revision ID: f92a10b12345
Revises: 939435fa0f56
Create Date: 2026-09-25 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f92a10b12345'
down_revision: Union[str, None] = '939435fa0f56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. simulations table
    op.create_table(
        'liveshield_simulations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('mode', sa.String(length=50), nullable=False, server_default='basic'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='DRAFT'),
        sa.Column('worker_id', sa.String(length=100), nullable=True),
        sa.Column('heartbeat_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('config', sa.JSON(), nullable=False),
        sa.Column('stats', sa.JSON(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('stopped_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name=op.f('fk_liveshield_simulations_created_by_id_users')),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_liveshield_simulations_organization_id_organizations')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_liveshield_simulations'))
    )
    with op.batch_alter_table('liveshield_simulations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_liveshield_simulations_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_simulations_name'), ['name'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_simulations_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_simulations_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_simulations_created_by_id'), ['created_by_id'], unique=False)
        batch_op.create_index('ix_liveshield_sim_org_status', ['organization_id', 'status'], unique=False)
        batch_op.create_index('ix_liveshield_sim_created_at', ['created_at'], unique=False)

    # 2. simulation transactions table
    op.create_table(
        'liveshield_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('simulation_id', sa.Integer(), nullable=False),
        sa.Column('sequence_id', sa.String(length=100), nullable=True),
        sa.Column('step_index', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('transaction_id', sa.String(length=100), nullable=False),
        sa.Column('sender_account', sa.String(length=100), nullable=False),
        sa.Column('receiver_account', sa.String(length=100), nullable=False),
        sa.Column('amount', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False, server_default='USD'),
        sa.Column('transaction_type', sa.String(length=50), nullable=False, server_default='TRANSFER'),
        sa.Column('channel', sa.String(length=50), nullable=True, server_default='ONLINE'),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('scheduled_timestamp', sa.DateTime(timezone=True), nullable=True),
        sa.Column('generated_timestamp', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('source_country', sa.String(length=5), nullable=True, server_default='US'),
        sa.Column('dest_country', sa.String(length=5), nullable=True, server_default='US'),
        sa.Column('device_id', sa.String(length=100), nullable=True),
        sa.Column('merchant_id', sa.String(length=100), nullable=True),
        sa.Column('scenario_id', sa.String(length=50), nullable=True),
        sa.Column('synthetic_ground_truth', sa.String(length=50), nullable=False, server_default='legitimate'),
        sa.Column('account_ground_truth', sa.String(length=50), nullable=True),
        sa.Column('sequence_ground_truth', sa.String(length=50), nullable=True),
        sa.Column('scenario_metadata', sa.JSON(), nullable=True),
        sa.Column('random_seed', sa.Integer(), nullable=True),
        sa.Column('is_synthetic', sa.Boolean(), nullable=False, server_default='1'),
        sa.ForeignKeyConstraint(['simulation_id'], ['liveshield_simulations.id'], ondelete='CASCADE', name=op.f('fk_liveshield_transactions_simulation_id_liveshield_simulations')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_liveshield_transactions'))
    )
    with op.batch_alter_table('liveshield_transactions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_liveshield_transactions_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_transactions_simulation_id'), ['simulation_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_transactions_transaction_id'), ['transaction_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_transactions_sender_account'), ['sender_account'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_transactions_receiver_account'), ['receiver_account'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_transactions_timestamp'), ['timestamp'], unique=False)
        batch_op.create_index('ix_ls_txn_sim_time', ['simulation_id', 'timestamp'], unique=False)
        batch_op.create_index('ix_ls_txn_sim_scenario', ['simulation_id', 'scenario_id'], unique=False)
        batch_op.create_index('ix_ls_txn_sim_truth', ['simulation_id', 'synthetic_ground_truth'], unique=False)

    # 3. simulation presets table
    op.create_table(
        'liveshield_presets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('mode', sa.String(length=50), nullable=False, server_default='basic'),
        sa.Column('config', sa.JSON(), nullable=False),
        sa.Column('is_builtin', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('organization_id', sa.Integer(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name=op.f('fk_liveshield_presets_created_by_id_users')),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_liveshield_presets_organization_id_organizations')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_liveshield_presets'))
    )
    with op.batch_alter_table('liveshield_presets', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_liveshield_presets_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_presets_name'), ['name'], unique=False)

    # 4. simulation events table
    op.create_table(
        'liveshield_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('simulation_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['simulation_id'], ['liveshield_simulations.id'], ondelete='CASCADE', name=op.f('fk_liveshield_events_simulation_id_liveshield_simulations')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_liveshield_events'))
    )
    with op.batch_alter_table('liveshield_events', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_liveshield_events_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_events_simulation_id'), ['simulation_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_events_event_type'), ['event_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_liveshield_events_timestamp'), ['timestamp'], unique=False)


def downgrade() -> None:
    op.drop_table('liveshield_events')
    op.drop_table('liveshield_presets')
    op.drop_table('liveshield_transactions')
    op.drop_table('liveshield_simulations')
