"""add webhooks table

Revision ID: 003_webhooks
Revises: 002_api_key_scope
Create Date: 2026-02-24
"""
from alembic import op
import sqlalchemy as sa

revision = '003_webhooks'
down_revision = '002_api_key_scope'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('webhooks',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('secret', sa.String(100), nullable=True),
        sa.Column('events', sa.JSON(), nullable=False),
        sa.Column('active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_fired_at', sa.DateTime(), nullable=True),
        sa.Column('failure_count', sa.Integer(), default=0),
    )

def downgrade():
    op.drop_table('webhooks')
