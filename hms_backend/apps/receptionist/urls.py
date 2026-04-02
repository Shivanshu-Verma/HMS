"""URL routes for the receptionist app."""
from django.urls import path
from apps.receptionist.views import (
    PatientListView,
    ReceptionistDashboardView,
    ReceptionistQueueView,
    ReceptionistReportsView,
)

app_name = 'receptionist'

urlpatterns = [
    path('receptionist/reports/', ReceptionistReportsView.as_view(), name='receptionist-reports'),
    path('receptionist/dashboard/', ReceptionistDashboardView.as_view(), name='receptionist-dashboard'),
    path('receptionist/queue/', ReceptionistQueueView.as_view(), name='receptionist-queue'),
    path('receptionist/patients/', PatientListView.as_view(), name='patient-list'),
]
