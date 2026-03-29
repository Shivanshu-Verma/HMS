"""
Pharmacy views for dispensing and inventory management.

Handles queue listing, dispense detail/execution, visit closing,
inventory listing/stock updates/medicine creation, and history.
"""
import datetime
import logging
import uuid

from rest_framework.views import APIView
from bson import ObjectId
from django.conf import settings

from apps.auth_app.permissions import IsPharmacy
from apps.sessions.models import ActiveSession, ActivePharmacyStage, DispenseItem
from apps.patients.models import Visit, Patient, Medicine, InventoryTransaction
from apps.receptionist.serializers import serialize_active_session_for_queue
from apps.patients.serializers import serialize_visit_summary
from apps.doctor.serializers import serialize_medicine
from apps.pharmacy.serializers import DispenseSerializer, AddStockSerializer, AddMedicineSerializer
from utils.response import success_response, paginated_response
from utils.pagination import parse_pagination_params, paginate_queryset
from utils.exceptions import NotFoundError, ConflictError, HMSError

logger = logging.getLogger(__name__)


class PharmacyQueueView(APIView):
    """
    Get the pharmacy queue — patients at the 'pharmacy' stage.

    GET /api/v1/pharmacy/queue
    """

    permission_classes = [IsPharmacy]

    def get(self, request):
        """
        Return all sessions at the pharmacy stage.

        Args:
            request: DRF request.

        Returns:
            Response: List of sessions awaiting dispensing.
        """
        hospital_id = ObjectId(request.user.hospital_id)

        sessions = ActiveSession.objects(
            hospital_id=hospital_id,
            state__current_stage='pharmacy',
            state__status='in_progress',
        ).order_by('timestamps__doctor_completed_at')

        serialized = []
        for s in sessions:
            data = serialize_active_session_for_queue(s)
            # Enrich with prescription medicine names
            if s.doctor_stage and s.doctor_stage.prescriptions:
                for p in data.get('doctor_stage', {}).get('prescriptions', []):
                    try:
                        med = Medicine.objects.get(id=ObjectId(p['medicine_id']))
                        p['medicine_name'] = med.name
                        p['medicine_unit'] = med.unit
                        p['price_per_unit'] = med.price_per_unit
                        p['stock_quantity'] = med.stock_quantity
                    except Medicine.DoesNotExist:
                        p['medicine_name'] = 'Unknown'
            serialized.append(data)

        return success_response({'items': serialized, 'total': len(serialized)})


class DispenseDetailView(APIView):
    """
    Get full dispense details for a session in the pharmacy queue.

    GET /api/v1/pharmacy/dispense/{id}
    """

    permission_classes = [IsPharmacy]

    def get(self, request, session_id):
        """
        Return session with prescription details and medicine info for dispensing.

        Args:
            request: DRF request.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Full session data with enriched prescription/medicine info.
        """
        try:
            session = ActiveSession.objects.get(id=ObjectId(session_id))
        except ActiveSession.DoesNotExist:
            raise NotFoundError(message="Session not found.", code="SESSION_NOT_FOUND")

        data = serialize_active_session_for_queue(session)

        # Enrich prescriptions with medicine details
        if session.doctor_stage and session.doctor_stage.prescriptions:
            for p in data.get('doctor_stage', {}).get('prescriptions', []):
                try:
                    med = Medicine.objects.get(id=ObjectId(p['medicine_id']))
                    p['medicine_name'] = med.name
                    p['medicine_unit'] = med.unit
                    p['price_per_unit'] = med.price_per_unit
                    p['stock_quantity'] = med.stock_quantity
                except Medicine.DoesNotExist:
                    p['medicine_name'] = 'Unknown'

        return success_response(data)


