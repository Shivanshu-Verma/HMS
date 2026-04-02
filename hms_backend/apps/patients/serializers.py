"""Serializers and response mappers for patient-facing endpoints."""
from rest_framework import serializers


class PatientRegistrationSerializer(serializers.Serializer):
    """Tier 1 mandatory patient registration payload."""

    full_name = serializers.CharField(required=True)
    phone_number = serializers.CharField(required=True)
    date_of_birth = serializers.DateField(required=True)
    sex = serializers.ChoiceField(choices=['male', 'female', 'other'], required=True)
    fingerprint_hash = serializers.CharField(required=True)
    patient_category = serializers.ChoiceField(
        choices=['psychiatric', 'deaddiction'],
        required=False,
        allow_null=True,
    )
    file_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    aadhaar_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    relative_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    address_line1 = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class PatientGeneralDataSerializer(serializers.Serializer):
    """Tier 2 optional patient profile payload for partial updates."""

    blood_group = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    address_line1 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    city = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    state = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    pincode = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    aadhaar_number_last4 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    addiction_type = serializers.ChoiceField(
        choices=['alcohol', 'drugs', 'tobacco', 'gambling', 'other'],
        required=False,
        allow_null=True,
    )
    addiction_duration_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    emergency_contact_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    emergency_contact_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    emergency_contact_relation = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    family_history = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    medical_history = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    allergies = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    current_medications = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    previous_treatments = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class PatientLookupSerializer(serializers.Serializer):
    """Query payload for patient lookup by registration or fingerprint."""

    registration_number = serializers.CharField(required=False)
    fingerprint_hash = serializers.CharField(required=False)

    def validate(self, attrs):
        if not attrs.get('registration_number') and not attrs.get('fingerprint_hash'):
            raise serializers.ValidationError('Either registration_number or fingerprint_hash is required.')
        return attrs


GENERAL_FIELDS = (
    'blood_group',
    'email',
    'address_line1',
    'city',
    'state',
    'pincode',
    'aadhaar_number_last4',
    'addiction_type',
    'addiction_duration_text',
    'emergency_contact_name',
    'emergency_contact_phone',
    'emergency_contact_relation',
    'family_history',
    'medical_history',
    'allergies',
    'current_medications',
    'previous_treatments',
)


def serialize_patient(patient_doc) -> dict:
    """Serialize safe patient fields for API responses."""

    address = patient_doc.address
    addiction = patient_doc.addiction_profile
    emergency = patient_doc.emergency_contact
    medical = patient_doc.medical_background

    return {
        'patient_id': str(patient_doc.id),
        'registration_number': patient_doc.registration_number,
        'file_number': patient_doc.registration_number,
        'full_name': patient_doc.full_name,
        'phone_number': patient_doc.phone,
        'phone': patient_doc.phone,
        'date_of_birth': patient_doc.date_of_birth.date().isoformat() if patient_doc.date_of_birth else None,
        'sex': patient_doc.gender,
        'gender': patient_doc.gender,
        'patient_category': getattr(patient_doc, 'patient_category', None),
        'status': patient_doc.status,
        'general_data_complete': patient_doc.general_data_complete,
        'outstanding_debt': float(patient_doc.outstanding_debt or 0.0),
        'blood_group': patient_doc.blood_group,
        'email': patient_doc.email,
        'address_line1': address.line1 if address else None,
        'address': address.line1 if address else None,
        'city': address.city if address else None,
        'state': address.state if address else None,
        'pincode': address.pincode if address else None,
        'aadhaar_number_last4': patient_doc.aadhaar_number_last4,
        'addiction_type': addiction.addiction_type if addiction else None,
        'addiction_duration_text': addiction.addiction_duration_text if addiction else None,
        'addiction_duration': addiction.addiction_duration_text if addiction else None,
        'emergency_contact_name': emergency.name if emergency else None,
        'emergency_contact_phone': emergency.phone if emergency else None,
        'relative_phone': emergency.phone if emergency else None,
        'emergency_contact_relation': emergency.relation if emergency else None,
        'family_history': medical.family_history if medical else None,
        'medical_history': medical.medical_history if medical else None,
        'allergies': medical.allergies if medical else None,
        'current_medications': medical.current_medications if medical else None,
        'previous_treatments': medical.previous_treatments if medical else None,
    }


def serialize_patient_basic(patient_doc) -> dict:
    """Serialize compact patient payload for lookup lists and queues."""

    return {
        'patient_id': str(patient_doc.id),
        'registration_number': patient_doc.registration_number,
        'full_name': patient_doc.full_name,
        'phone_number': patient_doc.phone,
        'status': patient_doc.status,
        'outstanding_debt': float(patient_doc.outstanding_debt or 0.0),
    }


def serialize_visit_summary(visit_doc) -> dict:
    """Backward-compatible archived-visit summary used by dormant doctor views."""

    return {
        'id': str(visit_doc.id),
        'visit_uid': getattr(visit_doc, 'visit_uid', None),
        'visit_date': visit_doc.visit_date.isoformat() if getattr(visit_doc, 'visit_date', None) else None,
        'patient_id': str(getattr(visit_doc, 'patient_id', '')) if getattr(visit_doc, 'patient_id', None) else None,
        'visit_type': getattr(visit_doc, 'visit_type', 'standard'),
        'medicines_total': float(getattr(visit_doc, 'medicines_total', 0.0) or 0.0),
    }
