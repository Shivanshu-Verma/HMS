"""
Consultant (counsellor) views for session management.

Handles queue listing, session start/context/notes/assign-doctor, and history.
"""
import datetime
import logging

from rest_framework.views import APIView
from bson import ObjectId
from django.conf import settings

from apps.auth_app.permissions import IsConsultant
from apps.sessions.models import ActiveSession, ActiveCounsellorStage
from apps.patients.models import Visit, Patient
from apps.receptionist.serializers import serialize_active_session_for_queue
from apps.patients.serializers import serialize_patient, serialize_visit_summary
from utils.response import success_response, paginated_response
from utils.pagination import parse_pagination_params, paginate_queryset
from utils.exceptions import NotFoundError, ConflictError, HMSError

logger = logging.getLogger(__name__)


class ConsultantQueueView(APIView):
    """
    Get the counsellor queue — patients at the 'counsellor' stage.

    GET /api/v1/consultant/queue
    """

    permission_classes = [IsConsultant]

    def get(self, request):
        """
        Return all active sessions at the counsellor stage, sorted by check-in time.

        Args:
            request: DRF request.

        Returns:
            Response: List of active sessions awaiting counselling.
        """
        hospital_id = ObjectId(request.user.hospital_id)

        sessions = ActiveSession.objects(
            hospital_id=hospital_id,
            state__current_stage='counsellor',
            state__status='in_progress',
        ).order_by('timestamps__checkin_at')

        serialized = [serialize_active_session_for_queue(s) for s in sessions]
        return success_response({'items': serialized, 'total': len(serialized)})


class StartSessionView(APIView):
    """
    Mark a counsellor session as started.

    POST /api/v1/consultant/sessions/{id}/start
    """

    permission_classes = [IsConsultant]

    def post(self, request, session_id):
        """
        Set the counsellor as assigned and mark the session as in-progress.

        Args:
            request: DRF request.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Updated session data.

        Raises:
            NotFoundError: If session doesn't exist.
            ConflictError: If session is not at the counsellor stage.
        """
        try:
            session = ActiveSession.objects.get(id=ObjectId(session_id))
        except ActiveSession.DoesNotExist:
            raise NotFoundError(message="Session not found.", code="SESSION_NOT_FOUND")

        if session.state.current_stage != 'counsellor':
            raise ConflictError(message="Session is not at the counsellor stage.", code="WRONG_STAGE")

        now = datetime.datetime.utcnow()
        counsellor_id = ObjectId(request.user.id)

        # Update session
        session.state.stage_status = 'in_progress'
        session.assignments.counsellor_id = counsellor_id
        session.timestamps.counsellor_started_at = now
        session.timestamps.updated_at = now
        session.updated_at = now

        if counsellor_id not in session.participants:
            session.participants.append(counsellor_id)

        session.save()

        return success_response(serialize_active_session_for_queue(session))


class SessionContextView(APIView):
    """
    Get full context for a counsellor session (patient details + history).

    GET /api/v1/consultant/sessions/{id}/context
    """

    permission_classes = [IsConsultant]

    def get(self, request, session_id):
        """
        Return session data with patient details and past visit history.

        Args:
            request: DRF request.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Session context with patient details and previous visits.
        """
        try:
            session = ActiveSession.objects.get(id=ObjectId(session_id))
        except ActiveSession.DoesNotExist:
            raise NotFoundError(message="Session not found.", code="SESSION_NOT_FOUND")

        # Get full patient details
        patient = None
        try:
            patient_doc = Patient.objects.get(id=session.patient_id)
            patient = serialize_patient(patient_doc)
        except Patient.DoesNotExist:
            pass

        # Get previous visits from archive
        hospital_id = ObjectId(request.user.hospital_id)
        previous_visits = Visit.objects(
            hospital_id=hospital_id,
            patient_id=session.patient_id,
        ).order_by('-visit_date').limit(5)

        previous_visits_serialized = [serialize_visit_summary(v) for v in previous_visits]

        session_data = serialize_active_session_for_queue(session)
        session_data['patient_details'] = patient
        session_data['previous_visits'] = previous_visits_serialized

        return success_response(session_data)


