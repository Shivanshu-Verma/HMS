"""
MongoEngine document definitions for the hms_archive database.

Contains all permanent data models: Patient, Visit, Staff, Medicine,
InventoryTransaction, and AuthRefreshToken. Each document maps to a
collection in the hms_archive database.
"""
import datetime
from mongoengine import (
    Document, EmbeddedDocument, EmbeddedDocumentField, StringField,
    ObjectIdField, DateTimeField, DateField, IntField, FloatField,
    BooleanField, ListField, EmailField, DictField,
)
from bson import ObjectId


# ---------------------------------------------------------------------------
# Embedded Documents
# ---------------------------------------------------------------------------

class Address(EmbeddedDocument):
    """Patient address — always read together with the patient profile."""

    line1 = StringField(required=True)
    city = StringField(required=True)
    state = StringField(required=True)
    pincode = StringField(required=True)


class AddictionProfile(EmbeddedDocument):
    """Primary addiction condition for the patient."""

    ADDICTION_TYPES = ('alcohol', 'drugs', 'tobacco', 'gambling', 'other')

    addiction_type = StringField(required=True, choices=ADDICTION_TYPES)
    addiction_duration_text = StringField()


class EmergencyContact(EmbeddedDocument):
    """Emergency contact person for the patient."""

    name = StringField(required=True)
    phone = StringField(required=True)
    relation = StringField(required=True)


class MedicalBackground(EmbeddedDocument):
    """Optional medical history details for the patient."""

    family_history = StringField()
    medical_history = StringField()
    allergies = StringField()
    current_medications = StringField()
    previous_treatments = StringField()


class Biometric(EmbeddedDocument):
    """Biometric fingerprint metadata — stores only the SHA-256 hash, never raw data."""

    fingerprint_hash_sha256 = StringField(required=True)
    fingerprint_hash_version = StringField(required=True, default='sha256-v1')
    fingerprint_enrolled_at = DateTimeField(required=True)


# ---------------------------------------------------------------------------
# Visit embedded sub-documents
# ---------------------------------------------------------------------------

class PatientSnapshot(EmbeddedDocument):
    """
    Point-in-time snapshot of patient demographics.

    Embedded in both active sessions and archived visits to preserve
    historical consistency if patient demographics later change.
    """

    patient_uid = StringField(required=True)
    registration_number = StringField(required=True)
    full_name = StringField(required=True)
    gender = StringField()
    date_of_birth = DateTimeField()
    addiction_type = StringField()
    phone = StringField()
    allergies = StringField()
    medical_history = StringField()


class VisitLifecycle(EmbeddedDocument):
    """Lifecycle timestamps and status for an archived visit."""

    STATUS_CHOICES = ('completed', 'cancelled')
    STAGE_CHOICES = ('completed',)

    status = StringField(required=True, choices=STATUS_CHOICES)
    current_stage = StringField(required=True, choices=STAGE_CHOICES)
    checkin_at = DateTimeField()
    counsellor_started_at = DateTimeField()
    counsellor_completed_at = DateTimeField()
    doctor_started_at = DateTimeField()
    doctor_completed_at = DateTimeField()
    pharmacy_started_at = DateTimeField()
    pharmacy_completed_at = DateTimeField()
    completed_at = DateTimeField(required=True)


class VisitAssignments(EmbeddedDocument):
    """Staff assignments for a visit."""

    receptionist_id = ObjectIdField()
    counsellor_id = ObjectIdField(required=True)
    doctor_id = ObjectIdField(required=True)
    pharmacist_id = ObjectIdField(required=True)


class CounsellorStage(EmbeddedDocument):
    """Counsellor session data for an archived visit."""

    session_notes = StringField(required=True)
    mood_assessment = IntField()
    risk_level = StringField(required=True, choices=('low', 'medium', 'high'))
    recommendations = StringField()
    follow_up_required = BooleanField(required=True)
    session_duration_minutes = IntField()
    created_at = DateTimeField(required=True)


