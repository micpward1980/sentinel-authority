"""add scope to user_sessions

Revision ID: 004_user_session_scope
Revises: 003_webhooks
Create Date: 2026-02-24
"""
from alembic import op
import sqlalchemy as sa

revision = '004_user_session_scope'
down_revision = '003_webhooks'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('user_sessions', sa.Column('scope', sa.String(50), nullable=True, server_default='full'))

def downgrade():
    op.drop_column('user_sessions', 'scope')
