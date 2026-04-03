"""Pharmacy endpoints for queue, dispensing, checkout, debt, inventory, and reports."""
import datetime
from collections import defaultdict

from bson import ObjectId
from rest_framework.views import APIView

from apps.auth_app.permissions import IsPharmacy
from apps.patients.models import DispenseItem, Medicine, Patient, Visit
from apps.pharmacy.serializers import (
    AddStockSerializer,
    CheckoutSerializer,
    DebtPaymentSerializer,
    DispenseSubmitSerializer,
    MedicineCreateSerializer,
    MedicineUpdateSerializer,
)
from apps.pharmacy.services import PaymentValidator
from apps.sessions.archive_service import ArchiveService
from apps.sessions.flow import is_pharmacy_stage
from apps.sessions.models import ActiveSession, DispenseItem as ActiveDispenseItem
from utils.exceptions import ConflictError, NotFoundError, ValidationError
from utils.hospital_scope import (
    get_medicine_for_hospital,
    get_patient_for_hospital,
    get_request_hospital_id,
    get_request_user_id,
    get_session_for_hospital,
)
from utils.pagination import parse_pagination_params, paginate_queryset
from utils.response import success_response


def _serialize_medicine(med: Medicine) -> dict:
    return {
        'medicine_id': str(med.id),
        'name': med.name,
        'category': med.category,
        'unit': med.unit,
        'unit_price': float(med.unit_price),
        'stock_quantity': med.stock_quantity,
        'description': med.manufacturer or '',
        'is_active': med.is_active,
    }


def _payment_value(payment, field: str) -> float:
    """Read payment fields from either a dict or a MongoEngine embedded document."""

    if isinstance(payment, dict):
        return float(payment.get(field, 0.0) or 0.0)
    return float(getattr(payment, field, 0.0) or 0.0)


class PharmacyQueueView(APIView):
    """List all currently checked-in active sessions for pharmacy processing."""

    permission_classes = [IsPharmacy]

    def get(self, request):
        hospital_id = get_request_hospital_id(request)
        sessions = ActiveSession.objects(
            hospital_id=hospital_id,
            status='dispensing',
        ).order_by('checked_in_at')

        items = []
        for session in sessions:
            if not is_pharmacy_stage(session):
                continue
            patient = Patient.objects(
                id=session.patient_id,
                hospital_id=hospital_id,
            ).only('outstanding_debt').first()
            items.append(
                {
                    'session_id': str(session.id),
                    'patient_id': str(session.patient_id),
                    'patient_name': session.patient_name,
                    'checked_in_at': session.checked_in_at.isoformat(),
                    'checked_in_by_name': session.checked_in_by_name,
                    'outstanding_debt': float(patient.outstanding_debt if patient else session.outstanding_debt_at_checkin),
                    'session_status': session.status,
                }
            )

        return success_response({'items': items, 'total': len(items)})


class PharmacySessionDetailView(APIView):
    """Return session-level data used by dispensing UI."""

    permission_classes = [IsPharmacy]

    def get(self, request, session_id):
        hospital_id = get_request_hospital_id(request)
        session = get_session_for_hospital(session_id, hospital_id)
        if not is_pharmacy_stage(session):
            raise ConflictError(code='WRONG_STAGE', message='Session is not at the pharmacy stage.')
        patient = get_patient_for_hospital(session.patient_id, hospital_id)

        return success_response(
            {
                'session_id': str(session.id),
                'patient': {
                    'patient_id': str(patient.id),
                    'full_name': patient.full_name,
                    'phone_number': patient.phone,
                    'date_of_birth': patient.date_of_birth.date().isoformat() if patient.date_of_birth else None,
                    'sex': patient.gender,
                    'registration_number': patient.registration_number,
                },
                'outstanding_debt': float(patient.outstanding_debt or 0.0),
                'dispense_items': [
                    {
                        'medicine_id': str(item.medicine_id),
                        'medicine_name': item.medicine_name,
                        'quantity': item.quantity,
                        'unit_price': item.unit_price,
                        'line_total': item.line_total,
                    }
                    for item in session.dispense_items
                ],
                'session_status': session.status,
            }
        )


