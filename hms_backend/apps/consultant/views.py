"""Counsellor endpoints for follow-up operations and reporting."""
import datetime

from bson import ObjectId
from django.conf import settings
from rest_framework import serializers
from rest_framework.views import APIView

from apps.auth_app.permissions import IsConsultant
from apps.consultant.serializers import SessionNotesSerializer
from apps.patients.models import Patient, StatusUpdate, Visit
from apps.patients.serializers import serialize_patient
from apps.sessions.flow import is_counsellor_stage
from apps.sessions.models import ActiveSession
from utils.exceptions import ConflictError
from utils.hospital_scope import (
    get_patient_for_hospital,
    get_request_hospital_id,
    get_request_user_id,
    get_session_for_hospital,
)
from utils.pagination import parse_pagination_params, paginate_queryset
from utils.response import success_response, paginated_response


class StatusUpdateSerializer(serializers.Serializer):
    """Payload validator for counsellor-driven patient status updates."""

    status = serializers.ChoiceField(choices=['active', 'inactive', 'dead'], required=True)


class CounsellorFollowupView(APIView):
    """Return active patients overdue for follow-up based on last completed visit."""

    permission_classes = [IsConsultant]

    def get(self, request):
        hospital_id = get_request_hospital_id(request)
        page = max(1, int(request.query_params.get('page', 1)))
        page_size = max(1, int(request.query_params.get('pageSize', 20)))
        skip = (page - 1) * page_size

        threshold_date = datetime.datetime.utcnow() - datetime.timedelta(days=settings.FOLLOWUP_THRESHOLD_DAYS)

        pipeline = [
            {
                '$match': {
                    'hospital_id': hospital_id,
                    'visit_type': {'$in': ['standard', 'debt_payment']},
                }
            },
            {
                '$group': {
                    '_id': '$patient_id',
                    'last_visit_date': {'$max': '$visit_date'},
                }
            },
            {
                '$match': {
                    'last_visit_date': {'$lt': threshold_date},
                }
            },
            {
                '$lookup': {
                    'from': 'patients',
                    'localField': '_id',
                    'foreignField': '_id',
                    'as': 'patient',
                }
            },
            {'$unwind': '$patient'},
            {
                '$match': {
                    'patient.hospital_id': hospital_id,
                    'patient.status': 'active',
                }
            },
            {
                '$addFields': {
                    'days_since_last_visit': {
                        '$dateDiff': {
                            'startDate': '$last_visit_date',
                            'endDate': datetime.datetime.utcnow(),
                            'unit': 'day',
                        }
                    }
                }
            },
            {
                '$project': {
                    '_id': 0,
                    'patient_id': {'$toString': '$patient._id'},
                    'full_name': '$patient.full_name',
                    'phone_number': '$patient.phone',
                    'last_visit_date': 1,
                    'days_since_last_visit': 1,
                    'status': '$patient.status',
                }
            },
            {'$sort': {'last_visit_date': 1}},
            {
                '$facet': {
                    'items': [{'$skip': skip}, {'$limit': page_size}],
                    'total': [{'$count': 'count'}],
                }
            },
        ]

        result = list(Visit._get_collection().aggregate(pipeline))
        bucket = result[0] if result else {'items': [], 'total': []}
        total = bucket['total'][0]['count'] if bucket['total'] else 0

        items = []
        for row in bucket['items']:
            items.append(
                {
                    'patient_id': row['patient_id'],
                    'full_name': row['full_name'],
                    'phone_number': row['phone_number'],
                    'last_visit_date': row['last_visit_date'].isoformat() if row.get('last_visit_date') else None,
                    'days_since_last_visit': row.get('days_since_last_visit', 0),
                    'status': row['status'],
                }
            )

        return success_response(
            {
                'items': items,
                'pagination': {
                    'page': page,
                    'pageSize': page_size,
                    'total': total,
                },
            }
        )