class DispenseView(APIView):
    """
    Dispense medicines — deduct stock and record dispensing data.

    POST /api/v1/pharmacy/dispense/{id}
    """

    permission_classes = [IsPharmacy]

    def post(self, request, session_id):
        """
        Process medicine dispensing: deduct stock, record transactions, update session.

        Args:
            request: DRF request with dispense items.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Updated session data with stock deductions.
        """
        try:
            session = ActiveSession.objects.get(id=ObjectId(session_id))
        except ActiveSession.DoesNotExist:
            raise NotFoundError(message="Session not found.", code="SESSION_NOT_FOUND")

        if session.state.current_stage != 'pharmacy':
            raise ConflictError(message="Session is not at the pharmacy stage.", code="WRONG_STAGE")

        serializer = DispenseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        now = datetime.datetime.utcnow()
        pharmacist_id = ObjectId(request.user.id)
        hospital_id = ObjectId(request.user.hospital_id)

        dispense_items = []
        stock_deductions = []

        for item in data['items']:
            if not item.get('selected', True):
                continue

            medicine_id = ObjectId(item['medicine_id'])
            qty = item['quantity_dispensed']

            if qty <= 0:
                continue

            try:
                medicine = Medicine.objects.get(id=medicine_id)
            except Medicine.DoesNotExist:
                continue

            stock_before = medicine.stock_quantity
            stock_after = max(0, stock_before - qty)

            # Deduct stock
            medicine.stock_quantity = stock_after
            medicine.updated_at = now
            medicine.save()

            # Create inventory transaction
            InventoryTransaction(
                hospital_id=hospital_id,
                medicine_id=medicine_id,
                transaction_type='out',
                quantity=qty,
                stock_before=stock_before,
                stock_after=stock_after,
                reference_type='dispense',
                reference_id=session.id,
                performed_by=pharmacist_id,
                notes=f"Dispensed for patient {session.patient_snapshot.full_name}",
                created_at=now,
            ).save()

            dispense_items.append(DispenseItem(
                medicine_id=medicine_id,
                quantity_prescribed=qty,
                quantity_dispensed=qty,
                selected_for_dispense=True,
                stock_before=stock_before,
                stock_after=stock_after,
            ))

        # Update pharmacy stage
        session.pharmacy_stage = ActivePharmacyStage(
            dispense_items=dispense_items,
            completed_by=pharmacist_id,
            completed_at=now,
        )

        session.assignments.pharmacist_id = pharmacist_id
        session.timestamps.pharmacy_started_at = now
        session.timestamps.updated_at = now
        session.updated_at = now

        if pharmacist_id not in session.participants:
            session.participants.append(pharmacist_id)

        session.save()

        return success_response(serialize_active_session_for_queue(session))


class CloseVisitView(APIView):
    """
    Close a visit — archive the session and clean up.

    POST /api/v1/pharmacy/visits/{id}/close
    """

    permission_classes = [IsPharmacy]

    def post(self, request, session_id):
        """
        Archive the active session to the visits collection and delete it.

        Args:
            request: DRF request.
            session_id: ActiveSession ObjectId string.

        Returns:
            Response: Archived visit summary.
        """
        from apps.sessions.archive_service import archive_session

        try:
            session = ActiveSession.objects.get(id=ObjectId(session_id))
        except ActiveSession.DoesNotExist:
            raise NotFoundError(message="Session not found.", code="SESSION_NOT_FOUND")

        if session.state.current_stage != 'pharmacy':
            raise ConflictError(message="Session is not at the pharmacy stage.", code="WRONG_STAGE")

        if not session.pharmacy_stage or not session.pharmacy_stage.completed_at:
            raise HMSError(
                code="NOT_DISPENSED",
                message="Please dispense medicines before closing the visit.",
                status_code=400,
            )

        pharmacist_id = ObjectId(request.user.id)
        archived_visit = archive_session(session, pharmacist_id)

        return success_response(serialize_visit_summary(archived_visit))


class InventoryListView(APIView):
    """
    List all medicines in inventory.

    GET /api/v1/pharmacy/inventory
    """

    permission_classes = [IsPharmacy]

    def get(self, request):
        """
        Return all medicines with optional search/filter.

        Args:
            request: DRF request with optional 'q' and 'filter' query params.

        Returns:
            Response: Paginated list of medicines.
        """
        hospital_id = ObjectId(request.user.hospital_id)
        query = request.query_params.get('q', '').strip()
        stock_filter = request.query_params.get('filter', 'all')
        page, page_size = parse_pagination_params(request)

        medicines = Medicine.objects(hospital_id=hospital_id).order_by('name')

        if query:
            import re
            pattern = re.escape(query)
            medicines = medicines.filter(
                __raw__={
                    '$or': [
                        {'name': {'$regex': pattern, '$options': 'i'}},
                        {'generic_name': {'$regex': pattern, '$options': 'i'}},
                    ]
                }
            )

        if stock_filter == 'low':
            medicines = medicines.filter(
                __raw__={
                    '$expr': {
                        '$and': [
                            {'$lte': ['$stock_quantity', '$reorder_level']},
                            {'$gt': ['$stock_quantity', 0]},
                        ]
                    }
                }
            )
        elif stock_filter == 'out':
            medicines = medicines.filter(stock_quantity=0)

        items, total, has_next = paginate_queryset(medicines, page, page_size)
        serialized = [serialize_medicine(m) for m in items]

        return paginated_response(serialized, page, page_size, total, has_next)


