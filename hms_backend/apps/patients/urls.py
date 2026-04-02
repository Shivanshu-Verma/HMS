"""
URL routes for the patients app.

All routes are prefixed with /api/v1/ by the root URL config.
"""
from django.urls import path
from apps.patients.views import (
    RegisterPatientView,
    UpdatePatientGeneralView,
    GetPatientView,
    PatientLookupView,
)

app_name = 'patients'

urlpatterns = [
    path('patients/register/', RegisterPatientView.as_view(), name='register-patient'),
    path('patients/lookup/', PatientLookupView.as_view(), name='patient-lookup'),
    path('patients/<str:patient_id>/', GetPatientView.as_view(), name='get-patient'),
    path('patients/<str:patient_id>/general/', UpdatePatientGeneralView.as_view(), name='patient-general-update'),
]
