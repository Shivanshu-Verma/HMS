"""Session endpoints for check-in and active session creation."""
import datetime

from bson import ObjectId
from rest_framework import serializers
from rest_framework.views import APIView

from apps.auth_app.permissions import IsReceptionist
from apps.patients.models import Patient
from apps.sessions.models import ActiveSession
from utils.exceptions import ConflictError, ForbiddenError, NotFoundError
from utils.response import success_response


class CheckinSerializer(serializers.Serializer):
    """Input payload for creating a new active check-in session."""

    patient_id = serializers.CharField(required=True)


def serialize_active_session(session: ActiveSession) -> dict:
    """Serialize the new active session contract for queue endpoints."""

    return {
        'session_id': str(session.id),
        'patient_id': str(session.patient_id),
        'patient_name': session.patient_name,
        'checked_in_by': str(session.checked_in_by),
        'checked_in_by_name': session.checked_in_by_name,
        'checked_in_at': session.checked_in_at.isoformat(),
        'status': session.status,
        'dispense_items': [
            {
                'medicine_id': str(item.medicine_id),
                'medicine_name': item.medicine_name,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'line_total': item.line_total,
            }
            for item in session.dispense_items
        ],
        'outstanding_debt_at_checkin': session.outstanding_debt_at_checkin,
    }


class CheckinView(APIView):
    """Create an active session for a patient after status and conflict checks."""

    permission_classes = [IsReceptionist]

    def post(self, request):
        serializer = CheckinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        patient_id = ObjectId(serializer.validated_data['patient_id'])
        hospital_id = ObjectId(request.user.hospital_id)

        try:
            patient = Patient.objects.get(id=patient_id, hospital_id=hospital_id)
        except Patient.DoesNotExist:
            raise NotFoundError(message='Patient not found.', code='PATIENT_NOT_FOUND')

        if patient.status == 'dead':
            raise ForbiddenError(
                code='PATIENT_DECEASED',
                message='This patient is marked as deceased and cannot be checked in.',
            )

        if ActiveSession.objects(hospital_id=hospital_id, patient_id=patient.id).first():
            raise ConflictError(
                code='SESSION_ALREADY_ACTIVE',
                message='An active session already exists for this patient.',
            )

        now = datetime.datetime.utcnow()
        session = ActiveSession(
            hospital_id=hospital_id,
            patient_id=patient.id,
            patient_name=patient.full_name,
            checked_in_by=ObjectId(request.user.id),
            checked_in_by_name=request.user.full_name,
            checked_in_at=now,
            status='checked_in',
            dispense_items=[],
            outstanding_debt_at_checkin=float(patient.outstanding_debt or 0.0),
            created_at=now,
            updated_at=now,
        )
        session.save()

        return success_response(serialize_active_session(session), status=201)
