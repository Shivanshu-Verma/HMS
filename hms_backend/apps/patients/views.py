"""Patient module endpoints for registration, lookup, and profile updates."""
import datetime
import re
import uuid

from bson import ObjectId
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from apps.auth_app.permissions import (
    IsReceptionist,
    IsReceptionistOrConsultant,
    IsReceptionistOrConsultantOrDoctor,
)
from apps.patients.models import (
    Address,
    AddictionProfile,
    Biometric,
    EmergencyContact,
    MedicalBackground,
    Patient,
)
from apps.patients.serializers import (
    GENERAL_FIELDS,
    PatientGeneralDataSerializer,
    PatientLookupSerializer,
    PatientRegistrationSerializer,
    serialize_patient,
)
from utils.exceptions import HMSError, NotFoundError
from utils.fingerprint import (
    decrypt_fingerprint_template,
    encrypt_fingerprint_template,
    hash_fingerprint_template,
)
from utils.hospital_scope import get_patient_for_hospital, get_request_hospital_id
from utils.response import success_response


def _generate_registration_number() -> str:
    date_part = datetime.datetime.utcnow().strftime('%Y%m%d')
    rand_part = uuid.uuid4().hex[:4].upper()
    return f"PAT-{date_part}-{rand_part}"


def _generate_patient_uid() -> str:
    return f"PID-{uuid.uuid4().hex[:12].upper()}"


def _is_filled(value):
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ''
    return True


def _recalculate_general_data_complete(patient: Patient) -> bool:
    payload = serialize_patient(patient)
    for field in GENERAL_FIELDS:
        if not _is_filled(payload.get(field)):
            return False
    return True


def _mark_fingerprint_reenrollment_if_needed(patient: Patient) -> None:
    """
    Mark legacy biometric records as requiring re-enrollment.

    Args:
        patient (Patient): Patient document to normalize.
    """
    biometric = patient.biometric
    if not biometric:
        return

    has_encrypted_template = bool(getattr(biometric, 'fingerprint_template_encrypted', None))
    has_legacy_hash = bool(getattr(biometric, 'legacy_fingerprint_hash_sha256', None))

    if has_encrypted_template or not has_legacy_hash or biometric.fingerprint_reenrollment_required:
        return

    biometric.fingerprint_reenrollment_required = True
    patient.updated_at = datetime.datetime.utcnow()
    patient.save()


def _normalize_digits(value: str) -> str:
    return ''.join(ch for ch in value if ch.isdigit())


def _build_lookup_query(search_text: str) -> dict:
    pattern = re.escape(search_text)
    digits = _normalize_digits(search_text)
    clauses = [
        {'registration_number': {'$regex': pattern, '$options': 'i'}},
        {'full_name': {'$regex': pattern, '$options': 'i'}},
    ]

    if digits:
        clauses.append({'phone': {'$regex': re.escape(digits), '$options': 'i'}})
        if len(digits) >= 4:
            clauses.append({'aadhaar_number_last4': digits[-4:]})

    return {'$or': clauses}


class RegisterPatientView(APIView):
    """Create a patient using only Tier 1 mandatory fields."""

    permission_classes = [IsReceptionist]

    def post(self, request):
        serializer = PatientRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        now = datetime.datetime.utcnow()
        hospital_id = ObjectId(request.user.hospital_id)

        registration_number = data.get('file_number') or _generate_registration_number()
        existing = Patient.objects(
            hospital_id=hospital_id,
            registration_number=registration_number,
        ).first()
        if existing:
            raise ValidationError({'file_number': 'This file number already exists.'})

        aadhaar_number = (data.get('aadhaar_number') or '').strip()
        aadhaar_digits = ''.join(ch for ch in aadhaar_number if ch.isdigit())
        aadhaar_last4 = aadhaar_digits[-4:] if aadhaar_digits else None

        relative_phone = (data.get('relative_phone') or '').strip()
        address_line1 = (data.get('address_line1') or '').strip()

        patient = Patient(
            hospital_id=hospital_id,
            patient_uid=_generate_patient_uid(),
            registration_number=registration_number,
            patient_category=data.get('patient_category'),
            full_name=data['full_name'],
            phone=data['phone_number'],
            date_of_birth=datetime.datetime.combine(data['date_of_birth'], datetime.time()),
            gender=data['sex'],
            aadhaar_number_last4=aadhaar_last4,
            biometric=Biometric(
                fingerprint_template_encrypted=encrypt_fingerprint_template(data['fingerprint_template']),
                fingerprint_template_sha256=hash_fingerprint_template(data['fingerprint_template']),
                fingerprint_template_key_version='fernet-v1',
                fingerprint_enrolled_at=now,
                fingerprint_reenrollment_required=False,
            ),
            general_data_complete=False,
            status='active',
            created_by=ObjectId(request.user.id),
            created_at=now,
            updated_at=now,
        )

        if relative_phone:
            patient.emergency_contact = EmergencyContact(
                name='',
                phone=relative_phone,
                relation='relative',
            )

        if address_line1:
            patient.address = Address(
                line1=address_line1,
                city='',
                state='',
                pincode='',
            )

        patient.save()

        return success_response(serialize_patient(patient), status=201)