class AddStockView(APIView):
    """
    Add stock to a medicine.

    PATCH /api/v1/pharmacy/inventory/{id}/stock
    """

    permission_classes = [IsPharmacy]

    def patch(self, request, medicine_id):
        """
        Increase stock for a medicine and record the transaction.

        Args:
            request: DRF request with quantity.
            medicine_id: Medicine ObjectId string.

        Returns:
            Response: Updated medicine data.
        """
        try:
            medicine = Medicine.objects.get(id=ObjectId(medicine_id))
        except Medicine.DoesNotExist:
            raise NotFoundError(message="Medicine not found.", code="MEDICINE_NOT_FOUND")

        serializer = AddStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        now = datetime.datetime.utcnow()
        qty = serializer.validated_data['quantity']
        notes = serializer.validated_data.get('notes', 'Stock replenishment')
        hospital_id = ObjectId(request.user.hospital_id)
        pharmacist_id = ObjectId(request.user.id)

        stock_before = medicine.stock_quantity
        stock_after = stock_before + qty

        medicine.stock_quantity = stock_after
        medicine.updated_at = now
        medicine.save()

        InventoryTransaction(
            hospital_id=hospital_id,
            medicine_id=medicine.id,
            transaction_type='in',
            quantity=qty,
            stock_before=stock_before,
            stock_after=stock_after,
            reference_type='stock_update',
            performed_by=pharmacist_id,
            notes=notes,
            created_at=now,
        ).save()

        return success_response(serialize_medicine(medicine))


class AddMedicineView(APIView):
    """
    Add a new medicine to the catalog.

    POST /api/v1/pharmacy/inventory
    """

    permission_classes = [IsPharmacy]

    def post(self, request):
        """
        Create a new medicine document.

        Args:
            request: DRF request with medicine details.

        Returns:
            Response: Created medicine data.
        """
        serializer = AddMedicineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        hospital_id = ObjectId(request.user.hospital_id)
        now = datetime.datetime.utcnow()

        expiry_date = None
        if data.get('expiry_date'):
            expiry_date = datetime.datetime.combine(data['expiry_date'], datetime.time())

        medicine = Medicine(
            hospital_id=hospital_id,
            medicine_uid=f"MED-{uuid.uuid4().hex[:8].upper()}",
            name=data['name'],
            generic_name=data.get('generic_name'),
            category=data.get('category'),
            manufacturer=data.get('manufacturer'),
            unit=data['unit'],
            price_per_unit=data['price_per_unit'],
            stock_quantity=data.get('stock_quantity', 0),
            reorder_level=data.get('reorder_level', 50),
            expiry_date=expiry_date,
            is_active=True,
            created_by=ObjectId(request.user.id),
            created_at=now,
            updated_at=now,
        )
        medicine.save()

        # Record initial stock if > 0
        if medicine.stock_quantity > 0:
            InventoryTransaction(
                hospital_id=hospital_id,
                medicine_id=medicine.id,
                transaction_type='in',
                quantity=medicine.stock_quantity,
                stock_before=0,
                stock_after=medicine.stock_quantity,
                reference_type='stock_update',
                performed_by=ObjectId(request.user.id),
                notes='Initial stock on creation',
                created_at=now,
            ).save()

        return success_response(serialize_medicine(medicine), status=201)


class PharmacyHistoryView(APIView):
    """
    Get pharmacist's completed dispensing history.

    GET /api/v1/pharmacy/history
    """

    permission_classes = [IsPharmacy]

    def get(self, request):
        """
        Return paginated visit history for visits this pharmacist completed.

        Args:
            request: DRF request.

        Returns:
            Response: Paginated archived visit summaries.
        """
        hospital_id = ObjectId(request.user.hospital_id)
        pharmacist_id = ObjectId(request.user.id)
        page, page_size = parse_pagination_params(request)

        visits = Visit.objects(
            hospital_id=hospital_id,
            assignments__pharmacist_id=pharmacist_id,
        ).order_by('-lifecycle__completed_at')

        items, total, has_next = paginate_queryset(visits, page, page_size)
        serialized = [serialize_visit_summary(v) for v in items]

        return paginated_response(serialized, page, page_size, total, has_next)
