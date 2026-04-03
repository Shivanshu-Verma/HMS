"""
Serializers for authentication endpoints.

Handles input validation for login, token refresh, and logout requests.
"""
from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    """Validates login credentials."""

    email = serializers.EmailField(required=True, help_text="Staff email address.")
    password = serializers.CharField(required=True, help_text="Account password.")
