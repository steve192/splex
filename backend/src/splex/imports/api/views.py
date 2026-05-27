from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.imports.split_pro_client import (
    SplitProAuthError,
    SplitProConnection,
    SplitProError,
    SplitProSchemaError,
)
from splex.imports.split_pro_service import (
    SplitProUserNotFoundError,
    import_from_split_pro,
    list_split_pro_users,
)
from splex.imports.splitwise_client import SplitwiseAuthError, SplitwiseError
from splex.imports.splitwise_service import import_from_splitwise


class SplitwiseImportSerializer(serializers.Serializer):
    api_key = serializers.CharField(max_length=200, trim_whitespace=True)
    import_friends_as_groups = serializers.BooleanField(default=False)


class SplitwiseImportView(APIView):
    """Run a one-shot Splitwise import for the authenticated user.

    The API key is consumed for this single request only; we do not persist it.
    """

    def post(self, request):
        serializer = SplitwiseImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            summary = import_from_splitwise(
                actor=request.user,
                api_key=serializer.validated_data["api_key"],
                import_friends_as_groups=serializer.validated_data[
                    "import_friends_as_groups"
                ],
            )
        except SplitwiseAuthError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)
        except SplitwiseError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"summary": summary.as_dict()})


class _SplitProCredentialsSerializer(serializers.Serializer):
    """Fields every Split Pro endpoint needs to open the database."""

    host = serializers.CharField(max_length=255, trim_whitespace=True)
    port = serializers.IntegerField(min_value=1, max_value=65535, default=5432)
    dbname = serializers.CharField(max_length=128, trim_whitespace=True)
    user = serializers.CharField(max_length=128, trim_whitespace=True)
    password = serializers.CharField(max_length=512, trim_whitespace=False)


class SplitProImportSerializer(_SplitProCredentialsSerializer):
    actor_user_id = serializers.IntegerField(min_value=1)
    import_friends_as_groups = serializers.BooleanField(default=False)


def _connection_from(data: dict) -> SplitProConnection:
    return SplitProConnection(
        host=data["host"], port=data["port"], dbname=data["dbname"],
        user=data["user"], password=data["password"],
    )


def _split_pro_error_response(exc: SplitProError) -> Response:
    if isinstance(exc, SplitProAuthError):
        return Response({"detail": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)
    if isinstance(exc, SplitProUserNotFoundError):
        return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
    if isinstance(exc, SplitProSchemaError):
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class SplitProListUsersView(APIView):
    """Open a Split Pro database with the supplied credentials and return its
    user list so the caller can pick which user is themselves.

    Credentials are consumed for this single request only and not persisted.
    """

    def post(self, request):
        serializer = _SplitProCredentialsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            users = list_split_pro_users(_connection_from(serializer.validated_data))
        except SplitProError as exc:
            return _split_pro_error_response(exc)
        return Response({"users": users})


class SplitProImportView(APIView):
    """Run a one-shot Split Pro database import for the authenticated user.

    Requires the caller to have already picked ``actor_user_id`` from the
    ``/api/imports/split-pro/users/`` listing.  The database credentials are
    consumed for this single request only; we do not persist them.
    """

    def post(self, request):
        serializer = SplitProImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            summary = import_from_split_pro(
                actor=request.user, connection=_connection_from(data),
                actor_user_id=data["actor_user_id"],
                import_friends_as_groups=data["import_friends_as_groups"],
            )
        except SplitProError as exc:
            return _split_pro_error_response(exc)
        return Response({"summary": summary.as_dict()})