class UpdatePatientGeneralView(APIView):
    """Patch any subset of Tier 2 optional fields for a patient."""

    permission_classes = [IsReceptionistOrConsultant]

    def patch(self, request, patient_id):
        serializer = PatientGeneralDataSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        patient = get_patient_for_hospital(patient_id, get_request_hospital_id(request))

        data = serializer.validated_data

        if any(field in data for field in ['address_line1', 'city', 'state', 'pincode']):
            patient.address = Address(
                line1=data.get('address_line1', patient.address.line1 if patient.address else ''),
                city=data.get('city', patient.address.city if patient.address else ''),
                state=data.get('state', patient.address.state if patient.address else ''),
                pincode=data.get('pincode', patient.address.pincode if patient.address else ''),
            )

        if any(field in data for field in ['addiction_type', 'addiction_duration_text']):
            patient.addiction_profile = AddictionProfile(
                addiction_type=data.get('addiction_type', patient.addiction_profile.addiction_type if patient.addiction_profile else 'other'),
                addiction_duration_text=data.get('addiction_duration_text', patient.addiction_profile.addiction_duration_text if patient.addiction_profile else ''),
            )

        if any(field in data for field in ['emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation']):
            patient.emergency_contact = EmergencyContact(
                name=data.get('emergency_contact_name', patient.emergency_contact.name if patient.emergency_contact else ''),
                phone=data.get('emergency_contact_phone', patient.emergency_contact.phone if patient.emergency_contact else ''),
                relation=data.get('emergency_contact_relation', patient.emergency_contact.relation if patient.emergency_contact else ''),
            )

        if any(field in data for field in ['family_history', 'medical_history', 'allergies', 'current_medications', 'previous_treatments']):
            patient.medical_background = MedicalBackground(
                family_history=data.get('family_history', patient.medical_background.family_history if patient.medical_background else ''),
                medical_history=data.get('medical_history', patient.medical_background.medical_history if patient.medical_background else ''),
                allergies=data.get('allergies', patient.medical_background.allergies if patient.medical_background else ''),
                current_medications=data.get('current_medications', patient.medical_background.current_medications if patient.medical_background else ''),
                previous_treatments=data.get('previous_treatments', patient.medical_background.previous_treatments if patient.medical_background else ''),
            )

        for scalar in ['blood_group', 'email', 'aadhaar_number_last4']:
            if scalar in data:
                setattr(patient, scalar, data[scalar])

        patient.general_data_complete = _recalculate_general_data_complete(patient)
        patient.updated_at = datetime.datetime.utcnow()
        patient.save()

        return success_response(serialize_patient(patient))


class GetPatientView(APIView):
    """Return full patient details including current status field."""

    permission_classes = [IsReceptionistOrConsultantOrDoctor]

    def get(self, request, patient_id):
        patient = get_patient_for_hospital(patient_id, get_request_hospital_id(request))
        _mark_fingerprint_reenrollment_if_needed(patient)
        return success_response(serialize_patient(patient))


class PatientLookupView(APIView):
    """Lookup patient by registration number for check-in."""

    permission_classes = [IsReceptionist]

    def get(self, request):
        serializer = PatientLookupSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        query = serializer.validated_data

        hospital_id = get_request_hospital_id(request)
        registration_number = query.get('registration_number', '')
        search_text = query.get('q') or registration_number

        patients = Patient.objects(hospital_id=hospital_id)
        if registration_number:
            patients = patients.filter(registration_number=registration_number)
        else:
            patients = patients.filter(__raw__=_build_lookup_query(search_text))

        items = list(patients.order_by('full_name').limit(20))
        for patient in items:
            _mark_fingerprint_reenrollment_if_needed(patient)

        if not items:
            raise NotFoundError(message='Patient not found.', code='PATIENT_NOT_FOUND')

        return success_response(
            {
                'items': [serialize_patient(patient) for patient in items],
                'total': len(items),
            }
        )


class FingerprintTemplateView(APIView):
    """Return a decrypted fingerprint template for receptionist-only verification."""

    permission_classes = [IsReceptionist]

    def get(self, request, patient_id):
        """
        Return the decrypted template for a selected patient.

        Args:
            request: DRF request.
            patient_id (str): Target patient ObjectId string.

        Returns:
            Response: Decrypted fingerprint template payload.

        Raises:
            NotFoundError: If the patient does not exist.
            HMSError: If the patient must re-enroll or has no decryptable template.
        """
        patient = get_patient_for_hospital(patient_id, get_request_hospital_id(request))

        _mark_fingerprint_reenrollment_if_needed(patient)
        biometric = patient.biometric

        if not biometric or biometric.fingerprint_reenrollment_required:
            raise HMSError(
                code='FINGERPRINT_REENROLLMENT_REQUIRED',
                message='This patient must re-enroll fingerprint biometrics before verification.',
                status_code=409,
            )

        encrypted_template = getattr(biometric, 'fingerprint_template_encrypted', None)
        if not encrypted_template:
            raise HMSError(
                code='FINGERPRINT_TEMPLATE_UNAVAILABLE',
                message='No fingerprint template is available for this patient.',
                status_code=404,
            )

        return success_response({
            'patient_id': str(patient.id),
            'fingerprint_template': decrypt_fingerprint_template(encrypted_template),
            'fingerprint_enrolled_at': biometric.fingerprint_enrolled_at.isoformat() if biometric.fingerprint_enrolled_at else None,
            'fingerprint_template_key_version': biometric.fingerprint_template_key_version,
        })