class VitalSigns(EmbeddedDocument):
    """Vital signs recorded during doctor examination."""

    blood_pressure = StringField()
    pulse = IntField()
    weight_kg = FloatField()
    temperature_f = FloatField()


class DoctorStage(EmbeddedDocument):
    """Doctor examination data for an archived visit."""

    diagnosis = StringField(required=True)
    treatment_plan = StringField()
    clinical_notes = StringField()
    vital_signs = EmbeddedDocumentField(VitalSigns)
    next_visit_date = DateTimeField()
    created_at = DateTimeField(required=True)


class MedicineSnapshot(EmbeddedDocument):
    """Point-in-time snapshot of medicine details for a prescription item."""

    name = StringField(required=True)
    generic_name = StringField()
    unit = StringField()
    category = StringField()


class PrescriptionItem(EmbeddedDocument):
    """Single prescription line item in an archived visit."""

    prescription_item_id = ObjectIdField(default=ObjectId)
    medicine_id = ObjectIdField(required=True)
    medicine_snapshot = EmbeddedDocumentField(MedicineSnapshot, required=True)
    dosage = StringField(required=True)
    frequency = StringField(required=True, choices=('once_daily', 'twice_daily', 'thrice_daily', 'as_needed'))
    duration_days = IntField(required=True)
    quantity_prescribed = IntField(required=True)
    instructions = StringField()
    dispensed = BooleanField(default=False)
    quantity_dispensed = IntField(default=0)
    dispensed_at = DateTimeField()


class StockDeduction(EmbeddedDocument):
    """Record of stock change for a single medicine during pharmacy dispensing."""

    medicine_id = ObjectIdField(required=True)
    quantity_out = IntField(required=True)
    stock_before = IntField(required=True)
    stock_after = IntField(required=True)


class PharmacyStage(EmbeddedDocument):
    """Pharmacy dispensing data for an archived visit."""

    dispensed_items_count = IntField(required=True)
    stock_deductions = ListField(EmbeddedDocumentField(StockDeduction))
    dispensing_notes = StringField()
    created_at = DateTimeField()


class VisitAudit(EmbeddedDocument):
    """Audit trail for the archive operation."""

    archived_from_active_session_id = ObjectIdField(required=True)
    archived_by = ObjectIdField(required=True)
    archive_txn_id = StringField()
    version = IntField(required=True, default=1)


# ---------------------------------------------------------------------------
# Top-level Documents (hms_archive)
# ---------------------------------------------------------------------------

class Patient(Document):
    """
    Master patient registry and longitudinal identity record.

    Stored in hms_archive. Contains full demographics, biometric metadata,
    addiction profile, emergency contact, and references to visit IDs.
    """

    hospital_id = ObjectIdField(required=True)
    patient_uid = StringField(required=True)
    registration_number = StringField(required=True)
    full_name = StringField(required=True)
    date_of_birth = DateTimeField(required=True)
    gender = StringField(required=True, choices=('male', 'female', 'other'))
    blood_group = StringField()
    phone = StringField(required=True)
    email = StringField()
    address = EmbeddedDocumentField(Address, required=True)
    aadhaar_number_last4 = StringField()
    addiction_profile = EmbeddedDocumentField(AddictionProfile, required=True)
    emergency_contact = EmbeddedDocumentField(EmergencyContact, required=True)
    medical_background = EmbeddedDocumentField(MedicalBackground)
    biometric = EmbeddedDocumentField(Biometric, required=True)
    status = StringField(required=True, default='active', choices=('active', 'discharged', 'follow_up'))
    visit_ids = ListField(ObjectIdField(), default=list)
    visit_count = IntField(required=True, default=0)
    last_visit_at = DateTimeField()
    created_by = ObjectIdField(required=True)
    created_at = DateTimeField(required=True, default=datetime.datetime.utcnow)
    updated_at = DateTimeField(required=True, default=datetime.datetime.utcnow)

    meta = {
        'db_alias': 'archive',
        'collection': 'patients',
        'indexes': [
            {'fields': ['hospital_id', 'patient_uid'], 'unique': True},
            {'fields': ['hospital_id', 'registration_number'], 'unique': True},
            {'fields': ['hospital_id', 'biometric.fingerprint_hash_sha256'], 'unique': True, 'sparse': True},
            {'fields': ['hospital_id', 'phone']},
            {'fields': ['hospital_id', 'status', '-updated_at']},
            {
                'fields': ['$full_name', '$registration_number', '$phone'],
                'default_language': 'english',
            },
            {'fields': ['created_at']},
            {'fields': ['-updated_at']},
        ],
    }


