"""URL routes for the sessions app."""
from django.urls import path
from apps.sessions.views import CheckinView

app_name = 'sessions'

urlpatterns = [
	path('sessions/checkin/', CheckinView.as_view(), name='session-checkin'),
]
