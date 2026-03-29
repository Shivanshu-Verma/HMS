"""
Receptionist views for visit creation and active queue management.

Handles check-in (creating active sessions), counsellor assignment,
and listing today's active visits.
"""
import datetime
import logging
import uuid

from rest_framework.views import APIView
from bson import ObjectId
from django.conf import settings

from apps.auth_app.permissions import IsReceptionist
from apps.patients.models import Patient
from apps.sessions.models import (
    ActiveSession, ActivePatientSnapshot, SessionState,
    SessionAssignments, SessionTimestamps,
)
from apps.receptionist.serializers import (
    CreateVisitSerializer,
    AssignCounsellorSerializer,
    serialize_active_session_for_queue,
)
from utils.response import success_response
from utils.exceptions import NotFoundError, ConflictError

logger = logging.getLogger(__name__)


class CreateVisitView(APIView):
    """
    Create a new active visit session (patient check-in).

    POST /api/v1/visits
    """

    permission_classes = [IsReceptionist]

    def post(self, request):
        """
        Create an active session for a patient. Checks for existing active visit today.

        Args:
            request: DRF request with patient_id.

        Returns:
            Response: Created active session data.

        Raises:
            NotFoundError: If patient doesn't exist.
            ConflictError: If patient already has an active visit today.
        """
        serializer = CreateVisitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        patient_id = ObjectId(serializer.validated_data['patient_id'])
        hospital_id = ObjectId(request.user.hospital_id)

        # Verify patient exists
        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            raise NotFoundError(message="Patient not found.", code="PATIENT_NOT_FOUND")

        now = datetime.datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + datetime.timedelta(days=1)

        # Check for existing active visit today
        existing = ActiveSession.objects(
            hospital_id=hospital_id,
            patient_id=patient_id,
            visit_date__gte=today_start,
            visit_date__lt=today_end,
            state__status='in_progress',
        ).first()

        if existing:
            raise ConflictError(
                message="Patient already has an active visit today.",
                code="ACTIVE_VISIT_EXISTS",
            )

        # Calculate visit number
        visit_count = patient.visit_count + 1

        # Create active session with patient snapshot
        snapshot = ActivePatientSnapshot(
            patient_uid=patient.patient_uid,
            registration_number=patient.registration_number,
            full_name=patient.full_name,
            date_of_birth=patient.date_of_birth,
            gender=patient.gender,
            phone=patient.phone,
            addiction_type=patient.addiction_profile.addiction_type if patient.addiction_profile else None,
            allergies=patient.medical_background.allergies if patient.medical_background else None,
            medical_history=patient.medical_background.medical_history if patient.medical_background else None,
        )

        session = ActiveSession(
            hospital_id=hospital_id,
            active_visit_uid=f"VIS-{uuid.uuid4().hex[:12].upper()}",
            patient_id=patient_id,
            patient_snapshot=snapshot,
            visit_number=visit_count,
            visit_date=now,
            state=SessionState(
                current_stage='counsellor',
                stage_status='waiting',
                status='in_progress',
            ),
            assignments=SessionAssignments(
                receptionist_id=ObjectId(request.user.id),
            ),
            timestamps=SessionTimestamps(
                checkin_at=now,
                updated_at=now,
            ),
            participants=[ObjectId(request.user.id)],
            expires_at=now + datetime.timedelta(hours=24),
            created_at=now,
            updated_at=now,
        )
        session.save()

        return success_response(serialize_active_session_for_queue(session), status=201)


class ActiveVisitsView(APIView):
    """
    List today's active visits for the queue dashboard.

    GET /api/v1/visits/active
    """

    permission_classes = [IsReceptionist]

    def get(self, request):
        """
        Return all active sessions for today.

        Args:
            request: DRF request.

        Returns:
            Response: List of active sessions with patient data.
        """
        hospital_id = ObjectId(request.user.hospital_id)
        now = datetime.datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + datetime.timedelta(days=1)

        sessions = ActiveSession.objects(
            hospital_id=hospital_id,
            visit_date__gte=today_start,
            visit_date__lt=today_end,
        ).order_by('timestamps__checkin_at')

        serialized = [serialize_active_session_for_queue(s) for s in sessions]

        return success_response({'items': serialized, 'total': len(serialized)})


class AssignCounsellorView(APIView):
    """
    Reassign an active counsellor-stage visit to a counsellor.

    PATCH /api/v1/visits/{activeSessionId}/assign-counsellor
    """

    permission_classes = [IsReceptionist]

    def patch(self, request, session_id):
        """
        Update the counsellor assignment for a waiting/in-progress counsellor-stage visit.

        Args:
            request: DRF request with counsellor_id.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Updated session queue payload.

        Raises:
            NotFoundError: If session does not exist.
            ConflictError: If the session is not in the counsellor stage.
        """
        serializer = AssignCounsellorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            session = ActiveSession.objects.get(id=ObjectId(session_id))
        except ActiveSession.DoesNotExist:
            raise NotFoundError(message="Session not found.", code="SESSION_NOT_FOUND")

        if session.state.current_stage != 'counsellor' or session.state.status != 'in_progress':
            raise ConflictError(
                message="Counsellor can only be reassigned during active counsellor stage.",
                code="WRONG_STAGE",
            )

        counsellor_id = ObjectId(serializer.validated_data['counsellor_id'])
        now = datetime.datetime.utcnow()

        session.assignments.counsellor_id = counsellor_id
        session.timestamps.updated_at = now
        session.updated_at = now

        if counsellor_id not in session.participants:
            session.participants.append(counsellor_id)

        session.save()
        return success_response(serialize_active_session_for_queue(session))
