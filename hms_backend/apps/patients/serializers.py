"""
Serializers for patient-related endpoints.

Handles serialisation of Patient documents and related data for API responses
and deserialization of patient registration input.
"""
from rest_framework import serializers


class AddressSerializer(serializers.Serializer):
    """Address input/output serializer."""

    line1 = serializers.CharField(required=True)
    city = serializers.CharField(required=True)
    state = serializers.CharField(required=True)
    pincode = serializers.CharField(required=True)


class EmergencyContactSerializer(serializers.Serializer):
    """Emergency contact input/output serializer."""

    name = serializers.CharField(required=True)
    phone = serializers.CharField(required=True)
    relation = serializers.CharField(required=True)


class PatientRegistrationSerializer(serializers.Serializer):
    """Validates patient registration input from the receptionist."""

    full_name = serializers.CharField(required=True)
    date_of_birth = serializers.DateTimeField(required=True)
    gender = serializers.ChoiceField(choices=['male', 'female', 'other'], required=True)
    blood_group = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    address = AddressSerializer(required=True)
    aadhaar_number_last4 = serializers.CharField(required=False, allow_blank=True)
    addiction_type = serializers.ChoiceField(
        choices=['alcohol', 'drugs', 'tobacco', 'gambling', 'other'], required=True
    )
    addiction_duration_text = serializers.CharField(required=False, allow_blank=True)
    emergency_contact = EmergencyContactSerializer(required=True)
    family_history = serializers.CharField(required=False, allow_blank=True)
    medical_history = serializers.CharField(required=False, allow_blank=True)
    allergies = serializers.CharField(required=False, allow_blank=True)
    current_medications = serializers.CharField(required=False, allow_blank=True)
    previous_treatments = serializers.CharField(required=False, allow_blank=True)
    fingerprint_template = serializers.CharField(required=True)


class FingerprintLookupSerializer(serializers.Serializer):
    """Validates fingerprint lookup input."""

    fingerprint_template = serializers.CharField(required=True)


def serialize_patient(patient_doc) -> dict:
    """
    Convert a Patient document to a frontend-compatible dict.

    Args:
        patient_doc: MongoEngine Patient document.

    Returns:
        dict: Serialised patient data (excluding sensitive fields like biometric hash).
    """
    return {
        'id': str(patient_doc.id),
        'patient_uid': patient_doc.patient_uid,
        'registration_number': patient_doc.registration_number,
        'full_name': patient_doc.full_name,
        'date_of_birth': patient_doc.date_of_birth.isoformat() if patient_doc.date_of_birth else None,
        'gender': patient_doc.gender,
        'blood_group': patient_doc.blood_group,
        'phone': patient_doc.phone,
        'email': patient_doc.email,
        'address': {
            'line1': patient_doc.address.line1,
            'city': patient_doc.address.city,
            'state': patient_doc.address.state,
            'pincode': patient_doc.address.pincode,
        } if patient_doc.address else None,
        'aadhaar_number_last4': patient_doc.aadhaar_number_last4,
        'addiction_type': patient_doc.addiction_profile.addiction_type if patient_doc.addiction_profile else None,
        'addiction_duration': patient_doc.addiction_profile.addiction_duration_text if patient_doc.addiction_profile else None,
        'emergency_contact_name': patient_doc.emergency_contact.name if patient_doc.emergency_contact else None,
        'emergency_contact_phone': patient_doc.emergency_contact.phone if patient_doc.emergency_contact else None,
        'emergency_contact_relation': patient_doc.emergency_contact.relation if patient_doc.emergency_contact else None,
        'family_history': patient_doc.medical_background.family_history if patient_doc.medical_background else None,
        'medical_history': patient_doc.medical_background.medical_history if patient_doc.medical_background else None,
        'allergies': patient_doc.medical_background.allergies if patient_doc.medical_background else None,
        'current_medications': patient_doc.medical_background.current_medications if patient_doc.medical_background else None,
        'previous_treatments': patient_doc.medical_background.previous_treatments if patient_doc.medical_background else None,
        'status': patient_doc.status,
        'visit_count': patient_doc.visit_count,
        'last_visit_at': patient_doc.last_visit_at.isoformat() if patient_doc.last_visit_at else None,
        'created_at': patient_doc.created_at.isoformat() if patient_doc.created_at else None,
    }


