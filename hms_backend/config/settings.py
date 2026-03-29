"""
Django settings for the HMS backend project.

Configures Django REST Framework, MongoEngine dual-database connections,
JWT authentication, CORS, and custom exception handling.
"""
import os
from decouple import config, Csv

PORT = os.getenv("PORT", "8000")

# Build paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Security
SECRET_KEY = config('DJANGO_SECRET_KEY', default='django-insecure-change-me-in-production')
DEBUG = config('DJANGO_DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('DJANGO_ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# Application definition
INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'corsheaders',
    'rest_framework',
    'apps.auth_app',
    'apps.patients',
    'apps.receptionist',
    'apps.consultant',
    'apps.doctor',
    'apps.pharmacy',
    'apps.sessions',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'config.urls'

WSGI_APPLICATION = 'config.wsgi.application'

# Database — MongoEngine handles all DB access; Django ORM is unused.
DATABASES = {}

# MongoEngine connection setup
from utils.db import connect_databases  # noqa: E402
connect_databases()

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.auth_app.permissions.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'EXCEPTION_HANDLER': 'utils.exceptions.hms_exception_handler',
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'UNAUTHENTICATED_USER': None,
}

# CORS
# CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='http://localhost:3000', cast=Csv())
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# JWT Configuration
JWT_SECRET_KEY = config('JWT_SECRET_KEY', default=SECRET_KEY)
JWT_ACCESS_TOKEN_LIFETIME_MINUTES = config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=60, cast=int)
JWT_REFRESH_TOKEN_LIFETIME_DAYS = config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)
JWT_ALGORITHM = 'HS256'

# Default hospital ID for single-tenant deployment
DEFAULT_HOSPITAL_ID = config('DEFAULT_HOSPITAL_ID', default='000000000000000000000001')

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = False
USE_TZ = True

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'apps': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}
