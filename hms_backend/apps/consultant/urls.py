"""URL routes for the consultant (counsellor) app."""
from django.urls import path
from apps.consultant.views import (
    ConsultantQueueView, StartSessionView, SessionContextView,
    SubmitNotesView, AssignDoctorView, ConsultantHistoryView,
)

app_name = 'consultant'

urlpatterns = [
    path('consultant/queue', ConsultantQueueView.as_view(), name='consultant-queue'),
    path('consultant/sessions/<str:session_id>/start', StartSessionView.as_view(), name='start-session'),
    path('consultant/sessions/<str:session_id>/context', SessionContextView.as_view(), name='session-context'),
    path('consultant/sessions/<str:session_id>/notes', SubmitNotesView.as_view(), name='submit-notes'),
    path('consultant/sessions/<str:session_id>/assign-doctor', AssignDoctorView.as_view(), name='assign-doctor'),
    path('consultant/history', ConsultantHistoryView.as_view(), name='consultant-history'),
]
