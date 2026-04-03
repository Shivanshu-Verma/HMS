"""Receptionist reports and dashboard endpoints."""
import datetime
from collections import defaultdict

from bson import ObjectId
from rest_framework.views import APIView

from apps.auth_app.permissions import IsReceptionist
from apps.patients.models import Patient, Visit
from apps.patients.serializers import serialize_patient
from apps.sessions.flow import get_active_session_stage, is_counsellor_stage, is_doctor_stage, is_pharmacy_stage
from apps.sessions.models import ActiveSession
from utils.pagination import parse_pagination_params, paginate_queryset
from utils.response import paginated_response, success_response


class ReceptionistReportsView(APIView):
    """Return daily, monthly, and yearly check-in activity for the hospital."""

    permission_classes = [IsReceptionist]

    def get(self, request):
        hospital_id = ObjectId(request.user.hospital_id)

        now = datetime.datetime.utcnow()
        today = now.date()
        year = today.year
        month = today.month

        year_start = datetime.datetime(year, 1, 1)
        month_start = datetime.datetime(year, month, 1)
        next_month = datetime.datetime(year + 1, 1, 1) if month == 12 else datetime.datetime(year, month + 1, 1)

        visits = Visit.objects(
            hospital_id=hospital_id,
            visit_date__gte=year_start,
        )

        day_counts = defaultdict(int)
        for visit in visits:
            key = visit.visit_date.date()
            day_counts[key] += 1

        # Include today's in-progress active sessions so today's count is current.
        today_start = datetime.datetime(today.year, today.month, today.day)
        tomorrow_start = today_start + datetime.timedelta(days=1)

        today_active_sessions = list(
            ActiveSession.objects(
            hospital_id=hospital_id,
            checked_in_at__gte=today_start,
            checked_in_at__lt=tomorrow_start,
            )
        )
        active_today = len(today_active_sessions)

        today_archived_visits = list(
            Visit.objects(
                hospital_id=hospital_id,
                visit_date__gte=today_start,
                visit_date__lt=tomorrow_start,
            )
        )

        archived_today = day_counts.get(today, 0)
        daily_total = archived_today + active_today

        patient_ids = set()
        for visit in today_archived_visits:
            if visit.patient_id:
                patient_ids.add(visit.patient_id)
        for session in today_active_sessions:
            if session.patient_id:
                patient_ids.add(session.patient_id)

        patient_map = {
            p.id: p
            for p in Patient.objects(
                hospital_id=hospital_id,
                id__in=list(patient_ids),
            )
        }

        psychiatric_visits = 0
        deaddiction_visits = 0
        daily_items = []

        for visit in today_archived_visits:
            patient = patient_map.get(visit.patient_id)
            category = getattr(patient, 'patient_category', None)
            if category == 'psychiatric':
                psychiatric_visits += 1
            elif category == 'deaddiction':
                deaddiction_visits += 1

            visit_status = getattr(getattr(visit, 'lifecycle', None), 'status', 'completed')
            normalized_status = 'completed' if visit_status == 'completed' else 'in_progress'

            stage = 'completed'
            lifecycle = getattr(visit, 'lifecycle', None)
            if lifecycle and getattr(lifecycle, 'current_stage', None):
                stage = lifecycle.current_stage

            daily_items.append({
                'id': str(visit.id),
                'patient_id': str(visit.patient_id),
                'visit_date': visit.visit_date.date().isoformat() if visit.visit_date else today.isoformat(),
                'visit_number': getattr(visit, 'visit_number', 0) or 0,
                'current_stage': stage,
                'checkin_time': lifecycle.checkin_at.isoformat() if lifecycle and getattr(lifecycle, 'checkin_at', None) else (visit.visit_date.isoformat() if visit.visit_date else None),
                'status': normalized_status,
                'patient': {
                    'registration_number': patient.registration_number if patient else (getattr(getattr(visit, 'patient_snapshot', None), 'registration_number', None) or ''),
                    'full_name': patient.full_name if patient else (getattr(getattr(visit, 'patient_snapshot', None), 'full_name', None) or ''),
                    'phone': patient.phone if patient else (getattr(getattr(visit, 'patient_snapshot', None), 'phone', None) or ''),
                    'date_of_birth': patient.date_of_birth.date().isoformat() if patient and patient.date_of_birth else None,
                    'gender': patient.gender if patient else (getattr(getattr(visit, 'patient_snapshot', None), 'gender', None) or 'other'),
                    'patient_category': category,
                },
            })

        for session in today_active_sessions:
            patient = patient_map.get(session.patient_id)
            category = getattr(patient, 'patient_category', None)
            if category == 'psychiatric':
                psychiatric_visits += 1
            elif category == 'deaddiction':
                deaddiction_visits += 1

            stage = get_active_session_stage(session)

            daily_items.append({
                'id': f'active-{str(session.id)}',
                'patient_id': str(session.patient_id),
                'visit_date': session.checked_in_at.date().isoformat() if session.checked_in_at else today.isoformat(),
                'visit_number': 0,
                'current_stage': stage,
                'checkin_time': session.checked_in_at.isoformat() if session.checked_in_at else None,
                'status': 'in_progress',
                'patient': {
                    'registration_number': patient.registration_number if patient else '',
                    'full_name': patient.full_name if patient else (session.patient_name or ''),
                    'phone': patient.phone if patient else '',
                    'date_of_birth': patient.date_of_birth.date().isoformat() if patient and patient.date_of_birth else None,
                    'gender': patient.gender if patient else 'other',
                    'patient_category': category,
                },
            })

        monthly_breakdown = []
        monthly_total = 0
        cursor = month_start
        while cursor < next_month:
            count = day_counts.get(cursor.date(), 0)
            if cursor.date() == today:
                count += active_today
            monthly_breakdown.append({'day': cursor.day, 'count': count})
            monthly_total += count
            cursor += datetime.timedelta(days=1)

        yearly_breakdown = []
        yearly_total = 0
        for idx in range(1, 13):
            month_count = sum(count for dt, count in day_counts.items() if dt.year == year and dt.month == idx)
            if idx == month:
                month_count += active_today
            yearly_breakdown.append({'month': idx, 'count': month_count})
            yearly_total += month_count

        payload = {
            'daily': {
                'date': today.isoformat(),
                'archived_checkins': archived_today,
                'active_checkins': active_today,
                'total_checkins': daily_total,
                'completed_checkins': archived_today,
                'psychiatric_visits': psychiatric_visits,
                'deaddiction_visits': deaddiction_visits,
                'items': sorted(daily_items, key=lambda item: item.get('checkin_time') or '', reverse=True),
            },
            'monthly': {
                'year': year,
                'month': month,
                'breakdown': monthly_breakdown,
                'total_checkins': monthly_total,
            },
            'yearly': {
                'year': year,
                'breakdown': yearly_breakdown,
                'total_checkins': yearly_total,
            },
        }
        return success_response(payload)


