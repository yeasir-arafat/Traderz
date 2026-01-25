from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import logging

logger = logging.getLogger(__name__)


class AppException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, field_errors: dict = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.field_errors = field_errors
        super().__init__(message)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    error = {"code": exc.code, "message": exc.message}
    if exc.field_errors:
        error["fieldErrors"] = exc.field_errors
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": error}
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    field_errors = {}
    for error in exc.errors():
        loc = ".".join(str(l) for l in error["loc"] if l != "body")
        field_errors[loc] = error["msg"]
    
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Validation failed",
                "fieldErrors": field_errors
            }
        }
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An internal error occurred"
            }
        }
    )
