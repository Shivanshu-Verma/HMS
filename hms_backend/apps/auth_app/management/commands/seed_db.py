"""
Management command to seed the database with initial data.

Creates staff accounts, sample medicines, and sample patients.
Idempotent — checks for existing records before inserting.

Usage:
    python manage.py seed_db
"""
import datetime
import uuid

from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from bson import ObjectId
from django.conf import settings

from apps.patients.models import (
    Patient, Medicine, Staff,
    Address, AddictionProfile, EmergencyContact, MedicalBackground, Biometric,
)
from utils.fingerprint import hash_fingerprint


HOSPITAL_ID = ObjectId(settings.DEFAULT_HOSPITAL_ID)


STAFF_DATA = [
    {
        'email': 'reception@hms.com',
        'password': 'reception123',
        'full_name': 'Priya Sharma',
        'role': 'receptionist',
        'phone': '9876543210',
    },
    {
        'email': 'counsellor@hms.com',
        'password': 'counsellor123',
        'full_name': 'Ananya Gupta',
        'role': 'consultant',
        'phone': '9876543211',
    },
    {
        'email': 'doctor@hms.com',
        'password': 'doctor123',
        'full_name': 'Dr. Rajesh Kumar',
        'role': 'doctor',
        'phone': '9876543212',
    },
    {
        'email': 'pharmacy@hms.com',
        'password': 'pharmacy123',
        'full_name': 'Vikram Singh',
        'role': 'pharmacy',
        'phone': '9876543213',
    },
]


MEDICINES_DATA = [
    {
        'name': 'Disulfiram 250mg',
        'generic_name': 'Disulfiram',
        'category': 'Anti-alcohol',
        'manufacturer': 'Sun Pharma',
        'unit': 'tablet',
        'price_per_unit': 15.0,
        'stock_quantity': 500,
        'reorder_level': 100,
    },
    {
        'name': 'Naltrexone 50mg',
        'generic_name': 'Naltrexone Hydrochloride',
        'category': 'Opioid Antagonist',
        'manufacturer': 'Cipla',
        'unit': 'tablet',
        'price_per_unit': 45.0,
        'stock_quantity': 300,
        'reorder_level': 50,
    },
    {
        'name': 'Acamprosate 333mg',
        'generic_name': 'Acamprosate Calcium',
        'category': 'Anti-craving',
        'manufacturer': 'Dr. Reddy\'s',
        'unit': 'tablet',
        'price_per_unit': 25.0,
        'stock_quantity': 400,
        'reorder_level': 75,
    },
    {
        'name': 'Lorazepam 2mg',
        'generic_name': 'Lorazepam',
        'category': 'Benzodiazepine',
        'manufacturer': 'Intas',
        'unit': 'tablet',
        'price_per_unit': 8.0,
        'stock_quantity': 200,
        'reorder_level': 50,
    },
    {
        'name': 'Thiamine 100mg',
        'generic_name': 'Vitamin B1',
        'category': 'Vitamin',
        'manufacturer': 'Abbott',
        'unit': 'tablet',
        'price_per_unit': 5.0,
        'stock_quantity': 1000,
        'reorder_level': 200,
    },
    {
        'name': 'Nicotine Patch 21mg',
        'generic_name': 'Nicotine',
        'category': 'Nicotine Replacement',
        'manufacturer': 'GSK',
        'unit': 'tablet',
        'price_per_unit': 120.0,
        'stock_quantity': 150,
        'reorder_level': 30,
    },
    {
        'name': 'Buprenorphine 8mg',
        'generic_name': 'Buprenorphine',
        'category': 'Opioid Agonist',
        'manufacturer': 'Rusan Pharma',
        'unit': 'tablet',
        'price_per_unit': 55.0,
        'stock_quantity': 200,
        'reorder_level': 40,
    },
    {
        'name': 'Chlordiazepoxide Syrup',
        'generic_name': 'Chlordiazepoxide',
        'category': 'Anxiolytic',
        'manufacturer': 'Zydus',
        'unit': 'syrup',
        'price_per_unit': 85.0,
        'stock_quantity': 100,
        'reorder_level': 20,
    },
]


PATIENTS_DATA = [
    {
        'full_name': 'Ramesh Patel',
        'date_of_birth': datetime.datetime(1985, 3, 15),
        'gender': 'male',
        'blood_group': 'O+',
        'phone': '9988776655',
        'address': {'line1': '123, MG Road', 'city': 'Mumbai', 'state': 'Maharashtra', 'pincode': '400001'},
        'addiction_type': 'alcohol',
        'addiction_duration_text': '5 years',
        'emergency_contact': {'name': 'Sunita Patel', 'phone': '9988776644', 'relation': 'Wife'},
        'allergies': 'Penicillin',
        'medical_history': 'Hypertension',
        'fingerprint_data': 'SEED_FP_RAMESH_001',
    },
    {
        'full_name': 'Arun Mehta',
        'date_of_birth': datetime.datetime(1990, 7, 22),
        'gender': 'male',
        'blood_group': 'B+',
        'phone': '9876501234',
        'address': {'line1': '45, Park Street', 'city': 'Delhi', 'state': 'Delhi', 'pincode': '110001'},
        'addiction_type': 'drugs',
        'addiction_duration_text': '3 years',
        'emergency_contact': {'name': 'Priya Mehta', 'phone': '9876501235', 'relation': 'Mother'},
        'allergies': '',
        'medical_history': 'None',
        'fingerprint_data': 'SEED_FP_ARUN_002',
    },
    {
        'full_name': 'Kavita Sharma',
        'date_of_birth': datetime.datetime(1978, 11, 8),
        'gender': 'female',
        'blood_group': 'A-',
        'phone': '9876509876',
        'address': {'line1': '78, Lake View', 'city': 'Pune', 'state': 'Maharashtra', 'pincode': '411001'},
        'addiction_type': 'tobacco',
        'addiction_duration_text': '10 years',
        'emergency_contact': {'name': 'Suresh Sharma', 'phone': '9876509877', 'relation': 'Husband'},
        'allergies': 'Sulfa drugs',
        'medical_history': 'Asthma, Diabetes Type 2',
        'fingerprint_data': 'SEED_FP_KAVITA_003',
    },
]