def serialize_patient_summary(patient_doc) -> dict:
    """
    Convert a Patient document to a brief summary dict for queue/list views.

    Args:
        patient_doc: MongoEngine Patient document.

    Returns:
        dict: Lightweight patient data for queue rendering.
    """
    return {
        'id': str(patient_doc.id),
        'registration_number': patient_doc.registration_number,
        'full_name': patient_doc.full_name,
        'phone': patient_doc.phone,
        'gender': patient_doc.gender,
        'date_of_birth': patient_doc.date_of_birth.isoformat() if patient_doc.date_of_birth else None,
        'addiction_type': patient_doc.addiction_profile.addiction_type if patient_doc.addiction_profile else None,
        'allergies': patient_doc.medical_background.allergies if patient_doc.medical_background else None,
        'status': patient_doc.status,
        'visit_count': patient_doc.visit_count,
    }


def serialize_visit_summary(visit_doc) -> dict:
    """
    Convert an archived Visit document to a summary dict.

    Args:
        visit_doc: MongoEngine Visit document.

    Returns:
        dict: Summarised visit data for history listings.
    """
    return {
        'id': str(visit_doc.id),
        'visit_uid': visit_doc.visit_uid,
        'visit_number': visit_doc.visit_number,
        'visit_date': visit_doc.visit_date.isoformat() if visit_doc.visit_date else None,
        'status': visit_doc.lifecycle.status if visit_doc.lifecycle else None,
        'diagnosis': visit_doc.doctor_stage.diagnosis if visit_doc.doctor_stage else None,
        'risk_level': visit_doc.counsellor_stage.risk_level if visit_doc.counsellor_stage else None,
        'completed_at': visit_doc.lifecycle.completed_at.isoformat() if visit_doc.lifecycle and visit_doc.lifecycle.completed_at else None,
        'patient_name': visit_doc.patient_snapshot.full_name if visit_doc.patient_snapshot else None,
        'patient_registration_number': visit_doc.patient_snapshot.registration_number if visit_doc.patient_snapshot else None,
    }


def serialize_visit_detail(visit_doc) -> dict:
    """
    Convert an archived Visit document to a full detail dict.

    Args:
        visit_doc: MongoEngine Visit document.

    Returns:
        dict: Complete visit data with all stage information.
    """
    result = serialize_visit_summary(visit_doc)

    if visit_doc.counsellor_stage:
        result['counsellor_stage'] = {
            'session_notes': visit_doc.counsellor_stage.session_notes,
            'mood_assessment': visit_doc.counsellor_stage.mood_assessment,
            'risk_level': visit_doc.counsellor_stage.risk_level,
            'recommendations': visit_doc.counsellor_stage.recommendations,
            'follow_up_required': visit_doc.counsellor_stage.follow_up_required,
            'session_duration_minutes': visit_doc.counsellor_stage.session_duration_minutes,
            'created_at': visit_doc.counsellor_stage.created_at.isoformat() if visit_doc.counsellor_stage.created_at else None,
        }

    if visit_doc.doctor_stage:
        result['doctor_stage'] = {
            'diagnosis': visit_doc.doctor_stage.diagnosis,
            'treatment_plan': visit_doc.doctor_stage.treatment_plan,
            'clinical_notes': visit_doc.doctor_stage.clinical_notes,
            'vital_signs': {
                'blood_pressure': visit_doc.doctor_stage.vital_signs.blood_pressure,
                'pulse': visit_doc.doctor_stage.vital_signs.pulse,
                'weight': visit_doc.doctor_stage.vital_signs.weight_kg,
                'temperature': visit_doc.doctor_stage.vital_signs.temperature_f,
            } if visit_doc.doctor_stage.vital_signs else None,
            'next_visit_date': visit_doc.doctor_stage.next_visit_date.isoformat() if visit_doc.doctor_stage.next_visit_date else None,
            'created_at': visit_doc.doctor_stage.created_at.isoformat() if visit_doc.doctor_stage.created_at else None,
        }

    if visit_doc.prescription_items:
        result['prescriptions'] = [{
            'id': str(item.prescription_item_id),
            'medicine_id': str(item.medicine_id),
            'medicine_name': item.medicine_snapshot.name if item.medicine_snapshot else None,
            'dosage': item.dosage,
            'frequency': item.frequency,
            'duration_days': item.duration_days,
            'quantity': item.quantity_prescribed,
            'instructions': item.instructions,
            'dispensed': item.dispensed,
            'quantity_dispensed': item.quantity_dispensed,
        } for item in visit_doc.prescription_items]

    result['assignments'] = {
        'counsellor_id': str(visit_doc.assignments.counsellor_id) if visit_doc.assignments else None,
        'doctor_id': str(visit_doc.assignments.doctor_id) if visit_doc.assignments else None,
        'pharmacist_id': str(visit_doc.assignments.pharmacist_id) if visit_doc.assignments else None,
    }

    return result
