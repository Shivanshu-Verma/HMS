"""URL routes for the doctor app."""
from django.urls import path
from apps.doctor.views import (
    DoctorQueueView, StartConsultationView, ConsultationContextView,
    SaveFindingsView, SavePrescriptionsView, AssignPharmacyView,
    MedicineSearchView, DoctorHistoryView,
)

app_name = 'doctor'

urlpatterns = [
    path('doctor/queue', DoctorQueueView.as_view(), name='doctor-queue'),
    path('doctor/consultations/<str:session_id>/start', StartConsultationView.as_view(), name='start-consultation'),
    path('doctor/consultations/<str:session_id>/context', ConsultationContextView.as_view(), name='consultation-context'),
    path('doctor/consultations/<str:session_id>/findings', SaveFindingsView.as_view(), name='save-findings'),
    path('doctor/consultations/<str:session_id>/prescriptions', SavePrescriptionsView.as_view(), name='save-prescriptions'),
    path('doctor/consultations/<str:session_id>/assign-pharmacy', AssignPharmacyView.as_view(), name='assign-pharmacy'),
    path('medicines/search', MedicineSearchView.as_view(), name='medicine-search'),
    path('doctor/history', DoctorHistoryView.as_view(), name='doctor-history'),
]
