"""Archive service for atomically closing active sessions into archive visits."""
import datetime
import uuid

from bson import ObjectId
from mongoengine.connection import get_connection, get_db

from apps.pharmacy.services import PaymentValidator
from utils.exceptions import ConflictError, HMSError, NotFoundError, ValidationError


def _serialize_visit(doc: dict) -> dict:
    return {
        'visit_id': str(doc['_id']),
        'invoice_number': doc.get('invoice_number'),
        'visit_type': doc.get('visit_type'),
        'patient_id': str(doc.get('patient_id')),
        'visit_date': doc.get('visit_date').isoformat() if doc.get('visit_date') else None,
        'dispensed_by': str(doc.get('dispensed_by')) if doc.get('dispensed_by') else None,
        'dispensed_by_name': doc.get('dispensed_by_name'),
        'checked_in_by': str(doc.get('checked_in_by')) if doc.get('checked_in_by') else None,
        'checked_in_by_name': doc.get('checked_in_by_name'),
        'dispense_items': [
            {
                'medicine_id': str(item['medicine_id']),
                'medicine_name': item['medicine_name'],
                'quantity': item['quantity'],
                'unit_price': item['unit_price'],
                'line_total': item['line_total'],
            }
            for item in doc.get('dispense_items', [])
        ],
        'medicines_total': float(doc.get('medicines_total', 0.0)),
        'payment': doc.get('payment', {}),
        'debt_snapshot': doc.get('debt_snapshot', {}),
    }


