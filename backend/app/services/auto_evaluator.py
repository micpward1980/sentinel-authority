"""
Auto-Evaluator Service
Disabled — evaluation now handled by cat72_auto_evaluator in background_tasks.py
"""

import asyncio
import logging

logger = logging.getLogger(__name__)


async def run_auto_evaluator():
    """No-op — cat72_auto_evaluator in background_tasks.py handles all evaluation."""
    logger.info("Auto-evaluator disabled — using cat72_auto_evaluator in background_tasks instead")
    while True:
        await asyncio.sleep(86400)  # Sleep forever, do nothing
