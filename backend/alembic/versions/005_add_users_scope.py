"""add scope to users

Revision ID: 005_users_scope
Revises: 004_user_session_scope
Create Date: 2026-02-24
"""
from alembic import op
import sqlalchemy as sa

revision = '005_users_scope'
down_revision = '004_user_session_scope'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('scope', sa.String(50), nullable=True, server_default='full'))

def downgrade():
    op.drop_column('users', 'scope')
