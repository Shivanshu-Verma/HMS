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


HOSPITAL_ID = ObjectId(settings.DEFAULT_HOSPITAL_ID)


STAFF_DATA = [
    ('receptionist', 'reception@hms.com', 'reception123', 'Priya Sharma'),
    ('consultant', 'counsellor@hms.com', 'counsellor123', 'Ananya Gupta'),
    ('doctor', 'doctor@hms.com', 'doctor123', 'Dr Rajesh Kumar'),
    ('pharmacy', 'pharmacy@hms.com', 'pharmacy123', 'Vikram Singh'),
]


MEDICINES_DATA = [
    {'name': 'Naltrexone 50mg', 'category': 'addiction', 'unit': 'tablet', 'unit_price': 45.0, 'stock_quantity': 300, 'description': 'Opioid antagonist'},
    {'name': 'Acamprosate 333mg', 'category': 'addiction', 'unit': 'tablet', 'unit_price': 35.0, 'stock_quantity': 250, 'description': 'Alcohol craving management'},
    {'name': 'Paracetamol 650mg', 'category': 'analgesic', 'unit': 'tablet', 'unit_price': 5.0, 'stock_quantity': 500, 'description': 'Pain and fever'},
    {'name': 'Ibuprofen 400mg', 'category': 'analgesic', 'unit': 'tablet', 'unit_price': 7.0, 'stock_quantity': 400, 'description': 'NSAID pain relief'},
    {'name': 'Amoxicillin 500mg', 'category': 'antibiotic', 'unit': 'capsule', 'unit_price': 12.0, 'stock_quantity': 350, 'description': 'Broad spectrum antibiotic'},
    {'name': 'Azithromycin 500mg', 'category': 'antibiotic', 'unit': 'tablet', 'unit_price': 20.0, 'stock_quantity': 280, 'description': 'Macrolide antibiotic'},
]


PATIENTS = [
    {
        'fingerprint_hash': 'seed-fp-active-complete',
        'full_name': 'Ramesh Patel',
        'phone': '9988776655',
        'date_of_birth': datetime.datetime(1985, 3, 15),
        'sex': 'male',
        'status': 'active',
        'outstanding_debt': 0.0,
        'general': True,
    },
    {
        'fingerprint_hash': 'seed-fp-active-debt',
        'full_name': 'Arun Mehta',
        'phone': '9876501234',
        'date_of_birth': datetime.datetime(1990, 7, 22),
        'sex': 'male',
        'status': 'active',
        'outstanding_debt': 650.0,
        'general': True,
    },
    {
        'fingerprint_hash': 'seed-fp-dead',
        'full_name': 'Kavita Sharma',
        'phone': '9876509876',
        'date_of_birth': datetime.datetime(1978, 11, 8),
        'sex': 'female',
        'status': 'dead',
        'outstanding_debt': 0.0,
        'general': True,
    },
    {
        'fingerprint_hash': 'seed-fp-incomplete',
        'full_name': 'Incomplete Profile',
        'phone': '9000000001',
        'date_of_birth': datetime.datetime(1995, 1, 1),
        'sex': 'other',
        'status': 'active',
        'outstanding_debt': 0.0,
        'general': False,
    },
]


class Command(BaseCommand):
    help = 'Seed baseline users, medicines, and patient scenarios for HMS flows.'

    def handle(self, *args, **options):
        self._seed_staff()
        self._seed_medicines()
        self._seed_patients()
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
                category=med['category'],
                unit=med['unit'],
                unit_price=med['unit_price'],
                stock_quantity=med['stock_quantity'],
                manufacturer=med['description'],
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
                biometric__fingerprint_hash_sha256=row['fingerprint_hash'],
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
                    fingerprint_hash_sha256=row['fingerprint_hash'],
                    fingerprint_hash_version='sha256-v1',
                    fingerprint_enrolled_at=now,
                ),
                status=row['status'],
                outstanding_debt=row['outstanding_debt'],
                general_data_complete=row['general'],
                created_by=created_by,
                created_at=now,
                updated_at=now,
            )

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

            patient.save()
