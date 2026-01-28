from typing import Any, Optional, Dict
from fastapi.responses import JSONResponse


def success_response(data: Any = None, message: str = None) -> dict:
    response = {"success": True, "data": data}
    if message:
        response["message"] = message
    return response


def error_response(
    code: str,
    message: str,
    status_code: int = 400,
    field_errors: Optional[Dict[str, str]] = None
) -> JSONResponse:
    error = {"code": code, "message": message}
    if field_errors:
        error["fieldErrors"] = field_errors
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": error}
    )


# Common error codes
class ErrorCodes:
    VALIDATION_ERROR = "VALIDATION_ERROR"
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR"
    AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    TERMS_NOT_ACCEPTED = "TERMS_NOT_ACCEPTED"
    KYC_REQUIRED = "KYC_REQUIRED"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    INVALID_STATE = "INVALID_STATE"
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE"
    ORDER_ERROR = "ORDER_ERROR"
    WALLET_ERROR = "WALLET_ERROR"
    DUPLICATE_ENTRY = "DUPLICATE_ENTRY"
