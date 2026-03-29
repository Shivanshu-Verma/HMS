"""
Patient views for cross-role patient operations.

Handles patient registration, lookup, and history retrieval.
"""
import datetime
import logging
import uuid

from rest_framework.views import APIView
from bson import ObjectId
from django.conf import settings

from apps.auth_app.permissions import IsReceptionist, IsReceptionistOrConsultantOrDoctor, IsConsultantOrDoctor
from apps.patients.models import Patient, Visit, Address, AddictionProfile, EmergencyContact, MedicalBackground, Biometric
from apps.patients.serializers import (
    PatientRegistrationSerializer, FingerprintLookupSerializer,
    serialize_patient, serialize_patient_summary, serialize_visit_summary, serialize_visit_detail,
)
from utils.response import success_response, paginated_response
from utils.pagination import parse_pagination_params, paginate_queryset
from utils.fingerprint import hash_fingerprint
from utils.exceptions import NotFoundError, ConflictError

logger = logging.getLogger(__name__)


def _generate_registration_number() -> str:
    """Generate a 'PAT-YYYYMMDD-XXXX' registration number."""
    date_part = datetime.datetime.utcnow().strftime('%Y%m%d')
    rand_part = uuid.uuid4().hex[:4].upper()
    return f"PAT-{date_part}-{rand_part}"


def _generate_patient_uid() -> str:
    """Generate a unique patient UID."""
    return f"PID-{uuid.uuid4().hex[:12].upper()}"


class RegisterPatientView(APIView):
    """
    Register a new patient.

    POST /api/v1/patients
    """

    permission_classes = [IsReceptionist]

    def post(self, request):
        """
        Create a new patient record with demographics, addiction profile, and fingerprint hash.

        Args:
            request: DRF request with patient registration data.

        Returns:
            Response: Created patient data.

        Raises:
            ConflictError: If fingerprint hash already exists.
        """
        serializer = PatientRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        hospital_id = ObjectId(request.user.hospital_id)

        # Hash the fingerprint template
        fp_hash = hash_fingerprint(data['fingerprint_template'])

        # Check for duplicate fingerprint
        existing = Patient.objects(
            hospital_id=hospital_id,
            biometric__fingerprint_hash_sha256=fp_hash,
        ).first()
        if existing:
            raise ConflictError(
                message="A patient with this fingerprint is already registered.",
                code="DUPLICATE_FINGERPRINT",
            )

        now = datetime.datetime.utcnow()

        patient = Patient(
            hospital_id=hospital_id,
            patient_uid=_generate_patient_uid(),
            registration_number=_generate_registration_number(),
            full_name=data['full_name'],
            date_of_birth=data['date_of_birth'],
            gender=data['gender'],
            blood_group=data.get('blood_group'),
            phone=data['phone'],
            email=data.get('email'),
            address=Address(
                line1=data['address']['line1'],
                city=data['address']['city'],
                state=data['address']['state'],
                pincode=data['address']['pincode'],
            ),
            aadhaar_number_last4=data.get('aadhaar_number_last4'),
            addiction_profile=AddictionProfile(
                addiction_type=data['addiction_type'],
                addiction_duration_text=data.get('addiction_duration_text'),
            ),
            emergency_contact=EmergencyContact(
                name=data['emergency_contact']['name'],
                phone=data['emergency_contact']['phone'],
                relation=data['emergency_contact']['relation'],
            ),
            medical_background=MedicalBackground(
                family_history=data.get('family_history'),
                medical_history=data.get('medical_history'),
                allergies=data.get('allergies'),
                current_medications=data.get('current_medications'),
                previous_treatments=data.get('previous_treatments'),
            ),
            biometric=Biometric(
                fingerprint_hash_sha256=fp_hash,
                fingerprint_hash_version='sha256-v1',
                fingerprint_enrolled_at=now,
            ),
            status='active',
            created_by=ObjectId(request.user.id),
            created_at=now,
            updated_at=now,
        )
        patient.save()

        return success_response(serialize_patient(patient), status=201)


class GetPatientView(APIView):
    """
    Retrieve a patient by ID.

    GET /api/v1/patients/{patientId}
    """

    permission_classes = [IsReceptionistOrConsultantOrDoctor]

    def get(self, request, patient_id):
        """
        Fetch a single patient document.

        Args:
            request: DRF request.
            patient_id: Patient ObjectId string.

        Returns:
            Response: Full patient data.

        Raises:
            NotFoundError: If patient does not exist.
        """
        try:
            patient = Patient.objects.get(id=ObjectId(patient_id))
        except Patient.DoesNotExist:
            raise NotFoundError(message="Patient not found.", code="PATIENT_NOT_FOUND")

        return success_response(serialize_patient(patient))


