"""
MongoEngine document definitions for the hms_active database.

Contains all in-progress data models: ActiveSession, ActiveLock, and
AuthBlacklist. These represent transient state that is either archived
or auto-cleaned via TTL indexes.
"""
import datetime
from mongoengine import (
    Document, EmbeddedDocument, EmbeddedDocumentField, StringField,
    ObjectIdField, DateTimeField, IntField, FloatField,
    BooleanField, ListField,
)
from bson import ObjectId


# ---------------------------------------------------------------------------
# Embedded Documents for ActiveSession
# ---------------------------------------------------------------------------

class ActivePatientSnapshot(EmbeddedDocument):
    """
    Lightweight patient snapshot for queue/context pages.

    Avoids repeated joins back to the patient master record for every
    queue render.
    """

    patient_uid = StringField(required=True)
    registration_number = StringField(required=True)
    full_name = StringField(required=True)
    date_of_birth = DateTimeField()
    gender = StringField()
    phone = StringField()
    addiction_type = StringField()
    allergies = StringField()
    medical_history = StringField()


class SessionState(EmbeddedDocument):
    """Current stage and status of an active session."""

    STAGE_CHOICES = ('counsellor', 'doctor', 'pharmacy')
    STAGE_STATUS_CHOICES = ('waiting', 'in_progress', 'ready_for_next')
    STATUS_CHOICES = ('in_progress', 'cancelled')

    current_stage = StringField(required=True, choices=STAGE_CHOICES)
    stage_status = StringField(required=True, choices=STAGE_STATUS_CHOICES, default='waiting')
    status = StringField(required=True, choices=STATUS_CHOICES, default='in_progress')


class SessionAssignments(EmbeddedDocument):
    """Staff assignments for an active session."""

    receptionist_id = ObjectIdField(required=True)
    counsellor_id = ObjectIdField()
    doctor_id = ObjectIdField()
    pharmacist_id = ObjectIdField()


class SessionTimestamps(EmbeddedDocument):
    """Lifecycle timestamps for stage transitions."""

    checkin_at = DateTimeField(required=True)
    counsellor_started_at = DateTimeField()
    counsellor_completed_at = DateTimeField()
    doctor_started_at = DateTimeField()
    doctor_completed_at = DateTimeField()
    pharmacy_started_at = DateTimeField()
    updated_at = DateTimeField(required=True, default=datetime.datetime.utcnow)


class ActiveCounsellorStage(EmbeddedDocument):
    """Counsellor session data in an active session."""

    session_notes = StringField()
    mood_assessment = IntField()
    risk_level = StringField(choices=('low', 'medium', 'high'))
    recommendations = StringField()
    follow_up_required = BooleanField()
    session_duration_minutes = IntField()
    completed_by = ObjectIdField()
    completed_at = DateTimeField()


class ActiveVitalSigns(EmbeddedDocument):
    """Vital signs in an active session."""

    blood_pressure = StringField()
    pulse = IntField()
    weight_kg = FloatField()
    temperature_f = FloatField()


class ActivePrescriptionDraft(EmbeddedDocument):
    """Draft prescription item in the doctor stage."""

    draft_item_id = ObjectIdField(default=ObjectId)
    medicine_id = ObjectIdField(required=True)
    dosage = StringField(required=True)
    frequency = StringField(required=True, choices=('once_daily', 'twice_daily', 'thrice_daily', 'as_needed'))
    duration_days = IntField(required=True)
    quantity = IntField(required=True)
    instructions = StringField()


class ActiveDoctorStage(EmbeddedDocument):
    """Doctor examination data in an active session."""

    diagnosis = StringField()
    treatment_plan = StringField()
    clinical_notes = StringField()
    vital_signs = EmbeddedDocumentField(ActiveVitalSigns)
    next_visit_date = DateTimeField()
    prescriptions = ListField(EmbeddedDocumentField(ActivePrescriptionDraft))
    completed_by = ObjectIdField()
    completed_at = DateTimeField()


class DispenseItem(EmbeddedDocument):
    """Individual medicine dispense record in the pharmacy stage."""

    medicine_id = ObjectIdField(required=True)
    quantity_prescribed = IntField(required=True)
    quantity_dispensed = IntField(default=0)
    selected_for_dispense = BooleanField(default=True)
    stock_before = IntField()
    stock_after = IntField()


