"""
Auto-Evaluator Service
Checks for tests that have run 72+ hours and auto-evaluates them
"""

import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session_maker
from app.models.models import CAT72Test, Application, EnveloSession
from app.services.cat72_evaluator import complete_test_and_issue_certificate
import logging

logger = logging.getLogger(__name__)

MIN_TEST_DURATION_HOURS = 72


async def check_and_evaluate_tests():
    """Check for tests that need auto-evaluation"""
    async with async_session_maker() as db:
        # Find tests that are running and started more than 72 hours ago
        cutoff_time = datetime.utcnow() - timedelta(hours=MIN_TEST_DURATION_HOURS)
        
        result = await db.execute(
            select(CAT72Test).where(
                CAT72Test.status == 'running',
                CAT72Test.started_at <= cutoff_time
            )
        )
        tests = result.scalars().all()
        
        for test in tests:
            logger.info(f"Auto-evaluating test {test.id} (started {test.started_at})")
            try:
                evaluation = await complete_test_and_issue_certificate(db, test.id, notify_applicant=True)
                logger.info(f"Test {test.id} evaluation complete: {evaluation.get('passed', False)}")
            except Exception as e:
                logger.error(f"Failed to evaluate test {test.id}: {e}")


async def run_auto_evaluator():
    """Background task that runs every hour"""
    while True:
        try:
            await check_and_evaluate_tests()
        except Exception as e:
            logger.error(f"Auto-evaluator error: {e}")
        
        # Wait 1 hour before next check
        await asyncio.sleep(3600)
