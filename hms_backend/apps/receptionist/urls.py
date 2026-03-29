"""URL routes for the receptionist app."""
from django.urls import path
from apps.receptionist.views import CreateVisitView, ActiveVisitsView, AssignCounsellorView

app_name = 'receptionist'

urlpatterns = [
    path('visits', CreateVisitView.as_view(), name='create-visit'),
    path('visits/<str:session_id>/assign-counsellor', AssignCounsellorView.as_view(), name='assign-counsellor'),
    path('visits/active', ActiveVisitsView.as_view(), name='active-visits'),
]
