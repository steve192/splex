import pytest
from django.contrib.auth import get_user_model
from rest_framework.exceptions import APIException, Throttled, ValidationError
from rest_framework.test import APIClient

from splex.invitations.services import create_friend_invitation
from splex.shared.api import exception_handler
from splex.shared.errors import (
    ApiResponseError,
    DomainError,
    DomainPermissionError,
    ErrorCode,
    NormalizedApiError,
)
from splex.sync.models import ClientMutation


def test_throttled_exception_has_translatable_error_code_and_wait_parameter():
    response = exception_handler(Throttled(wait=12.2), {})

    assert response.status_code == 429
    assert response.data == {
        "error": {
            "code": "throttled",
            "params": {"wait_seconds": 13},
        }
    }


def test_validation_exception_keeps_fields_in_canonical_error_envelope():
    response = exception_handler(ValidationError({"amount": ["A valid number is required."]}), {})

    assert response.status_code == 400
    assert response.data == {
        "error": {"code": "validation_error"},
        "fields": {"amount": ["A valid number is required."]},
    }


def test_domain_exception_preserves_stable_code_and_parameters():
    exc = DomainError(
        ErrorCode.RECEIPT_TOO_LARGE,
        "File is too large.",
        params={"max_bytes": 1024},
    )

    assert isinstance(exc, ApiResponseError)
    assert exc.to_normalized_error() == NormalizedApiError(
        code="receipt_too_large",
        message="File is too large.",
        params={"max_bytes": 1024},
    )

    response = exception_handler(exc, {})

    assert response.status_code == 400
    assert response.data == {
        "error": {
            "code": "receipt_too_large",
            "message": "File is too large.",
            "params": {"max_bytes": 1024},
        }
    }


def test_domain_permission_exception_uses_the_shared_error_base():
    exc = DomainPermissionError(ErrorCode.GROUP_MEMBER_REQUIRED, "Group membership is required.")

    assert isinstance(exc, ApiResponseError)
    assert exc.to_normalized_error() == NormalizedApiError(
        code="group_member_required",
        message="Group membership is required.",
    )

    response = exception_handler(exc, {})

    assert response.status_code == 403


def test_unexpected_value_error_is_not_exposed_as_a_validation_response():
    assert exception_handler(ValueError("Unexpected internal state."), {}) is None


def test_unrecognized_framework_error_does_not_expose_its_detail():
    response = exception_handler(APIException("password=not-for-the-client"), {})

    assert response.status_code == 500
    assert response.data == {"error": {"code": "api_error"}}


@pytest.mark.django_db
def test_sync_internal_error_is_not_converted_to_an_api_error_response():
    user = get_user_model().objects.create_user(email="user@example.com")
    client = APIClient()
    client.force_authenticate(user=user)
    client.raise_request_exception = False

    response = client.post(
        "/api/sync/mutations/",
        {"clientMutationId": "mutation-1", "type": "create_expense", "payload": {}},
        format="json",
    )

    assert response.status_code == 500
    assert b"context_type" not in response.content
    assert ClientMutation.objects.get(user=user, client_mutation_id="mutation-1").error == (
        "The pending expense could not be synchronized."
    )


def test_invitation_failure_uses_domain_error_code(db):
    response = APIClient().get("/api/invitations/not-a-real-token/")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "invitation_invalid",
            "message": "Invitation not found.",
        }
    }


def test_missing_invitation_image_uses_framework_not_found_error(db):
    owner = get_user_model().objects.create_user(email="owner@example.com")
    _invitation, token, _url = create_friend_invitation(actor=owner)

    response = APIClient().get(f"/api/invitations/{token}/images/inviter/")

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found"}}
