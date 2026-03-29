"""
Custom DRF exception handler and exception classes for the HMS backend.

All error responses follow a consistent shape:
{
    "success": false,
    "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable description.",
        "field": null or "field_name"
    }
}
"""
import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


class HMSError(Exception):
    """
    Base exception for all HMS business logic errors.

    Subclass this for domain-specific error types.
    """

    def __init__(self, code: str, message: str, status_code: int = 400, field: str = None):
        """
        Initialise an HMS error.

        Args:
            code (str): Machine-readable error code (e.g. 'PATIENT_NOT_FOUND').
            message (str): Human-readable error message.
            status_code (int): HTTP status code to return.
            field (str): Optional field name that caused the error.
        """
        self.code = code
        self.message = message
        self.status_code = status_code
        self.field = field
        super().__init__(message)


class NotFoundError(HMSError):
    """Raised when a requested resource does not exist."""

    def __init__(self, message: str = "Resource not found.", code: str = "NOT_FOUND", field: str = None):
        super().__init__(code=code, message=message, status_code=404, field=field)


class ConflictError(HMSError):
    """Raised when a resource conflict occurs (e.g. duplicate, already exists)."""

    def __init__(self, message: str = "Resource conflict.", code: str = "CONFLICT", field: str = None):
        super().__init__(code=code, message=message, status_code=409, field=field)


class ForbiddenError(HMSError):
    """Raised when the user lacks permission for the requested action."""

    def __init__(self, message: str = "Access denied.", code: str = "FORBIDDEN", field: str = None):
        super().__init__(code=code, message=message, status_code=403, field=field)


class ValidationError(HMSError):
    """Raised when input data is invalid."""

    def __init__(self, message: str = "Validation error.", code: str = "VALIDATION_ERROR", field: str = None):
        super().__init__(code=code, message=message, status_code=400, field=field)


def _build_error_response(code: str, message: str, field: str = None, status_code: int = 400) -> Response:
    """
    Build a standardised error response.

    Args:
        code (str): Machine-readable error code.
        message (str): Human-readable error message.
        field (str): Optional field name.
        status_code (int): HTTP status code.

    Returns:
        Response: DRF Response with the error envelope.
    """
    return Response(
        {
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "field": field,
            },
        },
        status=status_code,
    )


def hms_exception_handler(exc, context):
    """
    Custom DRF exception handler that wraps all errors in the HMS error envelope.

    Handles HMSError subclasses, DRF validation errors, and standard DRF exceptions.
    Falls back to a generic 500 for unhandled exceptions.

    Args:
        exc (Exception): The raised exception.
        context (dict): DRF context including view and request.

    Returns:
        Response: Standardised error response.
    """
    # Handle our custom exceptions first
    if isinstance(exc, HMSError):
        return _build_error_response(
            code=exc.code,
            message=exc.message,
            field=exc.field,
            status_code=exc.status_code,
        )

    # Let DRF handle its own exceptions
    response = exception_handler(exc, context)

    if response is not None:
        # DRF validation errors
        if response.status_code == 400:
            # Try to extract field-level errors
            if isinstance(response.data, dict):
                for field_name, errors in response.data.items():
                    if field_name == 'non_field_errors':
                        message = errors[0] if isinstance(errors, list) else str(errors)
                        return _build_error_response("VALIDATION_ERROR", message, status_code=400)
                    message = errors[0] if isinstance(errors, list) else str(errors)
                    return _build_error_response("VALIDATION_ERROR", message, field=field_name, status_code=400)
            return _build_error_response("VALIDATION_ERROR", str(response.data), status_code=400)

        if response.status_code == 401:
            return _build_error_response("UNAUTHORIZED", "Authentication credentials were not provided or are invalid.", status_code=401)

        if response.status_code == 403:
            return _build_error_response("FORBIDDEN", "You do not have permission to perform this action.", status_code=403)

        if response.status_code == 404:
            return _build_error_response("NOT_FOUND", "The requested resource was not found.", status_code=404)

        if response.status_code == 405:
            return _build_error_response("METHOD_NOT_ALLOWED", "This HTTP method is not allowed.", status_code=405)

        # Generic DRF error
        detail = getattr(exc, 'detail', str(exc))
        return _build_error_response("ERROR", str(detail), status_code=response.status_code)

    # Unhandled exception — log it and return 500
    logger.exception("Unhandled exception in %s", context.get('view', 'unknown'))
    return _build_error_response(
        code="INTERNAL_ERROR",
        message="An unexpected error occurred. Please try again later.",
        status_code=500,
    )