class GetPatientByRegistrationView(APIView):
    """
    Retrieve a patient by registration number.

    GET /api/v1/patients/by-registration/{registrationNumber}
    """

    permission_classes = [IsReceptionist]

    def get(self, request, registration_number):
        """
        Fetch a patient by their registration number.

        Args:
            request: DRF request.
            registration_number: Patient registration number string.

        Returns:
            Response: Full patient data.

        Raises:
            NotFoundError: If no patient with this registration number.
        """
        hospital_id = ObjectId(request.user.hospital_id)
        try:
            patient = Patient.objects.get(
                hospital_id=hospital_id,
                registration_number=registration_number,
            )
        except Patient.DoesNotExist:
            raise NotFoundError(message="Patient not found.", code="PATIENT_NOT_FOUND")

        return success_response(serialize_patient(patient))


class LookupFingerprintView(APIView):
    """
    Look up a patient by fingerprint template hash.

    POST /api/v1/patients/lookup-fingerprint
    """

    permission_classes = [IsReceptionist]

    def post(self, request):
        """
        Hash the provided fingerprint and look up matching patient.

        Args:
            request: DRF request with fingerprint_template.

        Returns:
            Response: Matching patient data or not found response.
        """
        serializer = FingerprintLookupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        fp_hash = hash_fingerprint(serializer.validated_data['fingerprint_template'])
        hospital_id = ObjectId(request.user.hospital_id)

        patient = Patient.objects(
            hospital_id=hospital_id,
            biometric__fingerprint_hash_sha256=fp_hash,
        ).first()

        if not patient:
            raise NotFoundError(message="No patient found for this fingerprint.", code="FINGERPRINT_NOT_FOUND")

        return success_response(serialize_patient(patient))


class PatientSearchView(APIView):
    """
    Search patients by name, phone, or registration number.

    GET /api/v1/patients/search?q=...
    """

    permission_classes = [IsReceptionistOrConsultantOrDoctor]

    def get(self, request):
        """
        Search patients with a text query.

        Args:
            request: DRF request with 'q' query parameter.

        Returns:
            Response: Paginated list of matching patients.
        """
        query = request.query_params.get('q', '').strip()
        hospital_id = ObjectId(request.user.hospital_id)
        page, page_size = parse_pagination_params(request)

        if query:
            # Use regex for partial matching
            import re
            pattern = re.compile(re.escape(query), re.IGNORECASE)
            patients = Patient.objects(
                hospital_id=hospital_id,
            ).filter(
                __raw__={
                    '$or': [
                        {'full_name': {'$regex': pattern.pattern, '$options': 'i'}},
                        {'registration_number': {'$regex': pattern.pattern, '$options': 'i'}},
                        {'phone': {'$regex': pattern.pattern, '$options': 'i'}},
                    ]
                }
            ).order_by('-updated_at')
        else:
            patients = Patient.objects(hospital_id=hospital_id).order_by('-updated_at')

        items, total, has_next = paginate_queryset(patients, page, page_size)
        serialized = [serialize_patient_summary(p) for p in items]

        return paginated_response(serialized, page, page_size, total, has_next)


class PatientSummaryView(APIView):
    """
    Get patient summary with basic info and visit count.

    GET /api/v1/patients/{patientId}/summary
    """

    permission_classes = [IsReceptionistOrConsultantOrDoctor]

    def get(self, request, patient_id):
        """
        Return a lightweight patient summary.

        Args:
            request: DRF request.
            patient_id: Patient ObjectId string.

        Returns:
            Response: Patient summary data.
        """
        try:
            patient = Patient.objects.get(id=ObjectId(patient_id))
        except Patient.DoesNotExist:
            raise NotFoundError(message="Patient not found.", code="PATIENT_NOT_FOUND")

        return success_response(serialize_patient_summary(patient))


class PatientHistoryView(APIView):
    """
    Get patient visit history from the archive.

    GET /api/v1/patients/{patientId}/history
    """

    permission_classes = [IsConsultantOrDoctor]

    def get(self, request, patient_id):
        """
        Return paginated visit history for a patient.

        Args:
            request: DRF request.
            patient_id: Patient ObjectId string.

        Returns:
            Response: Paginated list of archived visit summaries.
        """
        try:
            patient = Patient.objects.get(id=ObjectId(patient_id))
        except Patient.DoesNotExist:
            raise NotFoundError(message="Patient not found.", code="PATIENT_NOT_FOUND")

        hospital_id = ObjectId(request.user.hospital_id)
        page, page_size = parse_pagination_params(request)

        visits = Visit.objects(
            hospital_id=hospital_id,
            patient_id=patient.id,
        ).order_by('-visit_date')

        items, total, has_next = paginate_queryset(visits, page, page_size)
        serialized = [serialize_visit_summary(v) for v in items]

        return paginated_response(serialized, page, page_size, total, has_next)


class VisitDetailView(APIView):
    """
    Get detailed archived visit record.

    GET /api/v1/visits/{visitId}/detail
    """

    permission_classes = [IsConsultantOrDoctor]

    def get(self, request, visit_id):
        """
        Return full detail of an archived visit.

        Args:
            request: DRF request.
            visit_id: Visit ObjectId string.

        Returns:
            Response: Complete visit data with all stages.
        """
        try:
            visit = Visit.objects.get(id=ObjectId(visit_id))
        except Visit.DoesNotExist:
            raise NotFoundError(message="Visit not found.", code="VISIT_NOT_FOUND")

        return success_response(serialize_visit_detail(visit))
