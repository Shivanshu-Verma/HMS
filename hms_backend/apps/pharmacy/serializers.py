"""
Serializers for pharmacy endpoints.

Handles input validation for dispensing, stock management, and medicine creation.
"""
from rest_framework import serializers


class DispenseItemSerializer(serializers.Serializer):
    """Validates a single dispense item."""

    medicine_id = serializers.CharField(required=True)
    quantity_dispensed = serializers.IntegerField(required=True, min_value=0)
    selected = serializers.BooleanField(required=False, default=True)


class DispenseSerializer(serializers.Serializer):
    """Validates the dispense submission."""

    items = DispenseItemSerializer(many=True, required=True)
    dispensing_notes = serializers.CharField(required=False, allow_blank=True)


class AddStockSerializer(serializers.Serializer):
    """Validates stock addition input."""

    quantity = serializers.IntegerField(required=True, min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True)


class AddMedicineSerializer(serializers.Serializer):
    """Validates new medicine creation input."""

    name = serializers.CharField(required=True)
    generic_name = serializers.CharField(required=False, allow_blank=True)
    category = serializers.CharField(required=False, allow_blank=True)
    manufacturer = serializers.CharField(required=False, allow_blank=True)
    unit = serializers.ChoiceField(
        choices=['tablet', 'capsule', 'ml', 'mg', 'syrup', 'injection'],
        required=True,
    )
    price_per_unit = serializers.FloatField(required=True, min_value=0)
    stock_quantity = serializers.IntegerField(required=False, default=0, min_value=0)
    reorder_level = serializers.IntegerField(required=False, default=50, min_value=0)
    expiry_date = serializers.DateField(required=False, allow_null=True)
