"""URL routes for the consultant (counsellor) app."""
from django.urls import path
from apps.consultant.views import (
    CounsellorFollowupView,
    CounsellorPatientStatusView,
    CounsellorPatientListView,
    CounsellorReportsView,
    CounsellorReportSessionsView,
    CounsellorQueueView,
    CounsellorSessionDetailView,
    CounsellorSessionCompleteView,
)

app_name = 'consultant'

urlpatterns = [
    path('counsellor/queue/', CounsellorQueueView.as_view(), name='counsellor-queue'),
    path('counsellor/session/<str:session_id>/', CounsellorSessionDetailView.as_view(), name='counsellor-session-detail'),
    path('counsellor/session/<str:session_id>/complete/', CounsellorSessionCompleteView.as_view(), name='counsellor-session-complete'),
    path('counsellor/followup/', CounsellorFollowupView.as_view(), name='counsellor-followup'),
    path('counsellor/patients/', CounsellorPatientListView.as_view(), name='counsellor-patients'),
    path('counsellor/patients/<str:patient_id>/status/', CounsellorPatientStatusView.as_view(), name='counsellor-patient-status'),
    path('counsellor/reports/', CounsellorReportsView.as_view(), name='counsellor-reports'),
    path('counsellor/reports/sessions/', CounsellorReportSessionsView.as_view(), name='counsellor-report-sessions'),
]
