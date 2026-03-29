"""
URL routes for the authentication app.

All routes are prefixed with /api/v1/auth/ by the root URL config.
"""
from django.urls import path
from apps.auth_app.views import LoginView, RefreshTokenView, LogoutView

app_name = 'auth'

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', RefreshTokenView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
]
