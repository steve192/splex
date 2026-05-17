from django.core.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    if isinstance(exc, PermissionError):
        exc = PermissionDenied(str(exc))
    if isinstance(exc, ValueError):
        exc = ValidationError(str(exc))
    return drf_exception_handler(exc, context)
