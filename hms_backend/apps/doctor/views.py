"""
Doctor views for consultation management.

Handles queue listing, consultation start/context/findings/prescriptions,
pharmacy assignment, medicine search, and consultation history.
"""
import datetime
import logging

from bson import ObjectId
from rest_framework.views import APIView

from apps.auth_app.permissions import IsDoctor, IsDoctorOrPharmacy
from apps.doctor.serializers import FindingsSerializer, PrescriptionsSerializer, serialize_medicine
from apps.patients.models import Medicine, Visit
from apps.patients.serializers import serialize_patient, serialize_visit_summary
from apps.receptionist.serializers import serialize_active_session_for_queue
from apps.sessions.flow import is_doctor_stage
from apps.sessions.models import (
    ActiveDoctorStage,
    ActivePrescriptionDraft,
    ActiveSession,
    ActiveVitalSigns,
)
from utils.exceptions import ConflictError, HMSError
from utils.hospital_scope import (
    get_medicine_for_hospital,
    get_patient_for_hospital,
    get_request_hospital_id,
    get_request_user_id,
    get_session_for_hospital,
)
from utils.pagination import paginate_queryset, parse_pagination_params
from utils.response import paginated_response, success_response

logger = logging.getLogger(__name__)


class DoctorQueueView(APIView):
    """
    Get the doctor queue — patients at the 'doctor' stage.

    GET /api/v1/doctor/queue
    """

    permission_classes = [IsDoctor]

    def get(self, request):
        """
        Return all active sessions at the doctor stage, sorted by counsellor completion.

        High-risk patients (from counsellor notes) are prioritized by the frontend.

        Args:
            request: DRF request.

        Returns:
            Response: List of active sessions awaiting doctor consultation.
        """
        hospital_id = get_request_hospital_id(request)

        sessions = ActiveSession.objects(
            hospital_id=hospital_id,
            status='checked_in',
            counsellor_completed_at__exists=True,
            doctor_completed_at__exists=False,
        ).order_by('counsellor_completed_at')

        serialized = [serialize_active_session_for_queue(s) for s in sessions]
        return success_response({'items': serialized, 'total': len(serialized)})


class StartConsultationView(APIView):
    """
    Mark a doctor consultation as started.

    POST /api/v1/doctor/consultations/{id}/start
    """

    permission_classes = [IsDoctor]

    def post(self, request, session_id):
        """
        Set the doctor as assigned and mark the consultation as in-progress.

        Args:
            request: DRF request.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Updated session data.
        """
        hospital_id = get_request_hospital_id(request)
        session = get_session_for_hospital(session_id, hospital_id)

        if not is_doctor_stage(session):
            raise ConflictError(message="Session is not at the doctor stage.", code="WRONG_STAGE")

        now = datetime.datetime.utcnow()
        doctor_id = get_request_user_id(request)

        session.assigned_doctor_id = doctor_id
        if not session.doctor_started_at:
            session.doctor_started_at = now
        session.updated_at = now
        session.save()

        return success_response(serialize_active_session_for_queue(session))


class ConsultationContextView(APIView):
    """
    Get full context for a doctor consultation.

    GET /api/v1/doctor/consultations/{id}/context
    """

    permission_classes = [IsDoctor]

    def get(self, request, session_id):
        """
        Return session with patient details, counsellor notes, and previous visits.

        Args:
            request: DRF request.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Full consultation context.
        """
        hospital_id = get_request_hospital_id(request)
        session = get_session_for_hospital(session_id, hospital_id)
        patient_doc = get_patient_for_hospital(session.patient_id, hospital_id)
        patient = serialize_patient(patient_doc)

        # Get previous visits
        previous_visits = Visit.objects(
            hospital_id=hospital_id,
            patient_id=session.patient_id,
        ).order_by('-visit_date').limit(5)

        session_data = serialize_active_session_for_queue(session)
        session_data['patient_details'] = patient
        session_data['previous_visits'] = [serialize_visit_summary(v) for v in previous_visits]

        return success_response(session_data)


class SaveFindingsView(APIView):
    """
    Save doctor diagnosis, findings, and vital signs.

    POST /api/v1/doctor/consultations/{id}/findings
    """

    permission_classes = [IsDoctor]

    def post(self, request, session_id):
        """
        Save doctor examination findings to the active session.

        Args:
            request: DRF request with diagnosis, treatment plan, etc.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Updated session data.
        """
        hospital_id = get_request_hospital_id(request)
        session = get_session_for_hospital(session_id, hospital_id)

        if not is_doctor_stage(session):
            raise ConflictError(message="Session is not at the doctor stage.", code="WRONG_STAGE")

        serializer = FindingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        vital_data = data.get('vital_signs', {})
        vital_signs = None
        if vital_data and any(vital_data.values()):
            vital_signs = ActiveVitalSigns(
                blood_pressure=vital_data.get('blood_pressure', ''),
                pulse=vital_data.get('pulse'),
                weight_kg=vital_data.get('weight'),
                temperature_f=vital_data.get('temperature'),
            )

        next_visit_date = None
        if data.get('next_visit_date'):
            next_visit_date = datetime.datetime.combine(data['next_visit_date'], datetime.time())

        # Preserve existing prescriptions if doctor stage already has them.
        existing_prescriptions = []
        if session.doctor_stage and session.doctor_stage.prescriptions:
            existing_prescriptions = session.doctor_stage.prescriptions

        session.doctor_stage = ActiveDoctorStage(
            diagnosis=data['diagnosis'],
            treatment_plan=data.get('treatment_plan'),
            clinical_notes=data.get('clinical_notes'),
            vital_signs=vital_signs,
            next_visit_date=next_visit_date,
            prescriptions=existing_prescriptions,
        )

        now = datetime.datetime.utcnow()
        session.assigned_doctor_id = session.assigned_doctor_id or get_request_user_id(request)
        session.doctor_started_at = session.doctor_started_at or now
        session.updated_at = now
        session.save()

        return success_response(serialize_active_session_for_queue(session))


