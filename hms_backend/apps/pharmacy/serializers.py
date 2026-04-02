"""Input serializers for pharmacy endpoints."""
from rest_framework import serializers


class DispenseItemInputSerializer(serializers.Serializer):
    """Single medicine row submitted by pharmacist during dispense stage."""

    medicine_id = serializers.CharField(required=True)
    quantity = serializers.IntegerField(required=True, min_value=1)
    unit_price = serializers.FloatField(required=True, min_value=0.0)


class DispenseSubmitSerializer(serializers.Serializer):
    """Payload for storing dispense items on an active session."""

    items = DispenseItemInputSerializer(many=True, required=True)


class CheckoutPaymentSerializer(serializers.Serializer):
    """Payment payload used by checkout endpoint."""

    method = serializers.ChoiceField(choices=['cash', 'online', 'split', 'debt'])
    cash_amount = serializers.FloatField(required=False, default=0.0, min_value=0.0)
    online_amount = serializers.FloatField(required=False, default=0.0, min_value=0.0)
    debt_cleared = serializers.FloatField(required=False, default=0.0, min_value=0.0)
    new_debt = serializers.FloatField(required=False, default=0.0, min_value=0.0)


class CheckoutSerializer(serializers.Serializer):
    """Checkout payload including nested payment object."""

    payment = CheckoutPaymentSerializer(required=True)


class DebtPaymentSerializer(serializers.Serializer):
    """Payload for standalone debt settlement without active check-in."""

    patient_id = serializers.CharField(required=True)
    payment = serializers.DictField(required=True)


class MedicineCreateSerializer(serializers.Serializer):
    """Payload for creating a medicine entry."""

    name = serializers.CharField(required=True)
    category = serializers.CharField(required=True)
    unit = serializers.CharField(required=True)
    unit_price = serializers.FloatField(required=True, min_value=0.0)
    stock_quantity = serializers.IntegerField(required=True, min_value=0)
    description = serializers.CharField(required=False, allow_blank=True)


class MedicineUpdateSerializer(serializers.Serializer):
    """Payload for patching mutable medicine attributes."""

    name = serializers.CharField(required=False)
    category = serializers.CharField(required=False)
    unit = serializers.CharField(required=False)
    unit_price = serializers.FloatField(required=False, min_value=0.0)
    description = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)


class AddStockSerializer(serializers.Serializer):
    """Payload for stock increment endpoint."""

    quantity_to_add = serializers.IntegerField(required=True, min_value=1)