class ActivePharmacyStage(EmbeddedDocument):
    """Pharmacy dispensing data in an active session."""

    dispense_items = ListField(EmbeddedDocumentField(DispenseItem))
    completed_by = ObjectIdField()
    completed_at = DateTimeField()


# ---------------------------------------------------------------------------
# Top-level Documents (hms_active)
# ---------------------------------------------------------------------------

class ActiveSession(Document):
    """
    Single in-progress visit object that travels through the workflow.

    Moves through stages: counsellor → doctor → pharmacy. Once complete,
    the ArchiveService atomically writes it to hms_archive and deletes
    it from hms_active.
    """

    hospital_id = ObjectIdField(required=True)
    active_visit_uid = StringField(required=True)
    patient_id = ObjectIdField(required=True)
    patient_snapshot = EmbeddedDocumentField(ActivePatientSnapshot, required=True)
    visit_number = IntField(required=True)
    visit_date = DateTimeField(required=True)
    state = EmbeddedDocumentField(SessionState, required=True)
    assignments = EmbeddedDocumentField(SessionAssignments, required=True)
    timestamps = EmbeddedDocumentField(SessionTimestamps, required=True)
    counsellor_stage = EmbeddedDocumentField(ActiveCounsellorStage)
    doctor_stage = EmbeddedDocumentField(ActiveDoctorStage)
    pharmacy_stage = EmbeddedDocumentField(ActivePharmacyStage)
    participants = ListField(ObjectIdField(), default=list)
    version = IntField(required=True, default=1)
    expires_at = DateTimeField(required=True)
    created_at = DateTimeField(required=True, default=datetime.datetime.utcnow)
    updated_at = DateTimeField(required=True, default=datetime.datetime.utcnow)

    meta = {
        'db_alias': 'active',
        'collection': 'active_sessions',
        'indexes': [
            {'fields': ['hospital_id', 'active_visit_uid'], 'unique': True},
            # Queue indexes for each stage
            {
                'fields': [
                    'hospital_id', 'state.current_stage',
                    'assignments.counsellor_id', 'state.stage_status',
                    'timestamps.checkin_at',
                ],
            },
            {
                'fields': [
                    'hospital_id', 'state.current_stage',
                    'assignments.doctor_id', 'state.stage_status',
                    'timestamps.counsellor_completed_at',
                ],
            },
            {
                'fields': [
                    'hospital_id', 'state.current_stage',
                    'assignments.pharmacist_id', 'state.stage_status',
                    'timestamps.doctor_completed_at',
                ],
            },
            {'fields': ['hospital_id', 'visit_date', 'state.status']},
            {'fields': ['hospital_id', 'participants']},
            {'fields': ['expires_at'], 'expireAfterSeconds': 0},
            {'fields': ['hospital_id', 'patient_id', 'visit_date']},
        ],
    }


class ActiveLock(Document):
    """
    Prevents double-start and double-complete race conditions.

    One lock per (session, stage). TTL auto-expires stale locks.
    """

    STAGE_CHOICES = ('counsellor', 'doctor', 'pharmacy')
    LOCK_REASONS = ('start_session', 'submit_stage', 'close_visit')

    hospital_id = ObjectIdField(required=True)
    active_session_id = ObjectIdField(required=True)
    stage = StringField(required=True, choices=STAGE_CHOICES)
    locked_by = ObjectIdField(required=True)
    lock_reason = StringField(required=True, choices=LOCK_REASONS)
    expires_at = DateTimeField(required=True)
    created_at = DateTimeField(required=True, default=datetime.datetime.utcnow)

    meta = {
        'db_alias': 'active',
        'collection': 'active_locks',
        'indexes': [
            {'fields': ['hospital_id', 'active_session_id', 'stage'], 'unique': True},
            {'fields': ['expires_at'], 'expireAfterSeconds': 0},
        ],
    }


class AuthBlacklist(Document):
    """
    Fast logout invalidation for access token JTIs.

    TTL index auto-cleans expired entries so the blacklist stays bounded.
    """

    token_jti = StringField(required=True, unique=True)
    staff_id = ObjectIdField(required=True)
    hospital_id = ObjectIdField(required=True)
    expires_at = DateTimeField(required=True)
    created_at = DateTimeField(required=True, default=datetime.datetime.utcnow)

    meta = {
        'db_alias': 'active',
        'collection': 'auth_blacklist',
        'indexes': [
            {'fields': ['token_jti'], 'unique': True},
            {'fields': ['expires_at'], 'expireAfterSeconds': 0},
        ],
    }
