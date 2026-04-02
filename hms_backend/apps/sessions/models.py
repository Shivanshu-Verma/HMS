"""MongoEngine models for transient active-session data in hms_active."""
import datetime

from django.conf import settings
from mongoengine import (
    Document,
    EmbeddedDocument,
    EmbeddedDocumentField,
    StringField,
    ObjectIdField,
    DateTimeField,
    IntField,
    FloatField,
    ListField,
    BooleanField,
)


class ActiveVitalSigns(EmbeddedDocument):
    """Dormant doctor vital-signs schema retained for import compatibility."""

    blood_pressure = StringField()
    pulse = IntField()
    weight_kg = FloatField()
    temperature_f = FloatField()


class ActivePrescriptionDraft(EmbeddedDocument):
    """Dormant doctor prescription draft schema retained for import compatibility."""

    medicine_id = ObjectIdField(required=True)
    dosage = StringField(required=True)
    frequency = StringField(required=True)
    duration_days = IntField(required=True)
    quantity = IntField(required=True)
    instructions = StringField()


class ActiveDoctorStage(EmbeddedDocument):
    """Dormant doctor stage schema retained for import compatibility."""

    diagnosis = StringField()
    treatment_plan = StringField()
    clinical_notes = StringField()
    vital_signs = EmbeddedDocumentField(ActiveVitalSigns)
    next_visit_date = DateTimeField()
    prescriptions = ListField(EmbeddedDocumentField(ActivePrescriptionDraft), default=list)
    completed_by = ObjectIdField()
    completed_at = DateTimeField()


class DispenseItem(EmbeddedDocument):
    """Per-medicine dispense item staged during an active session."""

    medicine_id = ObjectIdField(required=True)
    medicine_name = StringField(required=True)
    quantity = IntField(required=True, min_value=1)
    unit_price = FloatField(required=True, min_value=0.0)
    line_total = FloatField(required=True, min_value=0.0)


class ActiveSession(Document):
    """Single active check-in session tracked until pharmacy checkout."""

    hospital_id = ObjectIdField(required=True)
    patient_id = ObjectIdField(required=True)
    patient_name = StringField(required=True)

    checked_in_by = ObjectIdField(required=True)
    checked_in_by_name = StringField(required=True)
    checked_in_at = DateTimeField(required=True)

    status = StringField(
        required=True,
        default='checked_in',
        choices=settings.SESSION_STATUS_CHOICES,
    )

    assigned_counsellor_id = ObjectIdField()
    counsellor_started_at = DateTimeField()
    counsellor_completed_at = DateTimeField()
    counsellor_session_notes = StringField()
    counsellor_mood_assessment = IntField()
    counsellor_risk_level = StringField(choices=('low', 'medium', 'high'))
    counsellor_recommendations = StringField()
    counsellor_follow_up_required = BooleanField()

    dispense_items = ListField(EmbeddedDocumentField(DispenseItem), default=list)
    outstanding_debt_at_checkin = FloatField(default=0.0, min_value=0.0)
    created_at = DateTimeField(required=True, default=datetime.datetime.utcnow)
    updated_at = DateTimeField(required=True, default=datetime.datetime.utcnow)

    meta = {
        'db_alias': 'active',
        'collection': 'active_sessions',
        'indexes': [
            {'fields': ['patient_id'], 'unique': True},
            {'fields': ['checked_in_at']},
            {'fields': ['checked_in_by']},
            {'fields': ['status']},
            {'fields': ['hospital_id', 'checked_in_at']},
        ],
    }


class AuthBlacklist(Document):
    """Blacklist for access-token JTIs used to enforce logout and revocation."""

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
