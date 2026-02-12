"""
ENVELO Exception Hierarchy
Sentinel Authority © 2025-2026
"""


class EnveloError(Exception):
    """Base exception for all ENVELO errors."""
    pass


class EnveloViolation(EnveloError):
    """
    Raised when an action violates ODD boundaries.
    Prevents protected code from executing.
    """
    def __init__(self, boundary_name: str, parameter: str, value, limit, message: str = None):
        self.boundary_name = boundary_name
        self.parameter = parameter
        self.value = value
        self.limit = limit
        self.message = message or (
            f"Boundary violation: {parameter}={value} "
            f"exceeds {boundary_name} limit ({limit})"
        )
        super().__init__(self.message)


class EnveloBoundaryError(EnveloError):
    """Raised when boundary configuration is invalid."""
    pass


class EnveloConnectionError(EnveloError):
    """Raised when connection to Sentinel Authority fails."""
    pass


class EnveloConfigError(EnveloError):
    """Raised when agent configuration is invalid or missing."""
    pass


class EnveloNotStartedError(EnveloError):
    """Raised when trying to use agent before calling start()."""
    pass


class EnveloFailsafeError(EnveloError):
    """
    Raised when agent enters failsafe mode.
    All actions are blocked until server connection is restored.
    """
    def __init__(self, reason: str = "Server connection lost"):
        self.reason = reason
        super().__init__(f"ENVELO FAILSAFE: {reason}. All actions blocked.")


class EnveloTamperError(EnveloError):
    """Raised when agent detects boundary cache or config tampering."""
    def __init__(self, detail: str = "Integrity check failed"):
        self.detail = detail
        super().__init__(f"ENVELO TAMPER DETECTED: {detail}")
