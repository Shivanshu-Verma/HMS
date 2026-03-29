"""
Serializers for authentication endpoints.

Handles input validation for login, token refresh, and logout requests.
"""
from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    """Validates login credentials."""

    email = serializers.EmailField(required=True, help_text="Staff email address.")
    password = serializers.CharField(required=True, help_text="Account password.")


class RefreshSerializer(serializers.Serializer):
    """Validates refresh token request."""

    refresh_token = serializers.CharField(required=True, help_text="Current refresh token.")


class LogoutSerializer(serializers.Serializer):
    """Validates logout request."""

    refresh_token = serializers.CharField(required=False, help_text="Refresh token to revoke.")
