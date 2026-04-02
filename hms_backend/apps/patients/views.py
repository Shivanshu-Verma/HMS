"""Patient module endpoints for registration, lookup, and profile updates."""
import datetime
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
from utils.exceptions import NotFoundError
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
                fingerprint_hash_sha256=data['fingerprint_hash'],
                fingerprint_hash_version='sha256-v1',
                fingerprint_enrolled_at=now,
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

        try:
            patient = Patient.objects.get(id=ObjectId(patient_id))
        except Patient.DoesNotExist:
            raise NotFoundError(message='Patient not found.', code='PATIENT_NOT_FOUND')

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
        try:
            patient = Patient.objects.get(id=ObjectId(patient_id))
        except Patient.DoesNotExist:
            raise NotFoundError(message='Patient not found.', code='PATIENT_NOT_FOUND')
        return success_response(serialize_patient(patient))


class PatientLookupView(APIView):
    """Lookup patient by registration number or fingerprint hash for check-in."""

    permission_classes = [IsReceptionist]

    def get(self, request):
        serializer = PatientLookupSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        query = serializer.validated_data

        hospital_id = ObjectId(request.user.hospital_id)

        patient = None
        if query.get('registration_number'):
            patient = Patient.objects(
                hospital_id=hospital_id,
                registration_number=query['registration_number'],
            ).first()
        elif query.get('fingerprint_hash'):
            patient = Patient.objects(
                hospital_id=hospital_id,
                biometric__fingerprint_hash_sha256=query['fingerprint_hash'],
            ).first()

        if not patient:
            raise NotFoundError(message='Patient not found.', code='PATIENT_NOT_FOUND')

        return success_response(serialize_patient(patient))