class ReceptionistDashboardView(APIView):
    """Return aggregate dashboard stats for the reception screen."""

    permission_classes = [IsReceptionist]

    def get(self, request):
        hospital_id = ObjectId(request.user.hospital_id)

        now = datetime.datetime.utcnow()
        today_start = datetime.datetime(now.year, now.month, now.day)
        tomorrow_start = today_start + datetime.timedelta(days=1)

        total_patients = Patient.objects(hospital_id=hospital_id).count()

        # Active sessions give us the in-progress queue counts
        active_sessions = ActiveSession.objects(hospital_id=hospital_id)

        # Today's active sessions (checked in today)
        today_active = active_sessions.filter(
            checked_in_at__gte=today_start,
            checked_in_at__lt=tomorrow_start,
        ).count()

        # Today's completed visits (archived)
        completed_today = Visit.objects(
            hospital_id=hospital_id,
            visit_date__gte=today_start,
            visit_date__lt=tomorrow_start,
        ).count()

        today_visits = today_active + completed_today

        # Status-based queue counts from active sessions
        active_session_list = list(active_sessions)
        pending_counsellor = sum(1 for session in active_session_list if is_counsellor_stage(session))
        pending_doctor = sum(1 for session in active_session_list if is_doctor_stage(session))
        pending_pharmacy = sum(1 for session in active_session_list if is_pharmacy_stage(session))

        payload = {
            'totalPatients': total_patients,
            'todayVisits': today_visits,
            'pendingCounsellor': pending_counsellor,
            'pendingDoctor': pending_doctor,
            'pendingPharmacy': pending_pharmacy,
            'completedToday': completed_today,
        }
        return success_response(payload)


class ReceptionistQueueView(APIView):
    """Return the list of active sessions for the queue view."""

    permission_classes = [IsReceptionist]

    def get(self, request):
        hospital_id = ObjectId(request.user.hospital_id)

        sessions = ActiveSession.objects(
            hospital_id=hospital_id,
        ).order_by('-checked_in_at')

        items = []
        for s in sessions:
            # Determine current stage
            stage = get_active_session_stage(s)

            items.append({
                'session_id': str(s.id),
                'patient_id': str(s.patient_id),
                'patient_name': s.patient_name,
                'checked_in_at': s.checked_in_at.isoformat() if s.checked_in_at else None,
                'checked_in_by_name': s.checked_in_by_name,
                'status': s.status,
                'current_stage': stage,
                'outstanding_debt': float(s.outstanding_debt_at_checkin or 0),
            })

        return success_response({'items': items, 'total': len(items)})


class PatientListView(APIView):
    """Return a paginated list of patients with optional text search."""

    permission_classes = [IsReceptionist]

    def get(self, request):
        hospital_id = ObjectId(request.user.hospital_id)
        page, page_size = parse_pagination_params(request)
        q = request.query_params.get('q', '').strip()

        qs = Patient.objects(hospital_id=hospital_id).order_by('-updated_at')

        if q:
            qs = qs.filter(
                __raw__={
                    '$or': [
                        {'full_name': {'$regex': q, '$options': 'i'}},
                        {'registration_number': {'$regex': q, '$options': 'i'}},
                        {'phone': {'$regex': q, '$options': 'i'}},
                    ]
                }
            )

        items, total, has_next = paginate_queryset(qs, page, page_size)
        serialized = [serialize_patient(p) for p in items]

        return paginated_response(serialized, page, page_size, total, has_next)