class Visit(Document):
    """
    Immutable archived completed visit record.

    Source of truth for all historical visit data. Embeds complete stage
    outputs, prescription snapshots, and audit trail.
    """

    hospital_id = ObjectIdField(required=True)
    visit_uid = StringField(required=True)
    patient_id = ObjectIdField(required=True)
    patient_snapshot = EmbeddedDocumentField(PatientSnapshot, required=True)
    visit_number = IntField(required=True)
    visit_date = DateTimeField(required=True)
    lifecycle = EmbeddedDocumentField(VisitLifecycle, required=True)
    assignments = EmbeddedDocumentField(VisitAssignments, required=True)
    counsellor_stage = EmbeddedDocumentField(CounsellorStage, required=True)
    doctor_stage = EmbeddedDocumentField(DoctorStage, required=True)
    prescription_items = ListField(EmbeddedDocumentField(PrescriptionItem), default=list)
    pharmacy_stage = EmbeddedDocumentField(PharmacyStage, required=True)
    audit = EmbeddedDocumentField(VisitAudit, required=True)
    created_at = DateTimeField(required=True, default=datetime.datetime.utcnow)

    meta = {
        'db_alias': 'archive',
        'collection': 'visits',
        'indexes': [
            {'fields': ['hospital_id', 'visit_uid'], 'unique': True},
            {'fields': ['hospital_id', 'patient_id', 'visit_number'], 'unique': True},
            {'fields': ['hospital_id', 'patient_id', '-visit_date']},
            {'fields': ['hospital_id', 'assignments.counsellor_id', '-lifecycle.completed_at']},
            {'fields': ['hospital_id', 'assignments.doctor_id', '-lifecycle.completed_at']},
            {'fields': ['hospital_id', 'assignments.pharmacist_id', '-lifecycle.completed_at']},
            {'fields': ['hospital_id', '-lifecycle.completed_at']},
            {
                'fields': ['$doctor_stage.diagnosis', '$counsellor_stage.session_notes'],
                'default_language': 'english',
            },
        ],
    }


class Staff(Document):
    """
    Staff identity, role, and authentication profile.

    Stored in hms_archive. Used for login, role-based access, and
    assignment references across visits and sessions.
    """

    ROLE_CHOICES = ('receptionist', 'consultant', 'doctor', 'pharmacy')

    hospital_id = ObjectIdField(required=True)
    staff_uid = StringField(required=True)
    email = StringField(required=True)
    password_hash = StringField(required=True)
    full_name = StringField(required=True)
    role = StringField(required=True, choices=ROLE_CHOICES)
    phone = StringField()
    is_active = BooleanField(required=True, default=True)
    last_login_at = DateTimeField()
    created_at = DateTimeField(required=True, default=datetime.datetime.utcnow)
    updated_at = DateTimeField(required=True, default=datetime.datetime.utcnow)

    meta = {
        'db_alias': 'archive',
        'collection': 'staff',
        'indexes': [
            {'fields': ['hospital_id', 'email'], 'unique': True},
            {'fields': ['hospital_id', 'staff_uid'], 'unique': True},
            {'fields': ['hospital_id', 'role', 'is_active']},
            {
                'fields': ['$full_name'],
                'default_language': 'english',
            },
        ],
    }


