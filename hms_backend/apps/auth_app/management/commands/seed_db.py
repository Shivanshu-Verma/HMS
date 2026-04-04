"""Idempotent seed command for staff, medicines, and scenario-ready patients."""
import datetime
import uuid

from bson import ObjectId
from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand

from apps.patients.models import (
    Address,
    AddictionProfile,
    Biometric,
    EmergencyContact,
    MedicalBackground,
    Medicine,
    Patient,
    Staff,
)
from apps.sessions.models import ActiveSession
from utils.fingerprint import encrypt_fingerprint_template


HOSPITAL_ID = ObjectId(settings.DEFAULT_HOSPITAL_ID)


STAFF_DATA = [
    ('receptionist', 'reception@hms.com', 'reception123', 'Priya Sharma'),
    ('consultant', 'counsellor@hms.com', 'counsellor123', 'Ananya Gupta'),
    ('doctor', 'doctor@hms.com', 'doctor123', 'Dr Rajesh Kumar'),
    ('pharmacy', 'pharmacy@hms.com', 'pharmacy123', 'Vikram Singh'),
]


MEDICINES_DATA = [
    {'name': 'Naltrexone 50mg', 'category': 'addiction', 'unit': 'tablet', 'unit_price': 45.0, 'stock_quantity': 300, 'manufacturer': 'Sun Pharma', 'generic_name': 'Naltrexone'},
    {'name': 'Acamprosate 333mg', 'category': 'addiction', 'unit': 'tablet', 'unit_price': 35.0, 'stock_quantity': 250, 'manufacturer': 'Cipla Ltd', 'generic_name': 'Acamprosate Calcium'},
    {'name': 'Paracetamol 650mg', 'category': 'analgesic', 'unit': 'tablet', 'unit_price': 5.0, 'stock_quantity': 500, 'manufacturer': 'GSK Pharma', 'generic_name': 'Paracetamol'},
    {'name': 'Ibuprofen 400mg', 'category': 'analgesic', 'unit': 'tablet', 'unit_price': 7.0, 'stock_quantity': 400, 'manufacturer': 'Abbott India', 'generic_name': 'Ibuprofen'},
    {'name': 'Amoxicillin 500mg', 'category': 'antibiotic', 'unit': 'capsule', 'unit_price': 12.0, 'stock_quantity': 350, 'manufacturer': 'Alkem Labs', 'generic_name': 'Amoxicillin'},
    {'name': 'Azithromycin 500mg', 'category': 'antibiotic', 'unit': 'tablet', 'unit_price': 20.0, 'stock_quantity': 280, 'manufacturer': 'Zydus Cadila', 'generic_name': 'Azithromycin'},
]


PATIENTS = [
    {
        'fingerprint_template': 'seed-fp-active-complete',
        'full_name': 'Ramesh Patel',
        'phone': '9988776655',
        'date_of_birth': datetime.datetime(1985, 3, 15),
        'sex': 'male',
        'status': 'active',
        'outstanding_debt': 0.0,
        'general': True,
        'patient_category': 'deaddiction',
        'aadhaar_last4': '4321',
    },
    {
        'fingerprint_template': 'seed-fp-active-debt',
        'full_name': 'Arun Mehta',
        'phone': '9876501234',
        'date_of_birth': datetime.datetime(1990, 7, 22),
        'sex': 'male',
        'status': 'active',
        'outstanding_debt': 650.0,
        'general': True,
        'patient_category': 'deaddiction',
        'aadhaar_last4': '8765',
    },
    {
        'fingerprint_template': 'seed-fp-dead',
        'full_name': 'Kavita Sharma',
        'phone': '9876509876',
        'date_of_birth': datetime.datetime(1978, 11, 8),
        'sex': 'female',
        'status': 'dead',
        'outstanding_debt': 0.0,
        'general': True,
        'patient_category': 'psychiatric',
        'aadhaar_last4': '1234',
    },
    {
        'fingerprint_template': 'seed-fp-incomplete',
        'full_name': 'Incomplete Profile',
        'phone': '9000000001',
        'date_of_birth': datetime.datetime(1995, 1, 1),
        'sex': 'other',
        'status': 'active',
        'outstanding_debt': 0.0,
        'general': False,
        'patient_category': None,
        'aadhaar_last4': None,
    },
]


