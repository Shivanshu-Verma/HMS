"""
Serializers for doctor endpoints.

Handles input validation for clinical findings, prescriptions, and medicine search.
"""
from rest_framework import serializers


class VitalSignsSerializer(serializers.Serializer):
    """Validates vital signs input."""

    blood_pressure = serializers.CharField(required=False, allow_blank=True)
    pulse = serializers.IntegerField(required=False, allow_null=True)
    weight = serializers.FloatField(required=False, allow_null=True)
    temperature = serializers.FloatField(required=False, allow_null=True)


class FindingsSerializer(serializers.Serializer):
    """Validates doctor diagnosis/findings input."""

    diagnosis = serializers.CharField(required=True)
    treatment_plan = serializers.CharField(required=False, allow_blank=True)
    clinical_notes = serializers.CharField(required=False, allow_blank=True)
    vital_signs = VitalSignsSerializer(required=False)
    next_visit_date = serializers.DateField(required=False, allow_null=True)


class PrescriptionItemSerializer(serializers.Serializer):
    """Validates a single prescription line item."""

    medicine_id = serializers.CharField(required=True)
    dosage = serializers.CharField(required=True)
    frequency = serializers.ChoiceField(
        choices=['once_daily', 'twice_daily', 'thrice_daily', 'as_needed'],
        required=True,
    )
    duration_days = serializers.IntegerField(required=True, min_value=1)
    quantity = serializers.IntegerField(required=True, min_value=1)
    instructions = serializers.CharField(required=False, allow_blank=True)


class PrescriptionsSerializer(serializers.Serializer):
    """Validates the full prescriptions list submission."""

    prescriptions = PrescriptionItemSerializer(many=True, required=True)


def serialize_medicine(med_doc) -> dict:
    """
    Convert a Medicine document to a frontend-compatible dict.

    Args:
        med_doc: MongoEngine Medicine document.

    Returns:
        dict: Serialised medicine data.
    """
    return {
        'id': str(med_doc.id),
        'name': med_doc.name,
        'generic_name': med_doc.generic_name,
        'category': med_doc.category,
        'manufacturer': med_doc.manufacturer,
        'unit': med_doc.unit,
        'price_per_unit': med_doc.price_per_unit,
        'stock_quantity': med_doc.stock_quantity,
        'reorder_level': med_doc.reorder_level,
        'expiry_date': med_doc.expiry_date.isoformat() if med_doc.expiry_date else None,
        'is_active': med_doc.is_active,
        'created_at': med_doc.created_at.isoformat() if med_doc.created_at else None,
    }
