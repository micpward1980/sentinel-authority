"""add pre_review_results to applications

Revision ID: 001_pre_review
Revises: 
Create Date: 2026-02-24
"""
from alembic import op
import sqlalchemy as sa

revision = '001_pre_review'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('applications', sa.Column('pre_review_results', sa.JSON(), nullable=True))

def downgrade():
    op.drop_column('applications', 'pre_review_results')
