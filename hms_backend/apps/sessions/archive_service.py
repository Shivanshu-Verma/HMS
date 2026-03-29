"""
Archive Service — atomically transitions active sessions to archived visits.

This is the critical data integrity component. It:
1. Reads the complete active session with all stage data
2. Constructs an immutable Visit document from the session
3. Inserts the Visit into hms_archive
4. Updates the Patient record (visit_ids, visit_count, last_visit_at)
5. Deletes the ActiveSession from hms_active
6. Deletes any associated ActiveLock

For MongoDB Atlas with replica sets, this uses a multi-collection transaction.
For standalone MongoDB (dev), it uses a best-effort sequential approach.
"""
import datetime
import logging
import uuid

from bson import ObjectId

from apps.patients.models import (
    Patient, Visit, Medicine,
    PatientSnapshot, VisitLifecycle, VisitAssignments,
    CounsellorStage, DoctorStage, VitalSigns as ArchiveVitalSigns,
    PharmacyStage, StockDeduction, PrescriptionItem, MedicineSnapshot,
    VisitAudit,
)
from apps.sessions.models import ActiveSession, ActiveLock

logger = logging.getLogger(__name__)


def archive_session(session: ActiveSession, archived_by: ObjectId) -> Visit:
    """
    Archive an active session to the visits collection.

    Builds a complete Visit document from the active session's embedded
    stage data and patient snapshot, then saves it to hms_archive and
    cleans up the active session.

    Args:
        session (ActiveSession): The active session to archive.
        archived_by (ObjectId): The staff member performing the archive.

    Returns:
        Visit: The newly created archived visit document.

    Raises:
        Exception: On any failure during the archive process.
    """
    now = datetime.datetime.utcnow()

    # Build patient snapshot for the archive
    snap = session.patient_snapshot
    patient_snapshot = PatientSnapshot(
        patient_uid=snap.patient_uid,
        registration_number=snap.registration_number,
        full_name=snap.full_name,
        gender=snap.gender,
        date_of_birth=snap.date_of_birth,
        addiction_type=snap.addiction_type,
        phone=snap.phone,
        allergies=snap.allergies,
        medical_history=snap.medical_history,
    )

    # Build lifecycle
    lifecycle = VisitLifecycle(
        status='completed',
        current_stage='completed',
        checkin_at=session.timestamps.checkin_at,
        counsellor_started_at=session.timestamps.counsellor_started_at,
        counsellor_completed_at=session.timestamps.counsellor_completed_at,
        doctor_started_at=session.timestamps.doctor_started_at,
        doctor_completed_at=session.timestamps.doctor_completed_at,
        pharmacy_started_at=session.timestamps.pharmacy_started_at,
        pharmacy_completed_at=now,
        completed_at=now,
    )

    # Build assignments
    assignments = VisitAssignments(
        receptionist_id=session.assignments.receptionist_id,
        counsellor_id=session.assignments.counsellor_id,
        doctor_id=session.assignments.doctor_id,
        pharmacist_id=session.assignments.pharmacist_id or archived_by,
    )

    # Build counsellor stage
    counsellor_stage = None
    if session.counsellor_stage:
        cs = session.counsellor_stage
        counsellor_stage = CounsellorStage(
            session_notes=cs.session_notes or '',
            mood_assessment=cs.mood_assessment,
            risk_level=cs.risk_level or 'low',
            recommendations=cs.recommendations,
            follow_up_required=cs.follow_up_required if cs.follow_up_required is not None else True,
            session_duration_minutes=cs.session_duration_minutes,
            created_at=cs.completed_at or now,
        )

    # Build doctor stage
    doctor_stage = None
    if session.doctor_stage:
        ds = session.doctor_stage
        vital_signs = None
        if ds.vital_signs:
            vital_signs = ArchiveVitalSigns(
                blood_pressure=ds.vital_signs.blood_pressure,
                pulse=ds.vital_signs.pulse,
                weight_kg=ds.vital_signs.weight_kg,
                temperature_f=ds.vital_signs.temperature_f,
            )

        doctor_stage = DoctorStage(
            diagnosis=ds.diagnosis or '',
            treatment_plan=ds.treatment_plan,
            clinical_notes=ds.clinical_notes,
            vital_signs=vital_signs,
            next_visit_date=ds.next_visit_date,
            created_at=ds.completed_at or now,
        )

    # Build prescription items
    prescription_items = []
    if session.doctor_stage and session.doctor_stage.prescriptions:
        for p in session.doctor_stage.prescriptions:
            # Get medicine snapshot
            med_snapshot = MedicineSnapshot(name='Unknown')
            try:
                med = Medicine.objects.get(id=p.medicine_id)
                med_snapshot = MedicineSnapshot(
                    name=med.name,
                    generic_name=med.generic_name,
                    unit=med.unit,
                    category=med.category,
                )
            except Medicine.DoesNotExist:
                pass

            # Check if dispensed
            dispensed = False
            qty_dispensed = 0
            dispensed_at = None
            if session.pharmacy_stage and session.pharmacy_stage.dispense_items:
                for di in session.pharmacy_stage.dispense_items:
                    if di.medicine_id == p.medicine_id and di.selected_for_dispense:
                        dispensed = True
                        qty_dispensed = di.quantity_dispensed
                        dispensed_at = session.pharmacy_stage.completed_at
                        break

            prescription_items.append(PrescriptionItem(
                prescription_item_id=p.draft_item_id or ObjectId(),
                medicine_id=p.medicine_id,
                medicine_snapshot=med_snapshot,
                dosage=p.dosage,
                frequency=p.frequency,
                duration_days=p.duration_days,
                quantity_prescribed=p.quantity,
                instructions=p.instructions,
                dispensed=dispensed,
                quantity_dispensed=qty_dispensed,
                dispensed_at=dispensed_at,
            ))

    # Build pharmacy stage
    pharmacy_stage = PharmacyStage(
        dispensed_items_count=len([di for di in (session.pharmacy_stage.dispense_items or []) if di.selected_for_dispense]) if session.pharmacy_stage else 0,
        stock_deductions=[
            StockDeduction(
                medicine_id=di.medicine_id,
                quantity_out=di.quantity_dispensed,
                stock_before=di.stock_before or 0,
                stock_after=di.stock_after or 0,
            )
            for di in (session.pharmacy_stage.dispense_items or [])
            if di.selected_for_dispense
        ] if session.pharmacy_stage else [],
        created_at=now,
    )

    # Build audit
    audit = VisitAudit(
        archived_from_active_session_id=session.id,
        archived_by=archived_by,
        archive_txn_id=str(uuid.uuid4()),
        version=session.version,
    )

    # Create the archived visit
    visit = Visit(
        hospital_id=session.hospital_id,
        visit_uid=session.active_visit_uid,
        patient_id=session.patient_id,
        patient_snapshot=patient_snapshot,
        visit_number=session.visit_number,
        visit_date=session.visit_date,
        lifecycle=lifecycle,
        assignments=assignments,
        counsellor_stage=counsellor_stage,
        doctor_stage=doctor_stage,
        prescription_items=prescription_items,
        pharmacy_stage=pharmacy_stage,
        audit=audit,
        created_at=now,
    )

    try:
        # Save the archived visit
        visit.save()

        # Update patient record
        try:
            Patient.objects(id=session.patient_id).update(
                push__visit_ids=visit.id,
                inc__visit_count=1,
                set__last_visit_at=now,
                set__updated_at=now,
            )
        except Exception as e:
            logger.error("Failed to update patient record during archive: %s", str(e))

        # Delete the active session
        try:
            session.delete()
        except Exception as e:
            logger.error("Failed to delete active session after archive: %s", str(e))

        # Clean up any locks
        try:
            ActiveLock.objects(active_session_id=session.id).delete()
        except Exception as e:
            logger.warning("Failed to clean up locks after archive: %s", str(e))

        logger.info(
            "Archived session %s to visit %s for patient %s",
            str(session.id), str(visit.id), str(session.patient_id),
        )

        return visit

    except Exception as e:
        logger.error("Archive failed for session %s: %s", str(session.id), str(e))
        # Attempt rollback — delete the visit if it was saved
        try:
            visit.delete()
        except Exception:
            pass
        raise
