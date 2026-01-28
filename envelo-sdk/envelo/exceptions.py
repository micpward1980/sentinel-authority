"""
ENVELO Exception Classes
"""


class EnveloError(Exception):
    """Base exception for all ENVELO errors"""
    pass


class EnveloViolation(EnveloError):
    """
    Raised when an action violates ODD boundaries.
    This exception PREVENTS the protected code from executing.
    """
    def __init__(self, boundary_name: str, parameter: str, value, limit, message: str = None):
        self.boundary_name = boundary_name
        self.parameter = parameter
        self.value = value
        self.limit = limit
        self.message = message or f"Boundary violation: {parameter}={value} exceeds {boundary_name} limit ({limit})"
        super().__init__(self.message)


class EnveloBoundaryError(EnveloError):
    """Raised when boundary configuration is invalid"""
    pass


class EnveloConnectionError(EnveloError):
    """Raised when connection to Sentinel Authority fails"""
    pass


class EnveloConfigError(EnveloError):
    """Raised when agent configuration is invalid or missing"""
    pass


class EnveloNotStartedError(EnveloError):
    """Raised when trying to use agent before starting"""
    pass


class EnveloTamperError(EnveloError):
    """Raised when agent detects tampering"""
    pass


class EnveloFailsafeError(EnveloError):
    """
    Raised when agent enters failsafe mode.
    ALL actions are blocked until connection restored.
    """
    def __init__(self, reason: str = "Connection lost"):
        self.reason = reason
        super().__init__(f"ENVELO FAILSAFE ACTIVE: {reason}. All actions blocked.")