class PharmacyMedicineSearchView(APIView):
    """Search active medicines with stock for pharmacist dispensing dropdowns."""

    permission_classes = [IsPharmacy]

    def get(self, request):
        hospital_id = get_request_hospital_id(request)
        q = request.query_params.get('q', '').strip()
        page = max(1, int(request.query_params.get('page', 1)))
        page_size = max(1, int(request.query_params.get('pageSize', 20)))

        query = Medicine.objects(
            hospital_id=hospital_id,
            is_active=True,
            stock_quantity__gt=0,
        )
        if q:
            query = query.filter(
                __raw__={
                    '$or': [
                        {'name': {'$regex': q, '$options': 'i'}},
                        {'category': {'$regex': q, '$options': 'i'}},
                    ]
                }
            )

        total = query.count()
        medicines = query.order_by('name').skip((page - 1) * page_size).limit(page_size)

        return success_response(
            {
                'items': [
                    {
                        'medicine_id': str(m.id),
                        'name': m.name,
                        'category': m.category,
                        'unit_price': float(m.unit_price),
                        'stock_quantity': m.stock_quantity,
                    }
                    for m in medicines
                ],
                'pagination': {
                    'page': page,
                    'pageSize': page_size,
                    'total': total,
                },
            }
        )


class PharmacyDispenseView(APIView):
    """Save dispense items to an active session without deducting stock yet."""

    permission_classes = [IsPharmacy]

    def post(self, request, session_id):
        serializer = DispenseSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        hospital_id = get_request_hospital_id(request)
        session = get_session_for_hospital(session_id, hospital_id)
        if not is_pharmacy_stage(session):
            raise ConflictError(code='WRONG_STAGE', message='Session is not at the pharmacy stage.')

        active_items = []
        for item in serializer.validated_data['items']:
            medicine = get_medicine_for_hospital(
                item['medicine_id'],
                hospital_id,
                is_active=True,
            )
            if medicine.stock_quantity < item['quantity']:
                raise ConflictError(
                    code='INSUFFICIENT_STOCK',
                    message=f"Insufficient stock for {medicine.name}",
                )

            line_total = float(item['quantity'] * item['unit_price'])
            active_items.append(
                ActiveDispenseItem(
                    medicine_id=medicine.id,
                    medicine_name=medicine.name,
                    quantity=item['quantity'],
                    unit_price=float(item['unit_price']),
                    line_total=line_total,
                )
            )

        session.dispense_items = active_items
        session.status = 'dispensing'
        session.pharmacy_started_at = session.pharmacy_started_at or datetime.datetime.utcnow()
        session.updated_at = datetime.datetime.utcnow()
        session.save()

        medicines_total = sum(item.line_total for item in active_items)
        return success_response(
            {
                'session_id': str(session.id),
                'status': session.status,
                'dispense_items': [
                    {
                        'medicine_id': str(i.medicine_id),
                        'medicine_name': i.medicine_name,
                        'quantity': i.quantity,
                        'unit_price': i.unit_price,
                        'line_total': i.line_total,
                    }
                    for i in session.dispense_items
                ],
                'medicines_total': medicines_total,
            }
        )


class PharmacyCheckoutView(APIView):
    """Validate payment and close active session into archive transactionally."""

    permission_classes = [IsPharmacy]

    def post(self, request, session_id):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = ArchiveService.close_visit(
            session_id=session_id,
            hospital_id=get_request_hospital_id(request),
            payment_data=serializer.validated_data['payment'],
            pharmacist_id=get_request_user_id(request),
            pharmacist_name=request.user.full_name,
        )
        return success_response(result)


class PharmacyDebtPaymentView(APIView):
    """Settle old debt without creating an active check-in session."""

    permission_classes = [IsPharmacy]

    def post(self, request):
        serializer = DebtPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        hospital_id = get_request_hospital_id(request)
        patient_id = ObjectId(serializer.validated_data['patient_id'])
        payment = serializer.validated_data['payment']

        cash_amount = float(payment.get('cash_amount', 0.0) or 0.0)
        online_amount = float(payment.get('online_amount', 0.0) or 0.0)
        debt_cleared = float(payment.get('debt_cleared', 0.0) or 0.0)

        if abs((cash_amount + online_amount) - debt_cleared) > PaymentValidator.TOLERANCE:
            raise ValidationError(
                code='DEBT_PAYMENT_MISMATCH',
                message='cash_amount + online_amount must equal debt_cleared.',
            )

        patient = get_patient_for_hospital(patient_id, hospital_id)

        if debt_cleared > float(patient.outstanding_debt or 0.0) + PaymentValidator.TOLERANCE:
            raise ValidationError(code='DEBT_CLEARED_EXCEEDS_OUTSTANDING', message='debt_cleared exceeds outstanding debt.')

        debt_before = float(patient.outstanding_debt or 0.0)
        debt_after = float(debt_before - debt_cleared)
        patient.outstanding_debt = debt_after
        patient.updated_at = datetime.datetime.utcnow()
        patient.save()

        visit = Visit(
            hospital_id=patient.hospital_id,
            visit_uid=f"DEBT-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            invoice_number=f"INV-{str(ObjectId())[-8:].upper()}",
            visit_type='debt_payment',
            patient_id=patient.id,
            visit_date=datetime.datetime.utcnow(),
            checked_in_by=None,
            checked_in_by_name='debt-payment',
            dispensed_by=get_request_user_id(request),
            dispensed_by_name=request.user.full_name,
            dispense_items=[],
            medicines_total=0.0,
            payment={
                'method': 'split' if cash_amount > 0 and online_amount > 0 else ('cash' if cash_amount > 0 else 'online'),
                'cash_amount': cash_amount,
                'online_amount': online_amount,
                'new_debt': 0.0,
                'debt_cleared': debt_cleared,
                'total_charged': debt_before,
            },
            debt_snapshot={'debt_before': debt_before, 'debt_after': debt_after},
            created_at=datetime.datetime.utcnow(),
        )
        visit.save()

        patient.visits.append(visit.id)
        patient.visit_ids.append(visit.id)
        patient.visit_count += 1
        patient.last_visit_at = visit.visit_date
        patient.save()

        return success_response({'patient_id': str(patient.id), 'outstanding_debt': debt_after})


