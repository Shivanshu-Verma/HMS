"""Archive service for atomically closing active sessions into archive visits."""
import datetime
import uuid

from bson import ObjectId
from mongoengine.connection import get_connection

from apps.pharmacy.services import PaymentValidator
from utils.exceptions import ConflictError, NotFoundError, ValidationError


def _serialize_visit(doc: dict) -> dict:
    return {
        'visit_id': str(doc['_id']),
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
    def close_visit(session_id: str, payment_data: dict, pharmacist_id: ObjectId, pharmacist_name: str) -> dict:
        """Close an active session atomically and return archived visit payload."""

        client = get_connection('archive')
        archive_db = client.get_database('hms_archive')
        active_db = client.get_database('hms_active')

        with client.start_session() as mongo_session:
            with mongo_session.start_transaction():
                active_session = active_db.active_sessions.find_one({'_id': ObjectId(session_id)}, session=mongo_session)
                if not active_session:
                    raise NotFoundError(message='Session not found.', code='SESSION_NOT_FOUND')

                patient = archive_db.patients.find_one({'_id': active_session['patient_id']}, session=mongo_session)
                if not patient:
                    raise NotFoundError(message='Patient not found.', code='PATIENT_NOT_FOUND')

                dispense_items = active_session.get('dispense_items', [])
                medicines_total = float(sum(float(i['line_total']) for i in dispense_items))
                outstanding_before = float(patient.get('outstanding_debt', 0.0))

                computed = PaymentValidator.validate(
                    payment_data=payment_data,
                    medicines_total=medicines_total,
                    outstanding_debt=outstanding_before,
                )

                # Validate stock levels before mutations.
                for item in dispense_items:
                    medicine = archive_db.medicines.find_one({'_id': item['medicine_id'], 'is_active': True}, session=mongo_session)
                    if not medicine:
                        raise NotFoundError(message='Medicine not found.', code='MEDICINE_NOT_FOUND')
                    if int(medicine.get('stock_quantity', 0)) < int(item['quantity']):
                        raise ConflictError(
                            code='INSUFFICIENT_STOCK',
                            message=f"Insufficient stock for {item['medicine_name']}",
                        )

                outstanding_after = float(outstanding_before - computed.debt_cleared + computed.new_debt)
                if outstanding_after < 0:
                    raise ValidationError(code='INVALID_OUTSTANDING_DEBT', message='Outstanding debt cannot be negative.')

                visit_doc = {
                    '_id': ObjectId(),
                    'hospital_id': active_session['hospital_id'],
                    'visit_uid': f"VIS-{uuid.uuid4().hex[:12].upper()}",
                    'visit_type': 'standard',
                    'patient_id': active_session['patient_id'],
                    'visit_date': datetime.datetime.utcnow(),
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
                    'created_at': datetime.datetime.utcnow(),
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
                        {'_id': item['medicine_id']},
                        {
                            '$inc': {'stock_quantity': -int(item['quantity'])},
                            '$set': {'updated_at': datetime.datetime.utcnow()},
                        },
                        session=mongo_session,
                    )

                active_db.active_sessions.delete_one({'_id': active_session['_id']}, session=mongo_session)

                return _serialize_visit(visit_doc)