class CounsellorQueueView(APIView):
    """Return active sessions waiting for counsellor action."""

    permission_classes = [IsConsultant]

    def get(self, request):
        hospital_id = get_request_hospital_id(request)
        sessions = ActiveSession.objects(
            hospital_id=hospital_id,
            status='checked_in',
        ).order_by('checked_in_at')

        items = []
        for session in sessions:
            if not is_counsellor_stage(session):
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


class CounsellorSessionDetailView(APIView):
    """Return counsellor session context for a specific active session."""

    permission_classes = [IsConsultant]

    def get(self, request, session_id):
        hospital_id = get_request_hospital_id(request)
        session = get_session_for_hospital(session_id, hospital_id)
        patient = get_patient_for_hospital(session.patient_id, hospital_id)

        return success_response(
            {
                'session_id': str(session.id),
                'patient': {
                    'patient_id': str(patient.id),
                    'registration_number': patient.registration_number,
                    'full_name': patient.full_name,
                    'phone_number': patient.phone,
                    'date_of_birth': patient.date_of_birth.date().isoformat() if patient.date_of_birth else None,
                    'sex': patient.gender,
                    'addiction_type': patient.addiction_profile.addiction_type if patient.addiction_profile else None,
                    'addiction_duration_text': patient.addiction_profile.addiction_duration_text if patient.addiction_profile else None,
                    'allergies': patient.medical_background.allergies if patient.medical_background else None,
                    'medical_history': patient.medical_background.medical_history if patient.medical_background else None,
                },
                'checked_in_at': session.checked_in_at.isoformat() if session.checked_in_at else None,
                'session_status': session.status,
            }
        )


class CounsellorSessionCompleteView(APIView):
    """Persist counsellor session notes and end the active counselling session."""

    permission_classes = [IsConsultant]

    def post(self, request, session_id):
        serializer = SessionNotesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        hospital_id = get_request_hospital_id(request)
        session = get_session_for_hospital(session_id, hospital_id)
        if not is_counsellor_stage(session):
            raise ConflictError(message='Session is not at the counsellor stage.', code='WRONG_STAGE')

        now = datetime.datetime.utcnow()

        if not session.counsellor_started_at:
            session.counsellor_started_at = now

        session.assigned_counsellor_id = get_request_user_id(request)
        session.counsellor_session_notes = serializer.validated_data['session_notes']
        session.counsellor_mood_assessment = serializer.validated_data.get('mood_assessment', 5)
        session.counsellor_risk_level = serializer.validated_data['risk_level']
        session.counsellor_recommendations = serializer.validated_data.get('recommendations', '')
        session.counsellor_follow_up_required = serializer.validated_data.get('follow_up_required', True)
        session.counsellor_completed_at = now
        session.updated_at = now
        session.save()

        return success_response(
            {
                'session_id': str(session.id),
                'status': session.status,
                'session_ended_at': now.isoformat(),
            }
        )


class CounsellorPatientStatusView(APIView):
    """Update patient status and append status update audit row."""

    permission_classes = [IsConsultant]

    def patch(self, request, patient_id):
        serializer = StatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        hospital_id = get_request_hospital_id(request)
        patient = get_patient_for_hospital(patient_id, hospital_id)

        new_status = serializer.validated_data['status']
        old_status = patient.status
        now = datetime.datetime.utcnow()

        entry = StatusUpdate(
            updated_by=get_request_user_id(request),
            updated_by_name=request.user.full_name,
            previous_status=old_status,
            new_status=new_status,
            updated_at=now,
        )

        patient.status = new_status
        patient.status_updates.append(entry)
        patient.updated_at = now
        patient.save()

        return success_response(
            {
                'patient_id': str(patient.id),
                'full_name': patient.full_name,
                'status': patient.status,
                'latest_status_update': {
                    'updated_by': str(entry.updated_by),
                    'updated_by_name': entry.updated_by_name,
                    'previous_status': entry.previous_status,
                    'new_status': entry.new_status,
                    'updated_at': entry.updated_at.isoformat(),
                },
            }
        )