class PharmacyInventoryView(APIView):
    """List or create medicines in pharmacy inventory."""

    permission_classes = [IsPharmacy]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        category = request.query_params.get('category', '').strip()
        page = max(1, int(request.query_params.get('page', 1)))
        page_size = max(1, int(request.query_params.get('pageSize', 20)))

        hospital_id = get_request_hospital_id(request)
        query = Medicine.objects(hospital_id=hospital_id)
        if q:
            query = query.filter(name__icontains=q)
        if category:
            query = query.filter(category=category)

        total = query.count()
        medicines = query.order_by('name').skip((page - 1) * page_size).limit(page_size)

        return success_response(
            {
                'items': [_serialize_medicine(m) for m in medicines],
                'pagination': {'page': page, 'pageSize': page_size, 'total': total},
            }
        )

    def post(self, request):
        serializer = MedicineCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        medicine = Medicine(
            hospital_id=ObjectId(request.user.hospital_id),
            medicine_uid=f"MED-{str(ObjectId())[-8:].upper()}",
            name=data['name'],
            category=data['category'],
            unit=data['unit'],
            unit_price=float(data['unit_price']),
            stock_quantity=int(data['stock_quantity']),
            manufacturer=data.get('description', ''),
            is_active=True,
            created_by=ObjectId(request.user.id),
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        )
        medicine.save()

        return success_response(_serialize_medicine(medicine), status=201)


class PharmacyInventoryItemView(APIView):
    """Patch medicine attributes excluding stock quantity."""

    permission_classes = [IsPharmacy]

    def patch(self, request, medicine_id):
        serializer = MedicineUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        hospital_id = get_request_hospital_id(request)
        medicine = get_medicine_for_hospital(medicine_id, hospital_id)

        for field in ['name', 'category', 'unit', 'unit_price', 'is_active']:
            if field in serializer.validated_data:
                setattr(medicine, field, serializer.validated_data[field])

        if 'description' in serializer.validated_data:
            medicine.manufacturer = serializer.validated_data['description']

        medicine.updated_at = datetime.datetime.utcnow()
        medicine.save()

        return success_response(_serialize_medicine(medicine))


class PharmacyAddStockView(APIView):
    """Increment existing stock quantity for a medicine."""

    permission_classes = [IsPharmacy]

    def post(self, request, medicine_id):
        serializer = AddStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        hospital_id = get_request_hospital_id(request)
        medicine = get_medicine_for_hospital(medicine_id, hospital_id)

        medicine.stock_quantity += serializer.validated_data['quantity_to_add']
        medicine.updated_at = datetime.datetime.utcnow()
        medicine.save()

        return success_response(_serialize_medicine(medicine))


