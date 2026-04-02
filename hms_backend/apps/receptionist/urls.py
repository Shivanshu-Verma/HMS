"""URL routes for the receptionist app."""
from django.urls import path
from apps.receptionist.views import ReceptionistReportsView

app_name = 'receptionist'

urlpatterns = [
    path('receptionist/reports/', ReceptionistReportsView.as_view(), name='receptionist-reports'),
]