class CounsellorReportsView(APIView):
    """Return daily, monthly, and yearly follow-up totals for current counsellor."""

    permission_classes = [IsConsultant]

    def get(self, request):
        hospital_id = get_request_hospital_id(request)
        user_id = get_request_user_id(request)
        now = datetime.datetime.utcnow()
        today = now.date()

        pipeline = [
            {
                '$match': {
                    'hospital_id': hospital_id,
                    'status_updates.updated_by': user_id,
                }
            },
            {'$unwind': '$status_updates'},
            {
                '$match': {
                    'hospital_id': hospital_id,
                    'status_updates.updated_by': user_id,
                }
            },
            {
                '$project': {
                    'updated_at': '$status_updates.updated_at',
                }
            },
            {
                '$group': {
                    '_id': {
                        'year': {'$year': '$updated_at'},
                        'month': {'$month': '$updated_at'},
                        'day': {'$dayOfMonth': '$updated_at'},
                    },
                    'count': {'$sum': 1},
                }
            },
        ]

        grouped = list(Patient._get_collection().aggregate(pipeline))

        day_map = {}
        for row in grouped:
            key = (row['_id']['year'], row['_id']['month'], row['_id']['day'])
            day_map[key] = row['count']

        daily_total = day_map.get((today.year, today.month, today.day), 0)

        monthly_breakdown = []
        monthly_total = 0
        cursor = datetime.date(today.year, today.month, 1)
        while cursor.month == today.month:
            count = day_map.get((cursor.year, cursor.month, cursor.day), 0)
            monthly_breakdown.append({'day': cursor.day, 'count': count})
            monthly_total += count
            cursor += datetime.timedelta(days=1)

        yearly_breakdown = []
        yearly_total = 0
        for month in range(1, 13):
            month_count = sum(
                value
                for (yr, mon, _), value in day_map.items()
                if yr == today.year and mon == month
            )
            yearly_breakdown.append({'month': month, 'count': month_count})
            yearly_total += month_count

        return success_response(
            {
                'daily': {
                    'date': today.isoformat(),
                    'total_followups': daily_total,
                },
                'monthly': {
                    'year': today.year,
                    'month': today.month,
                    'breakdown': monthly_breakdown,
                    'total': monthly_total,
                },
                'yearly': {
                    'year': today.year,
                    'breakdown': yearly_breakdown,
                    'total': yearly_total,
                },
            }
        )


class CounsellorReportSessionsView(APIView):
    """Return counsellor session rows (including completed) for reports."""

    permission_classes = [IsConsultant]

    def get(self, request):
        hospital_id = ObjectId(request.user.hospital_id)

        sessions = ActiveSession.objects(
            hospital_id=hospital_id,
            counsellor_completed_at__exists=True,
        ).order_by('-checked_in_at')

        items = []
        for session in sessions:
            patient = Patient.objects(
                id=session.patient_id,
                hospital_id=hospital_id,
            ).only(
                'patient_category',
                'registration_number',
                'full_name',
            ).first()

            items.append(
                {
                    'session_id': str(session.id),
                    'patient_id': str(session.patient_id),
                    'patient_name': session.patient_name,
                    'registration_number': patient.registration_number if patient else None,
                    'patient_category': patient.patient_category if patient else None,
                    'checked_in_at': session.checked_in_at.isoformat() if session.checked_in_at else None,
                    'completed_at': session.counsellor_completed_at.isoformat() if session.counsellor_completed_at else None,
                    'session_status': session.status,
                    'session_notes': session.counsellor_session_notes or '',
                    'mood_assessment': session.counsellor_mood_assessment,
                    'risk_level': session.counsellor_risk_level,
                    'recommendations': session.counsellor_recommendations or '',
                    'follow_up_required': bool(session.counsellor_follow_up_required),
                }
            )

        return success_response({'items': items, 'total': len(items)})


class CounsellorPatientListView(APIView):
    """Return a paginated list of patients for counsellor patient-data views."""

    permission_classes = [IsConsultant]

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
