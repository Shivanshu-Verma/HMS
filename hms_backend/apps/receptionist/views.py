"""Receptionist reports endpoints."""
import datetime
from collections import defaultdict

from bson import ObjectId
from rest_framework.views import APIView

from apps.auth_app.permissions import IsReceptionist
from apps.patients.models import Visit
from apps.sessions.models import ActiveSession
from utils.response import success_response


class ReceptionistReportsView(APIView):
    """Return daily, monthly, and yearly check-in activity for the requesting receptionist."""

    permission_classes = [IsReceptionist]

    def get(self, request):
        staff_id = ObjectId(request.user.id)
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
            checked_in_by=staff_id,
            visit_date__gte=year_start,
        )

        day_counts = defaultdict(int)
        for visit in visits:
            key = visit.visit_date.date()
            day_counts[key] += 1

        # Include today's in-progress active sessions so today's count is current.
        today_start = datetime.datetime(today.year, today.month, today.day)
        tomorrow_start = today_start + datetime.timedelta(days=1)
        active_today = ActiveSession.objects(
            hospital_id=hospital_id,
            checked_in_by=staff_id,
            checked_in_at__gte=today_start,
            checked_in_at__lt=tomorrow_start,
        ).count()

        archived_today = day_counts.get(today, 0)
        daily_total = archived_today + active_today

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
                'total_checkins': daily_total,
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
