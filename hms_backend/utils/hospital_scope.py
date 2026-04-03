"""Helpers for consistent hospital-scoped object access."""

from bson import ObjectId

from utils.exceptions import NotFoundError


def get_request_hospital_id(request) -> ObjectId:
    """Return the authenticated user's hospital id as an ObjectId."""

    return ObjectId(request.user.hospital_id)


def get_request_user_id(request) -> ObjectId:
    """Return the authenticated user's staff id as an ObjectId."""

    return ObjectId(request.user.id)


def get_patient_for_hospital(patient_id, hospital_id):
    """Return a patient within the provided hospital scope."""

    from apps.patients.models import Patient

    patient = Patient.objects(id=ObjectId(patient_id), hospital_id=hospital_id).first()
    if not patient:
        raise NotFoundError(message='Patient not found.', code='PATIENT_NOT_FOUND')
    return patient


def get_session_for_hospital(session_id, hospital_id):
    """Return an active session within the provided hospital scope."""

    from apps.sessions.models import ActiveSession

    session = ActiveSession.objects(id=ObjectId(session_id), hospital_id=hospital_id).first()
    if not session:
        raise NotFoundError(message='Session not found.', code='SESSION_NOT_FOUND')
    return session


def get_medicine_for_hospital(medicine_id, hospital_id, **filters):
    """Return a medicine within the provided hospital scope."""

    from apps.patients.models import Medicine

    medicine = Medicine.objects(
        id=ObjectId(medicine_id),
        hospital_id=hospital_id,
        **filters,
    ).first()
    if not medicine:
        raise NotFoundError(message='Medicine not found.', code='MEDICINE_NOT_FOUND')
    return medicine