class SubmitNotesView(APIView):
    """
    Submit counsellor session notes.

    POST /api/v1/consultant/sessions/{id}/notes
    """

    permission_classes = [IsConsultant]

    def post(self, request, session_id):
        """
        Save counsellor notes, mood assessment, and risk level to the active session.

        Args:
            request: DRF request with session notes data.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Updated session data.
        """
        from apps.consultant.serializers import SessionNotesSerializer

        try:
            session = ActiveSession.objects.get(id=ObjectId(session_id))
        except ActiveSession.DoesNotExist:
            raise NotFoundError(message="Session not found.", code="SESSION_NOT_FOUND")

        if session.state.current_stage != 'counsellor':
            raise ConflictError(message="Session is not at the counsellor stage.", code="WRONG_STAGE")

        serializer = SessionNotesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        now = datetime.datetime.utcnow()
        counsellor_id = ObjectId(request.user.id)

        # Calculate session duration
        started_at = session.timestamps.counsellor_started_at or now
        duration = max(1, int((now - started_at).total_seconds() / 60))

        # Save counsellor stage data
        session.counsellor_stage = ActiveCounsellorStage(
            session_notes=data['session_notes'],
            mood_assessment=data.get('mood_assessment', 5),
            risk_level=data['risk_level'],
            recommendations=data.get('recommendations'),
            follow_up_required=data.get('follow_up_required', True),
            session_duration_minutes=duration,
            completed_by=counsellor_id,
            completed_at=now,
        )

        session.state.stage_status = 'ready_for_next'
        session.timestamps.counsellor_completed_at = now
        session.timestamps.updated_at = now
        session.updated_at = now
        session.save()

        return success_response(serialize_active_session_for_queue(session))


class AssignDoctorView(APIView):
    """
    Move the session from counsellor to doctor stage.

    PATCH /api/v1/consultant/sessions/{id}/assign-doctor
    """

    permission_classes = [IsConsultant]

    def patch(self, request, session_id):
        """
        Transition the session to the doctor stage.

        Args:
            request: DRF request.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Updated session data.
        """
        try:
            session = ActiveSession.objects.get(id=ObjectId(session_id))
        except ActiveSession.DoesNotExist:
            raise NotFoundError(message="Session not found.", code="SESSION_NOT_FOUND")

        if session.state.current_stage != 'counsellor':
            raise ConflictError(message="Session is not at the counsellor stage.", code="WRONG_STAGE")

        if not session.counsellor_stage or not session.counsellor_stage.completed_at:
            raise HMSError(
                code="NOTES_NOT_SUBMITTED",
                message="Please submit session notes before forwarding to doctor.",
                status_code=400,
            )

        now = datetime.datetime.utcnow()

        session.state.current_stage = 'doctor'
        session.state.stage_status = 'waiting'
        session.timestamps.updated_at = now
        session.updated_at = now
        session.save()

        return success_response(serialize_active_session_for_queue(session))


class ConsultantHistoryView(APIView):
    """
    Get counsellor's completed session history from archives.

    GET /api/v1/consultant/history
    """

    permission_classes = [IsConsultant]

    def get(self, request):
        """
        Return paginated visit history for visits this counsellor completed.

        Args:
            request: DRF request.

        Returns:
            Response: Paginated list of archived visits.
        """
        hospital_id = ObjectId(request.user.hospital_id)
        counsellor_id = ObjectId(request.user.id)
        page, page_size = parse_pagination_params(request)

        visits = Visit.objects(
            hospital_id=hospital_id,
            assignments__counsellor_id=counsellor_id,
        ).order_by('-lifecycle__completed_at')

        items, total, has_next = paginate_queryset(visits, page, page_size)
        serialized = [serialize_visit_summary(v) for v in items]

        return paginated_response(serialized, page, page_size, total, has_next)
