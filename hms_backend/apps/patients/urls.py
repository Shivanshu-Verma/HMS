"""
URL routes for the patients app.

All routes are prefixed with /api/v1/ by the root URL config.
"""
from django.urls import path
from apps.patients.views import (
    RegisterPatientView, GetPatientView, GetPatientByRegistrationView,
    LookupFingerprintView, PatientSearchView, PatientSummaryView,
    PatientHistoryView, VisitDetailView,
)

app_name = 'patients'

urlpatterns = [
    path('patients', RegisterPatientView.as_view(), name='register-patient'),
    path('patients/search', PatientSearchView.as_view(), name='search-patients'),
    path('patients/lookup-fingerprint', LookupFingerprintView.as_view(), name='lookup-fingerprint'),
    path('patients/by-registration/<str:registration_number>', GetPatientByRegistrationView.as_view(), name='patient-by-reg'),
    path('patients/<str:patient_id>', GetPatientView.as_view(), name='get-patient'),
    path('patients/<str:patient_id>/summary', PatientSummaryView.as_view(), name='patient-summary'),
    path('patients/<str:patient_id>/history', PatientHistoryView.as_view(), name='patient-history'),
    path('visits/<str:visit_id>/detail', VisitDetailView.as_view(), name='visit-detail'),
]