class SavePrescriptionsView(APIView):
    """
    Save prescription items for a consultation.

    POST /api/v1/doctor/consultations/{id}/prescriptions
    """

    permission_classes = [IsDoctor]

    def post(self, request, session_id):
        """
        Save prescriptions to the active session doctor stage.

        Args:
            request: DRF request with prescriptions list.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Updated session data.
        """
        hospital_id = get_request_hospital_id(request)
        session = get_session_for_hospital(session_id, hospital_id)

        if not is_doctor_stage(session):
            raise ConflictError(message="Session is not at the doctor stage.", code="WRONG_STAGE")

        serializer = PrescriptionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        prescriptions = []
        for item in serializer.validated_data['prescriptions']:
            medicine = get_medicine_for_hospital(
                item['medicine_id'],
                hospital_id,
                is_active=True,
            )
            prescriptions.append(ActivePrescriptionDraft(
                medicine_id=medicine.id,
                dosage=item['dosage'],
                frequency=item['frequency'],
                duration_days=item['duration_days'],
                quantity=item['quantity'],
                instructions=item.get('instructions'),
            ))

        if not session.doctor_stage:
            session.doctor_stage = ActiveDoctorStage()

        session.doctor_stage.prescriptions = prescriptions

        now = datetime.datetime.utcnow()
        session.assigned_doctor_id = session.assigned_doctor_id or get_request_user_id(request)
        session.doctor_started_at = session.doctor_started_at or now
        session.updated_at = now
        session.save()

        return success_response(serialize_active_session_for_queue(session))


class AssignPharmacyView(APIView):
    """
    Move the session from doctor to pharmacy stage.

    PATCH /api/v1/doctor/consultations/{id}/assign-pharmacy
    """

    permission_classes = [IsDoctor]

    def patch(self, request, session_id):
        """
        Complete the doctor stage and transition to pharmacy.

        Args:
            request: DRF request.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Updated session data.
        """
        hospital_id = get_request_hospital_id(request)
        session = get_session_for_hospital(session_id, hospital_id)

        if not is_doctor_stage(session):
            raise ConflictError(message="Session is not at the doctor stage.", code="WRONG_STAGE")

        if not session.doctor_stage or not session.doctor_stage.diagnosis:
            raise HMSError(
                code="FINDINGS_NOT_SUBMITTED",
                message="Please submit diagnosis before forwarding to pharmacy.",
                status_code=400,
            )

        now = datetime.datetime.utcnow()
        doctor_id = get_request_user_id(request)

        session.doctor_stage.completed_by = doctor_id
        session.doctor_stage.completed_at = now
        session.assigned_doctor_id = doctor_id
        session.doctor_started_at = session.doctor_started_at or now
        session.doctor_completed_at = now
        session.status = 'dispensing'
        session.updated_at = now
        session.save()

        return success_response(serialize_active_session_for_queue(session))


class MedicineSearchView(APIView):
    """
    Search available medicines for prescription.

    GET /api/v1/medicines/search?q=...
    """

    permission_classes = [IsDoctorOrPharmacy]

    def get(self, request):
        """
        Search medicines by name or generic name.

        Args:
            request: DRF request with 'q' query parameter.

        Returns:
            Response: List of matching active medicines.
        """
        query = request.query_params.get('q', '').strip()
        hospital_id = get_request_hospital_id(request)

        medicines = Medicine.objects(
            hospital_id=hospital_id,
            is_active=True,
        )

        if query:
            import re
            pattern = re.escape(query)
            medicines = medicines.filter(
                __raw__={
                    '$or': [
                        {'name': {'$regex': pattern, '$options': 'i'}},
                        {'generic_name': {'$regex': pattern, '$options': 'i'}},
                    ]
                }
            )

        medicines = medicines.order_by('name').limit(50)
        serialized = [serialize_medicine(m) for m in medicines]

        return success_response({'items': serialized})


class DoctorHistoryView(APIView):
    """
    Get doctor's completed consultation history.

    GET /api/v1/doctor/history
    """

    permission_classes = [IsDoctor]

    def get(self, request):
        """
        Return paginated visit history for visits this doctor completed.

        Args:
            request: DRF request.

        Returns:
            Response: Paginated archived visit summaries.
        """
        hospital_id = ObjectId(request.user.hospital_id)
        doctor_id = get_request_user_id(request)
        page, page_size = parse_pagination_params(request)

        visits = Visit.objects(
            hospital_id=hospital_id,
            assignments__doctor_id=doctor_id,
        ).order_by('-lifecycle__completed_at')

        items, total, has_next = paginate_queryset(visits, page, page_size)
        serialized = [serialize_visit_summary(v) for v in items]

        return paginated_response(serialized, page, page_size, total, has_next)
