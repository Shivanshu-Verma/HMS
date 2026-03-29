"""
Serializers for consultant (counsellor) endpoints.

Handles input validation for session notes and history serialization.
"""
from rest_framework import serializers


class SessionNotesSerializer(serializers.Serializer):
    """Validates counsellor session notes submission."""

    session_notes = serializers.CharField(required=True)
    mood_assessment = serializers.IntegerField(required=False, min_value=1, max_value=10, default=5)
    risk_level = serializers.ChoiceField(choices=['low', 'medium', 'high'], required=True)
    recommendations = serializers.CharField(required=False, allow_blank=True)
    follow_up_required = serializers.BooleanField(required=False, default=True)
