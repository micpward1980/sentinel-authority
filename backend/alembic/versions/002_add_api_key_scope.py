"""add scope to api_keys

Revision ID: 002_api_key_scope
Revises: 001_pre_review
Create Date: 2026-02-24
"""
from alembic import op
import sqlalchemy as sa

revision = '002_api_key_scope'
down_revision = '001_pre_review'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('api_keys', sa.Column('scope', sa.String(50), nullable=True, server_default='full'))

def downgrade():
    op.drop_column('api_keys', 'scope')