class ArchiveService:
    """Service responsible for checkout archival transaction."""

    @staticmethod
    def close_visit(
        session_id: str,
        hospital_id: ObjectId,
        payment_data: dict,
        pharmacist_id: ObjectId,
        pharmacist_name: str,
    ) -> dict:
        """Close an active session atomically and return archived visit payload."""

        archive_client = get_connection('archive')
        active_client = get_connection('active')
        archive_db = get_db('archive')
        active_alias_db = get_db('active')

        archive_nodes = set(getattr(archive_client, 'nodes', set()) or set())
        active_nodes = set(getattr(active_client, 'nodes', set()) or set())
        if archive_nodes and active_nodes and archive_nodes != active_nodes:
            raise HMSError(
                code='ARCHIVE_TRANSACTION_UNSUPPORTED',
                message='Archive and active databases must use the same MongoDB deployment for checkout.',
                status_code=500,
            )

        client = archive_client
        active_db = client.get_database(active_alias_db.name)

        with client.start_session() as mongo_session:
            with mongo_session.start_transaction():
                active_session = active_db.active_sessions.find_one(
                    {
                        '_id': ObjectId(session_id),
                        'hospital_id': hospital_id,
                    },
                    session=mongo_session,
                )
                if not active_session:
                    raise NotFoundError(message='Session not found.', code='SESSION_NOT_FOUND')
                if active_session.get('status') != 'dispensing':
                    raise ConflictError(code='WRONG_STAGE', message='Session is not at the pharmacy stage.')

                patient = archive_db.patients.find_one(
                    {
                        '_id': active_session['patient_id'],
                        'hospital_id': hospital_id,
                    },
                    session=mongo_session,
                )
                if not patient:
                    raise NotFoundError(message='Patient not found.', code='PATIENT_NOT_FOUND')

                dispense_items = active_session.get('dispense_items', [])
                medicines_total = float(sum(float(i['line_total']) for i in dispense_items))
                outstanding_before = float(patient.get('outstanding_debt', 0.0))
                visit_date = datetime.datetime.utcnow()

                computed = PaymentValidator.validate(
                    payment_data=payment_data,
                    medicines_total=medicines_total,
                    outstanding_debt=outstanding_before,
                )

                # Validate stock levels before mutations.
                medicine_snapshots = {}
                stock_deductions = []
                for item in dispense_items:
                    medicine = archive_db.medicines.find_one(
                        {
                            '_id': item['medicine_id'],
                            'hospital_id': hospital_id,
                            'is_active': True,
                        },
                        session=mongo_session,
                    )
                    if not medicine:
                        raise NotFoundError(message='Medicine not found.', code='MEDICINE_NOT_FOUND')
                    if int(medicine.get('stock_quantity', 0)) < int(item['quantity']):
                        raise ConflictError(
                            code='INSUFFICIENT_STOCK',
                            message=f"Insufficient stock for {item['medicine_name']}",
                        )
                    medicine_snapshots[item['medicine_id']] = medicine
                    stock_before = int(medicine.get('stock_quantity', 0))
                    stock_after = stock_before - int(item['quantity'])
                    stock_deductions.append(
                        {
                            'medicine_id': item['medicine_id'],
                            'quantity_out': int(item['quantity']),
                            'stock_before': stock_before,
                            'stock_after': stock_after,
                        }
                    )

                outstanding_after = float(outstanding_before - computed.debt_cleared + computed.new_debt)
                if outstanding_after < 0:
                    raise ValidationError(code='INVALID_OUTSTANDING_DEBT', message='Outstanding debt cannot be negative.')

                patient_addiction = patient.get('addiction_profile') or {}
                patient_medical = patient.get('medical_background') or {}
                patient_snapshot = {
                    'patient_uid': patient.get('patient_uid') or f"PID-{str(patient['_id'])}",
                    'registration_number': patient.get('registration_number', ''),
                    'full_name': patient.get('full_name', active_session.get('patient_name', '')),
                    'gender': patient.get('gender'),
                    'date_of_birth': patient.get('date_of_birth'),
                    'addiction_type': patient_addiction.get('addiction_type'),
                    'phone': patient.get('phone'),
                    'allergies': patient_medical.get('allergies'),
                    'medical_history': patient_medical.get('medical_history'),
                }

                counsellor_stage = None
                if active_session.get('counsellor_completed_at'):
                    counsellor_stage = {
                        'session_notes': active_session.get('counsellor_session_notes', ''),
                        'mood_assessment': active_session.get('counsellor_mood_assessment'),
                        'risk_level': active_session.get('counsellor_risk_level', 'low'),
                        'recommendations': active_session.get('counsellor_recommendations'),
                        'follow_up_required': bool(active_session.get('counsellor_follow_up_required', False)),
                        'created_at': active_session.get('counsellor_started_at') or active_session.get('counsellor_completed_at'),
                    }

                active_doctor_stage = active_session.get('doctor_stage') or {}
                doctor_stage = None
                prescription_items = []
                if active_doctor_stage:
                    doctor_stage = {
                        'diagnosis': active_doctor_stage.get('diagnosis', ''),
                        'treatment_plan': active_doctor_stage.get('treatment_plan'),
                        'clinical_notes': active_doctor_stage.get('clinical_notes'),
                        'vital_signs': active_doctor_stage.get('vital_signs'),
                        'next_visit_date': active_doctor_stage.get('next_visit_date'),
                        'created_at': active_session.get('doctor_started_at') or active_doctor_stage.get('completed_at') or visit_date,
                    }
                    for item in active_doctor_stage.get('prescriptions', []):
                        medicine = medicine_snapshots.get(item.get('medicine_id')) or archive_db.medicines.find_one(
                            {
                                '_id': item.get('medicine_id'),
                                'hospital_id': hospital_id,
                            },
                            session=mongo_session,
                        )
                        prescription_items.append(
                            {
                                'prescription_item_id': item.get('draft_item_id') or ObjectId(),
                                'medicine_id': item.get('medicine_id'),
                                'medicine_snapshot': {
                                    'name': medicine.get('name', '') if medicine else '',
                                    'generic_name': medicine.get('generic_name') if medicine else None,
                                    'unit': medicine.get('unit') if medicine else None,
                                    'category': medicine.get('category') if medicine else None,
                                },
                                'dosage': item.get('dosage', ''),
                                'frequency': item.get('frequency'),
                                'duration_days': item.get('duration_days'),
                                'quantity_prescribed': item.get('quantity'),
                                'instructions': item.get('instructions'),
                                'dispensed': any(dispense['medicine_id'] == item.get('medicine_id') for dispense in dispense_items),
                                'quantity_dispensed': next(
                                    (
                                        dispense['quantity']
                                        for dispense in dispense_items
                                        if dispense['medicine_id'] == item.get('medicine_id')
                                    ),
                                    0,
                                ),
                                'dispensed_at': visit_date,
                            }
                        )

                visit_object_id = ObjectId()
                visit_doc = {
                    '_id': visit_object_id,
                    'hospital_id': active_session['hospital_id'],
                    'visit_uid': f"VIS-{uuid.uuid4().hex[:12].upper()}",
                    'invoice_number': f"INV-{str(visit_object_id)[-8:].upper()}",
                    'visit_type': 'standard',
                    'patient_id': active_session['patient_id'],
                    'patient_snapshot': patient_snapshot,
                    'visit_number': int(patient.get('visit_count', 0)) + 1,
                    'visit_date': visit_date,
                    'lifecycle': {
                        'status': 'completed',
                        'current_stage': 'completed',
                        'checkin_at': active_session.get('checked_in_at'),
                        'counsellor_started_at': active_session.get('counsellor_started_at'),
                        'counsellor_completed_at': active_session.get('counsellor_completed_at'),
                        'doctor_started_at': active_session.get('doctor_started_at'),
                        'doctor_completed_at': active_session.get('doctor_completed_at'),
                        'pharmacy_started_at': active_session.get('pharmacy_started_at'),
                        'pharmacy_completed_at': visit_date,
                        'completed_at': visit_date,
                    },
                    'assignments': {
                        'receptionist_id': active_session.get('checked_in_by'),
                        'counsellor_id': active_session.get('assigned_counsellor_id'),
                        'doctor_id': active_session.get('assigned_doctor_id'),
                        'pharmacist_id': pharmacist_id,
                    },
                    'counsellor_stage': counsellor_stage,
                    'doctor_stage': doctor_stage,
                    'prescription_items': prescription_items,
                    'pharmacy_stage': {
                        'dispensed_items_count': len(dispense_items),
                        'stock_deductions': stock_deductions,
                        'created_at': visit_date,
                    },
                    'audit': {
                        'archived_from_active_session_id': active_session['_id'],
                        'archived_by': pharmacist_id,
                        'archive_txn_id': uuid.uuid4().hex,
                        'version': 1,
                    },
                    'checked_in_by': active_session['checked_in_by'],
                    'checked_in_by_name': active_session['checked_in_by_name'],
                    'dispensed_by': pharmacist_id,
                    'dispensed_by_name': pharmacist_name,
                    'dispense_items': dispense_items,
                    'medicines_total': computed.medicines_total,
                    'payment': {
                        'method': payment_data['method'],
                        'cash_amount': computed.cash_amount,
                        'online_amount': computed.online_amount,
                        'new_debt': computed.new_debt,
                        'debt_cleared': computed.debt_cleared,
                        'total_charged': computed.total_due,
                    },
                    'debt_snapshot': {
                        'debt_before': outstanding_before,
                        'debt_after': outstanding_after,
                    },
                    'created_at': visit_date,
                }

                archive_db.visits.insert_one(visit_doc, session=mongo_session)

                archive_db.patients.update_one(
                    {'_id': patient['_id']},
                    {
                        '$push': {'visits': visit_doc['_id'], 'visit_ids': visit_doc['_id']},
                        '$inc': {'visit_count': 1},
                        '$set': {
                            'last_visit_at': visit_doc['visit_date'],
                            'outstanding_debt': outstanding_after,
                            'updated_at': datetime.datetime.utcnow(),
                        },
                    },
                    session=mongo_session,
                )

                for item in dispense_items:
                    archive_db.medicines.update_one(
                        {
                            '_id': item['medicine_id'],
                            'hospital_id': hospital_id,
                        },
                        {
                            '$inc': {'stock_quantity': -int(item['quantity'])},
                            '$set': {'updated_at': datetime.datetime.utcnow()},
                        },
                        session=mongo_session,
                    )

                active_db.active_sessions.delete_one({'_id': active_session['_id']}, session=mongo_session)

                return _serialize_visit(visit_doc)
