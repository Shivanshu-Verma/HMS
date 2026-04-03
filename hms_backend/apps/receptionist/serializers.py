"""
Serializers for receptionist endpoints.

Handles input validation for visit creation and active queue serialization.
"""
from rest_framework import serializers

from apps.sessions.flow import get_active_session_stage


class CreateVisitSerializer(serializers.Serializer):
    """Validates visit creation input from the receptionist."""

    patient_id = serializers.CharField(required=True, help_text="Patient ObjectId string.")


class AssignCounsellorSerializer(serializers.Serializer):
    """Validates counsellor assignment input for an active session."""

    counsellor_id = serializers.CharField(required=True, help_text="Staff ObjectId string.")


def serialize_active_session_for_queue(session_doc) -> dict:
    """
    Convert an ActiveSession to a queue-friendly dict.

    Args:
        session_doc: MongoEngine ActiveSession document.

    Returns:
        dict: Session data shaped for frontend queue/dashboard rendering.
    """
    current_stage = get_active_session_stage(session_doc)
    if current_stage == 'doctor':
        stage_status = 'in_progress' if session_doc.doctor_started_at else 'waiting'
    elif current_stage == 'counsellor':
        stage_status = 'in_progress' if session_doc.counsellor_started_at else 'waiting'
    elif current_stage == 'pharmacy':
        stage_status = 'in_progress'
    else:
        stage_status = 'completed' if session_doc.status == 'completed' else 'unknown'

    return {
        'id': str(session_doc.id),
        'session_id': str(session_doc.id),
        'patient_id': str(session_doc.patient_id),
        'patient_name': session_doc.patient_name,
        'current_stage': current_stage,
        'stage_status': stage_status,
        'status': session_doc.status,
        'checkin_time': session_doc.checked_in_at.isoformat() if session_doc.checked_in_at else None,
        'checked_in_at': session_doc.checked_in_at.isoformat() if session_doc.checked_in_at else None,
        'checked_in_by_name': session_doc.checked_in_by_name,
        'counsellor_start_time': session_doc.counsellor_started_at.isoformat() if session_doc.counsellor_started_at else None,
        'counsellor_end_time': session_doc.counsellor_completed_at.isoformat() if session_doc.counsellor_completed_at else None,
        'doctor_start_time': session_doc.doctor_started_at.isoformat() if session_doc.doctor_started_at else None,
        'doctor_end_time': session_doc.doctor_completed_at.isoformat() if session_doc.doctor_completed_at else None,
        'pharmacy_time': session_doc.pharmacy_started_at.isoformat() if session_doc.pharmacy_started_at else None,
        'patient': {
            'id': str(session_doc.patient_id),
            'full_name': session_doc.patient_name,
        },
        'counsellor_stage': _serialize_counsellor_stage(session_doc),
        'doctor_stage': _serialize_doctor_stage(session_doc.doctor_stage),
    }


def _serialize_counsellor_stage(session_doc) -> dict | None:
    """Serialize active counsellor fields from the flat active session."""

    if not session_doc.counsellor_completed_at and not session_doc.counsellor_session_notes:
        return None
    return {
        'session_notes': session_doc.counsellor_session_notes,
        'mood_assessment': session_doc.counsellor_mood_assessment,
        'risk_level': session_doc.counsellor_risk_level,
        'recommendations': session_doc.counsellor_recommendations,
        'follow_up_required': session_doc.counsellor_follow_up_required,
        'completed_at': session_doc.counsellor_completed_at.isoformat() if session_doc.counsellor_completed_at else None,
    }


def _serialize_doctor_stage(stage) -> dict | None:
    """Serialize active doctor stage data."""
    if not stage:
        return None
    result = {
        'diagnosis': stage.diagnosis,
        'treatment_plan': stage.treatment_plan,
        'clinical_notes': stage.clinical_notes,
        'next_visit_date': stage.next_visit_date.isoformat() if stage.next_visit_date else None,
        'completed_at': stage.completed_at.isoformat() if stage.completed_at else None,
        'prescriptions': [],
    }
    if stage.vital_signs:
        result['vital_signs'] = {
            'blood_pressure': stage.vital_signs.blood_pressure,
            'pulse': stage.vital_signs.pulse,
            'weight': stage.vital_signs.weight_kg,
            'temperature': stage.vital_signs.temperature_f,
        }
    if stage.prescriptions:
        result['prescriptions'] = [{
            'id': str(item.draft_item_id),
            'medicine_id': str(item.medicine_id),
            'dosage': item.dosage,
            'frequency': item.frequency,
            'duration_days': item.duration_days,
            'quantity': item.quantity,
            'instructions': item.instructions,
        } for item in stage.prescriptions]
    return result
