"""
ENVELO Self-Deploy Genie — Push-button ODDC Phase 4 deployment.

    envelo setup          # Interactive wizard
    envelo setup --dry-run
    envelo status
    envelo diagnose
    envelo rollback
"""
from .engine import EnveloGenie, VERSION
__all__ = ["EnveloGenie", "VERSION"]