class Command(BaseCommand):
    help = 'Seed the database with initial staff, medicines, and patients.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== HMS Database Seeder ===\n'))

        self._seed_staff()
        self._seed_medicines()
        self._seed_patients()

        self.stdout.write(self.style.SUCCESS('\n✓ Seeding complete!\n'))
        self._print_credentials()

    def _seed_staff(self):
        """Create staff accounts if they don't exist."""
        self.stdout.write('Seeding staff accounts...')

        for data in STAFF_DATA:
            existing = Staff.objects(hospital_id=HOSPITAL_ID, email=data['email']).first()
            if existing:
                self.stdout.write(f"  → {data['email']} already exists, skipping.")
                continue

            now = datetime.datetime.utcnow()
            staff = Staff(
                hospital_id=HOSPITAL_ID,
                staff_uid=f"STF-{uuid.uuid4().hex[:8].upper()}",
                email=data['email'],
                password_hash=make_password(data['password']),
                full_name=data['full_name'],
                role=data['role'],
                phone=data['phone'],
                is_active=True,
                created_at=now,
                updated_at=now,
            )
            staff.save()
            self.stdout.write(self.style.SUCCESS(f"  ✓ Created {data['role']}: {data['email']}"))

    def _seed_medicines(self):
        """Create medicines if they don't exist."""
        self.stdout.write('Seeding medicines...')

        # Get pharmacist for created_by
        pharmacist = Staff.objects(hospital_id=HOSPITAL_ID, role='pharmacy').first()
        created_by = pharmacist.id if pharmacist else ObjectId()

        for data in MEDICINES_DATA:
            existing = Medicine.objects(hospital_id=HOSPITAL_ID, name=data['name']).first()
            if existing:
                self.stdout.write(f"  → {data['name']} already exists, skipping.")
                continue

            now = datetime.datetime.utcnow()
            medicine = Medicine(
                hospital_id=HOSPITAL_ID,
                medicine_uid=f"MED-{uuid.uuid4().hex[:8].upper()}",
                name=data['name'],
                generic_name=data.get('generic_name'),
                category=data.get('category'),
                manufacturer=data.get('manufacturer'),
                unit=data['unit'],
                price_per_unit=data['price_per_unit'],
                stock_quantity=data['stock_quantity'],
                reorder_level=data['reorder_level'],
                is_active=True,
                created_by=created_by,
                created_at=now,
                updated_at=now,
            )
            medicine.save()
            self.stdout.write(self.style.SUCCESS(f"  ✓ Created medicine: {data['name']}"))

    def _seed_patients(self):
        """Create sample patients if they don't exist."""
        self.stdout.write('Seeding patients...')

        # Get receptionist for created_by
        receptionist = Staff.objects(hospital_id=HOSPITAL_ID, role='receptionist').first()
        created_by = receptionist.id if receptionist else ObjectId()

        for data in PATIENTS_DATA:
            fp_hash = hash_fingerprint(data['fingerprint_data'])
            existing = Patient.objects(
                hospital_id=HOSPITAL_ID,
                biometric__fingerprint_hash_sha256=fp_hash,
            ).first()
            if existing:
                self.stdout.write(f"  → {data['full_name']} already exists, skipping.")
                continue

            now = datetime.datetime.utcnow()
            date_part = now.strftime('%Y%m%d')
            rand_part = uuid.uuid4().hex[:4].upper()

            patient = Patient(
                hospital_id=HOSPITAL_ID,
                patient_uid=f"PID-{uuid.uuid4().hex[:12].upper()}",
                registration_number=f"PAT-{date_part}-{rand_part}",
                full_name=data['full_name'],
                date_of_birth=data['date_of_birth'],
                gender=data['gender'],
                blood_group=data.get('blood_group'),
                phone=data['phone'],
                address=Address(**data['address']),
                addiction_profile=AddictionProfile(
                    addiction_type=data['addiction_type'],
                    addiction_duration_text=data.get('addiction_duration_text'),
                ),
                emergency_contact=EmergencyContact(**data['emergency_contact']),
                medical_background=MedicalBackground(
                    allergies=data.get('allergies'),
                    medical_history=data.get('medical_history'),
                ),
                biometric=Biometric(
                    fingerprint_hash_sha256=fp_hash,
                    fingerprint_hash_version='sha256-v1',
                    fingerprint_enrolled_at=now,
                ),
                status='active',
                created_by=created_by,
                created_at=now,
                updated_at=now,
            )
            patient.save()
            self.stdout.write(self.style.SUCCESS(f"  ✓ Created patient: {data['full_name']}"))

    def _print_credentials(self):
        """Print a formatted table of login credentials."""
        self.stdout.write(self.style.MIGRATE_HEADING('\n--- Login Credentials ---'))
        self.stdout.write(f"{'Role':<15} {'Email':<25} {'Password':<15}")
        self.stdout.write(f"{'─' * 15} {'─' * 25} {'─' * 15}")
        for data in STAFF_DATA:
            self.stdout.write(f"{data['role']:<15} {data['email']:<25} {data['password']:<15}")
        self.stdout.write('')
