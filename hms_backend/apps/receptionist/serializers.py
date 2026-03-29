"""
Serializers for receptionist endpoints.

Handles input validation for visit creation and active queue serialization.
"""
from rest_framework import serializers


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
    snapshot = session_doc.patient_snapshot
    return {
        'id': str(session_doc.id),
        'active_visit_uid': session_doc.active_visit_uid,
        'patient_id': str(session_doc.patient_id),
        'visit_number': session_doc.visit_number,
        'visit_date': session_doc.visit_date.isoformat() if session_doc.visit_date else None,
        'current_stage': session_doc.state.current_stage if session_doc.state else None,
        'stage_status': session_doc.state.stage_status if session_doc.state else None,
        'status': session_doc.state.status if session_doc.state else None,
        'checkin_time': session_doc.timestamps.checkin_at.isoformat() if session_doc.timestamps and session_doc.timestamps.checkin_at else None,
        'counsellor_start_time': session_doc.timestamps.counsellor_started_at.isoformat() if session_doc.timestamps and session_doc.timestamps.counsellor_started_at else None,
        'counsellor_end_time': session_doc.timestamps.counsellor_completed_at.isoformat() if session_doc.timestamps and session_doc.timestamps.counsellor_completed_at else None,
        'doctor_start_time': session_doc.timestamps.doctor_started_at.isoformat() if session_doc.timestamps and session_doc.timestamps.doctor_started_at else None,
        'doctor_end_time': session_doc.timestamps.doctor_completed_at.isoformat() if session_doc.timestamps and session_doc.timestamps.doctor_completed_at else None,
        'pharmacy_time': session_doc.timestamps.pharmacy_started_at.isoformat() if session_doc.timestamps and session_doc.timestamps.pharmacy_started_at else None,
        'patient': {
            'id': str(session_doc.patient_id),
            'registration_number': snapshot.registration_number if snapshot else None,
            'full_name': snapshot.full_name if snapshot else None,
            'phone': snapshot.phone if snapshot else None,
            'gender': snapshot.gender if snapshot else None,
            'date_of_birth': snapshot.date_of_birth.isoformat() if snapshot and snapshot.date_of_birth else None,
            'addiction_type': snapshot.addiction_type if snapshot else None,
            'allergies': snapshot.allergies if snapshot else None,
            'medical_history': snapshot.medical_history if snapshot else None,
        } if snapshot else None,
        'counsellor_stage': _serialize_counsellor_stage(session_doc.counsellor_stage),
        'doctor_stage': _serialize_doctor_stage(session_doc.doctor_stage),
    }


def _serialize_counsellor_stage(stage) -> dict | None:
    """Serialize active counsellor stage data."""
    if not stage:
        return None
    return {
        'session_notes': stage.session_notes,
        'mood_assessment': stage.mood_assessment,
        'risk_level': stage.risk_level,
        'recommendations': stage.recommendations,
        'follow_up_required': stage.follow_up_required,
        'session_duration_minutes': stage.session_duration_minutes,
        'completed_at': stage.completed_at.isoformat() if stage.completed_at else None,
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