class Command(BaseCommand):
    help = 'Seed baseline users, medicines, and patient scenarios for HMS flows.'

    def handle(self, *args, **options):
        self._seed_staff()
        self._seed_medicines()
        self._seed_patients()
        self._seed_active_session()
        self.stdout.write(self.style.SUCCESS('seed_db completed successfully.'))

    def _seed_staff(self):
        for role, email, password, full_name in STAFF_DATA:
            existing = Staff.objects(hospital_id=HOSPITAL_ID, email=email).first()
            if existing:
                continue
            now = datetime.datetime.utcnow()
            Staff(
                hospital_id=HOSPITAL_ID,
                staff_uid=f"STF-{uuid.uuid4().hex[:8].upper()}",
                email=email,
                password_hash=make_password(password),
                full_name=full_name,
                role=role,
                is_active=True,
                created_at=now,
                updated_at=now,
            ).save()

    def _seed_medicines(self):
        pharmacist = Staff.objects(hospital_id=HOSPITAL_ID, role='pharmacy').first()
        created_by = pharmacist.id if pharmacist else ObjectId()

        for med in MEDICINES_DATA:
            existing = Medicine.objects(hospital_id=HOSPITAL_ID, name=med['name']).first()
            if existing:
                continue
            now = datetime.datetime.utcnow()
            Medicine(
                hospital_id=HOSPITAL_ID,
                medicine_uid=f"MED-{uuid.uuid4().hex[:8].upper()}",
                name=med['name'],
                generic_name=med.get('generic_name', ''),
                category=med['category'],
                unit=med['unit'],
                unit_price=med['unit_price'],
                stock_quantity=med['stock_quantity'],
                manufacturer=med.get('manufacturer', ''),
                reorder_level=20,
                is_active=True,
                created_by=created_by,
                created_at=now,
                updated_at=now,
            ).save()

    def _seed_patients(self):
        receptionist = Staff.objects(hospital_id=HOSPITAL_ID, role='receptionist').first()
        created_by = receptionist.id if receptionist else ObjectId()

        for index, row in enumerate(PATIENTS, start=1):
            existing = Patient.objects(
                hospital_id=HOSPITAL_ID,
                full_name=row['full_name'],
                phone=row['phone'],
            ).first()
            if existing:
                continue

            now = datetime.datetime.utcnow()
            patient = Patient(
                hospital_id=HOSPITAL_ID,
                patient_uid=f"PID-{uuid.uuid4().hex[:12].upper()}",
                registration_number=f"PAT-{now.strftime('%Y%m%d')}-{index:04d}",
                full_name=row['full_name'],
                phone=row['phone'],
                date_of_birth=row['date_of_birth'],
                gender=row['sex'],
                biometric=Biometric(
                    fingerprint_template_encrypted=encrypt_fingerprint_template(row['fingerprint_template']),
                    fingerprint_template_key_version=settings.FINGERPRINT_TEMPLATE_KEY_VERSION,
                    fingerprint_enrolled_at=now,
                    fingerprint_reenrollment_required=False,
                ),
                status=row['status'],
                outstanding_debt=row['outstanding_debt'],
                general_data_complete=row['general'],
                visit_count=0,
                created_by=created_by,
                created_at=now,
                updated_at=now,
            )

            if row.get('patient_category'):
                patient.patient_category = row['patient_category']

            if row['general']:
                patient.address = Address(
                    line1='Seed Address',
                    city='Mumbai',
                    state='Maharashtra',
                    pincode='400001',
                )
                patient.addiction_profile = AddictionProfile(addiction_type='alcohol', addiction_duration_text='2 years')
                patient.emergency_contact = EmergencyContact(name='Family Contact', phone='9111111111', relation='Sibling')
                patient.medical_background = MedicalBackground(
                    family_history='No known family history',
                    medical_history='No major condition',
                    allergies='None',
                    current_medications='None',
                    previous_treatments='None',
                )
                patient.email = f"seed{index}@example.com"
                patient.blood_group = 'O+'
                if row.get('aadhaar_last4'):
                    patient.aadhaar_number_last4 = row['aadhaar_last4']

            patient.save()

    def _seed_active_session(self):
        """Seed one active session so the receptionist/consultant flow can be tested."""
        # Find the first active, complete patient with no outstanding debt
        patient = Patient.objects(
            hospital_id=HOSPITAL_ID,
            full_name='Ramesh Patel',
            phone='9988776655',
        ).first()

        if not patient:
            self.stdout.write(self.style.WARNING('Skipping active session seed — patient not found.'))
            return

        # Don't duplicate if this patient already has an active session
        existing = ActiveSession.objects(patient_id=patient.id).first()
        if existing:
            return

        receptionist = Staff.objects(hospital_id=HOSPITAL_ID, role='receptionist').first()
        if not receptionist:
            self.stdout.write(self.style.WARNING('Skipping active session seed — receptionist not found.'))
            return

        now = datetime.datetime.utcnow()
        ActiveSession(
            hospital_id=HOSPITAL_ID,
            patient_id=patient.id,
            patient_name=patient.full_name,
            checked_in_by=receptionist.id,
            checked_in_by_name=receptionist.full_name,
            checked_in_at=now,
            status='checked_in',
            outstanding_debt_at_checkin=patient.outstanding_debt,
            created_at=now,
            updated_at=now,
        ).save()