class Medicine(Document):
    """
    Master medicine catalog with current stock levels.

    Stored in hms_archive. Referenced from prescriptions in both
    active sessions and archived visits.
    """

    UNIT_CHOICES = ('tablet', 'capsule', 'ml', 'mg', 'syrup', 'injection')

    hospital_id = ObjectIdField(required=True)
    medicine_uid = StringField(required=True)
    name = StringField(required=True)
    generic_name = StringField()
    category = StringField()
    manufacturer = StringField()
    unit = StringField(required=True, choices=UNIT_CHOICES)
    price_per_unit = FloatField(required=True)
    stock_quantity = IntField(required=True, default=0)
    reorder_level = IntField(required=True)
    expiry_date = DateTimeField()
    is_active = BooleanField(required=True, default=True)
    created_by = ObjectIdField(required=True)
    created_at = DateTimeField(required=True, default=datetime.datetime.utcnow)
    updated_at = DateTimeField(required=True, default=datetime.datetime.utcnow)

    meta = {
        'db_alias': 'archive',
        'collection': 'medicines',
        'indexes': [
            {'fields': ['hospital_id', 'medicine_uid'], 'unique': True},
            {'fields': ['hospital_id', 'is_active', 'stock_quantity']},
            {'fields': ['hospital_id', 'category', 'is_active']},
            {
                'fields': ['$name', '$generic_name'],
                'default_language': 'english',
            },
            {'fields': ['hospital_id', 'expiry_date']},
        ],
    }


class InventoryTransaction(Document):
    """
    Immutable inventory ledger entry for stock in/out.

    Stored in hms_archive. Every stock change creates a new transaction
    document for full auditability.
    """

    TRANSACTION_TYPES = ('in', 'out', 'adjustment')
    REFERENCE_TYPES = ('dispense', 'stock_update', 'manual')

    hospital_id = ObjectIdField(required=True)
    medicine_id = ObjectIdField(required=True)
    transaction_type = StringField(required=True, choices=TRANSACTION_TYPES)
    quantity = IntField(required=True)
    stock_before = IntField(required=True)
    stock_after = IntField(required=True)
    reference_type = StringField(required=True, choices=REFERENCE_TYPES)
    reference_id = ObjectIdField()
    performed_by = ObjectIdField(required=True)
    notes = StringField()
    created_at = DateTimeField(required=True, default=datetime.datetime.utcnow)

    meta = {
        'db_alias': 'archive',
        'collection': 'inventory_transactions',
        'indexes': [
            {'fields': ['hospital_id', 'medicine_id', '-created_at']},
            {'fields': ['hospital_id', 'reference_type', 'reference_id']},
            {'fields': ['hospital_id', 'performed_by', '-created_at']},
        ],
    }


class AuthRefreshToken(Document):
    """
    Refresh token session store for rotation and revocation.

    Stored in hms_archive. TTL index on expires_at auto-cleans expired tokens.
    """

    hospital_id = ObjectIdField(required=True)
    staff_id = ObjectIdField(required=True)
    token_jti = StringField(required=True, unique=True)
    token_hash = StringField(required=True)
    user_agent = StringField()
    ip_address = StringField()
    expires_at = DateTimeField(required=True)
    revoked_at = DateTimeField()
    created_at = DateTimeField(required=True, default=datetime.datetime.utcnow)

    meta = {
        'db_alias': 'archive',
        'collection': 'auth_refresh_tokens',
        'indexes': [
            {'fields': ['token_jti'], 'unique': True},
            {'fields': ['expires_at'], 'expireAfterSeconds': 0},
            {'fields': ['staff_id', 'revoked_at', 'expires_at']},
        ],
    }
