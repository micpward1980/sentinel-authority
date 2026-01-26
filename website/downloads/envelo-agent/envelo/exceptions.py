"""ENVELO Exceptions"""

class EnveloError(Exception):
    """Base exception for ENVELO errors"""
    pass

class BoundaryViolation(EnveloError):
    """Raised when an action violates a boundary"""
    pass

class ConfigurationError(EnveloError):
    """Raised when agent is misconfigured"""
    pass
