"""
Root URL configuration for the HMS backend.

All API endpoints are versioned under /api/v1/ and delegated to app-level URL configs.
"""
from django.urls import path, include

urlpatterns = [
    path('api/v1/auth/', include('apps.auth_app.urls')),
    path('api/v1/', include('apps.patients.urls')),
    path('api/v1/', include('apps.receptionist.urls')),
    path('api/v1/', include('apps.consultant.urls')),
    path('api/v1/', include('apps.doctor.urls')),
    path('api/v1/', include('apps.pharmacy.urls')),
    path('api/v1/', include('apps.sessions.urls')),
]