class PharmacyReportsView(APIView):
    """Return daily/monthly/yearly pharmacist transaction and revenue metrics."""

    permission_classes = [IsPharmacy]

    def get(self, request):
        hospital_id = ObjectId(request.user.hospital_id)
        now = datetime.datetime.utcnow()
        today = now.date()

        visits = Visit.objects(
            hospital_id=hospital_id,
            visit_type__in=['standard', 'debt_payment'],
            dispensed_by__exists=True,
        )

        day_stats = defaultdict(lambda: {'count': 0, 'revenue': 0.0, 'cash': 0.0, 'online': 0.0, 'debt_added': 0.0, 'debt_cleared': 0.0})
        for visit in visits:
            key = visit.visit_date.date()
            payment = visit.payment or {}
            day_stats[key]['count'] += 1
            day_stats[key]['revenue'] += _payment_value(payment, 'cash_amount') + _payment_value(payment, 'online_amount')
            day_stats[key]['cash'] += _payment_value(payment, 'cash_amount')
            day_stats[key]['online'] += _payment_value(payment, 'online_amount')
            day_stats[key]['debt_added'] += _payment_value(payment, 'new_debt')
            day_stats[key]['debt_cleared'] += _payment_value(payment, 'debt_cleared')

        daily = day_stats.get(today, {'count': 0, 'revenue': 0.0, 'cash': 0.0, 'online': 0.0, 'debt_added': 0.0, 'debt_cleared': 0.0})

        monthly_breakdown = []
        monthly_transactions = 0
        monthly_revenue = 0.0
        cursor = datetime.date(today.year, today.month, 1)
        while cursor.month == today.month:
            stat = day_stats.get(cursor, {'count': 0, 'revenue': 0.0})
            monthly_breakdown.append({'day': cursor.day, 'total_transactions': stat['count'], 'total_revenue': stat['revenue']})
            monthly_transactions += stat['count']
            monthly_revenue += stat['revenue']
            cursor += datetime.timedelta(days=1)

        yearly_breakdown = []
        yearly_transactions = 0
        yearly_revenue = 0.0
        for month in range(1, 13):
            month_transactions = sum(v['count'] for d, v in day_stats.items() if d.year == today.year and d.month == month)
            month_revenue = sum(v['revenue'] for d, v in day_stats.items() if d.year == today.year and d.month == month)
            yearly_breakdown.append({'month': month, 'total_transactions': month_transactions, 'total_revenue': month_revenue})
            yearly_transactions += month_transactions
            yearly_revenue += month_revenue

        return success_response(
            {
                'daily': {
                    'date': today.isoformat(),
                    'total_transactions': daily['count'],
                    'total_revenue': daily['revenue'],
                    'cash_collected': daily['cash'],
                    'online_collected': daily['online'],
                    'debt_added': daily['debt_added'],
                    'debt_cleared': daily['debt_cleared'],
                },
                'monthly': {
                    'year': today.year,
                    'month': today.month,
                    'breakdown': monthly_breakdown,
                    'total_transactions': monthly_transactions,
                    'total_revenue': monthly_revenue,
                },
                'yearly': {
                    'year': today.year,
                    'breakdown': yearly_breakdown,
                    'total_transactions': yearly_transactions,
                    'total_revenue': yearly_revenue,
                },
            }
        )


class PharmacyInvoicesView(APIView):
    """Return paginated pharmacy invoice history for the hospital."""

    permission_classes = [IsPharmacy]

    def get(self, request):
        hospital_id = ObjectId(request.user.hospital_id)
        page, page_size = parse_pagination_params(request)
        q = request.query_params.get('q', '').strip().lower()

        visits_qs = Visit.objects(
            hospital_id=hospital_id,
            visit_type__in=['standard', 'debt_payment'],
            dispensed_by__exists=True,
        ).order_by('-visit_date')

        items, total, has_next = paginate_queryset(visits_qs, page, page_size)

        patient_ids = [v.patient_id for v in items if getattr(v, 'patient_id', None)]
        patient_map = {p.id: p for p in Patient.objects(id__in=patient_ids)} if patient_ids else {}

        invoices = []
        for visit in items:
            payment = getattr(visit, 'payment', None)
            payment_method = getattr(payment, 'method', None) or 'cash'
            cash_amount = float(getattr(payment, 'cash_amount', 0.0) or 0.0)
            online_amount = float(getattr(payment, 'online_amount', 0.0) or 0.0)
            total_charged = float(getattr(payment, 'total_charged', 0.0) or 0.0)

            patient = patient_map.get(visit.patient_id)
            patient_name = patient.full_name if patient else 'Unknown'
            registration_number = patient.registration_number if patient else ''

            invoice_number = getattr(visit, 'invoice_number', None) or f"INV-{str(visit.id)[-8:].upper()}"
            invoice_row = {
                'id': str(visit.id),
                'invoice_number': invoice_number,
                'invoice_date': visit.visit_date.date().isoformat() if visit.visit_date else None,
                'consultation_fee': 0.0,
                'medicine_total': float(getattr(visit, 'medicines_total', 0.0) or 0.0),
                'discount': 0.0,
                'tax': 0.0,
                'grand_total': total_charged,
                'payment_status': 'pending' if payment_method == 'debt' else 'paid',
                'payment_method': payment_method,
                'patient': {
                    'id': str(visit.patient_id),
                    'full_name': patient_name,
                    'registration_number': registration_number,
                },
                'payment_breakdown': {
                    'cash_amount': cash_amount,
                    'online_amount': online_amount,
                },
            }

            if q:
                if (
                    q not in invoice_number.lower()
                    and q not in patient_name.lower()
                    and q not in registration_number.lower()
                ):
                    continue

            invoices.append(invoice_row)

        return success_response(
            {
                'items': invoices,
                'pagination': {
                    'page': page,
                    'pageSize': page_size,
                    'total': total,
                    'hasNextPage': has_next,
                },
            }
        )
