"""
Authentication views for the HMS backend.

Handles staff login (JWT issuance), token refresh (rotation), and logout
(blacklisting). All token operations use the hms_archive.auth_refresh_tokens
and hms_active.auth_blacklist collections.
"""
import datetime
import hashlib
import logging
import uuid

import jwt
from django.conf import settings
from django.contrib.auth.hashers import check_password
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from apps.auth_app.serializers import LoginSerializer, RefreshSerializer, LogoutSerializer
from apps.patients.models import Staff, AuthRefreshToken
from apps.sessions.models import AuthBlacklist
from utils.response import success_response
from utils.exceptions import HMSError

from bson import ObjectId

logger = logging.getLogger(__name__)


def _generate_access_token(staff_doc) -> tuple:
    """
    Generate a JWT access token for the given staff document.

    Args:
        staff_doc: MongoEngine Staff document.

    Returns:
        tuple: (token_string, jti, expires_at_datetime)
    """
    jti = str(uuid.uuid4())
    now = datetime.datetime.utcnow()
    expires_at = now + datetime.timedelta(minutes=settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES)

    payload = {
        'token_type': 'access',
        'user_id': str(staff_doc.id),
        'role': staff_doc.role,
        'hospital_id': str(staff_doc.hospital_id),
        'email': staff_doc.email,
        'full_name': staff_doc.full_name,
        'jti': jti,
        'iat': now,
        'exp': expires_at,
    }

    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, jti, expires_at


def _generate_refresh_token(staff_doc) -> tuple:
    """
    Generate a refresh token and store its hash in the database.

    Args:
        staff_doc: MongoEngine Staff document.

    Returns:
        tuple: (token_string, jti)
    """
    jti = str(uuid.uuid4())
    now = datetime.datetime.utcnow()
    expires_at = now + datetime.timedelta(days=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS)

    payload = {
        'token_type': 'refresh',
        'user_id': str(staff_doc.id),
        'hospital_id': str(staff_doc.hospital_id),
        'jti': jti,
        'iat': now,
        'exp': expires_at,
    }

    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()

    AuthRefreshToken(
        hospital_id=staff_doc.hospital_id,
        staff_id=staff_doc.id,
        token_jti=jti,
        token_hash=token_hash,
        expires_at=expires_at,
    ).save()

    return token, jti


class LoginView(APIView):
    """
    Authenticate staff and issue JWT access/refresh token pair.

    POST /api/v1/auth/login/
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        """
        Validate credentials and return tokens.

        Args:
            request: DRF request with email and password in body.

        Returns:
            Response: JWT tokens and user profile on success.

        Raises:
            HMSError: On invalid credentials or inactive account.
        """
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        hospital_id = ObjectId(settings.DEFAULT_HOSPITAL_ID)

        try:
            staff = Staff.objects.get(hospital_id=hospital_id, email=email)
        except Staff.DoesNotExist:
            raise HMSError(
                code="INVALID_CREDENTIALS",
                message="Invalid email or password.",
                status_code=401,
            )

        if not staff.is_active:
            raise HMSError(
                code="ACCOUNT_INACTIVE",
                message="This account has been deactivated.",
                status_code=403,
            )

        if not check_password(password, staff.password_hash):
            raise HMSError(
                code="INVALID_CREDENTIALS",
                message="Invalid email or password.",
                status_code=401,
            )

        access_token, access_jti, access_expires = _generate_access_token(staff)
        refresh_token, refresh_jti = _generate_refresh_token(staff)

        # Update last login
        staff.last_login_at = datetime.datetime.utcnow()
        staff.save()

        return success_response({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_type': 'Bearer',
            'expires_in': settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES * 60,
            'user': {
                'id': str(staff.id),
                'full_name': staff.full_name,
                'email': staff.email,
                'role': staff.role,
                'hospital_id': str(staff.hospital_id),
            },
        })


class RefreshTokenView(APIView):
    """
    Rotate refresh token and issue a new access token.

    POST /api/v1/auth/refresh/
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        """
        Validate the refresh token and issue new token pair.

        Args:
            request: DRF request with refresh_token in body.

        Returns:
            Response: New JWT token pair.

        Raises:
            HMSError: On invalid, expired, or revoked refresh token.
        """
        serializer = RefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        refresh_token = serializer.validated_data['refresh_token']

        try:
            payload = jwt.decode(
                refresh_token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
        except jwt.ExpiredSignatureError:
            raise HMSError(code="TOKEN_EXPIRED", message="Refresh token has expired.", status_code=401)
        except jwt.InvalidTokenError:
            raise HMSError(code="INVALID_TOKEN", message="Invalid refresh token.", status_code=401)

        if payload.get('token_type') != 'refresh':
            raise HMSError(code="INVALID_TOKEN", message="Invalid token type.", status_code=401)

        jti = payload.get('jti')
        token_hash = hashlib.sha256(refresh_token.encode('utf-8')).hexdigest()

        # Find the stored refresh token
        try:
            stored_token = AuthRefreshToken.objects.get(token_jti=jti)
        except AuthRefreshToken.DoesNotExist:
            raise HMSError(code="INVALID_TOKEN", message="Refresh token not found.", status_code=401)

        if stored_token.revoked_at is not None:
            raise HMSError(code="TOKEN_REVOKED", message="Refresh token has been revoked.", status_code=403)

        if stored_token.token_hash != token_hash:
            raise HMSError(code="INVALID_TOKEN", message="Token hash mismatch.", status_code=401)

        # Revoke old token
        stored_token.revoked_at = datetime.datetime.utcnow()
        stored_token.save()

        # Get staff for new tokens
        try:
            staff = Staff.objects.get(id=ObjectId(payload['user_id']))
        except Staff.DoesNotExist:
            raise HMSError(code="USER_NOT_FOUND", message="User no longer exists.", status_code=401)

        # Issue new pair
        new_access_token, _, _ = _generate_access_token(staff)
        new_refresh_token, _ = _generate_refresh_token(staff)

        return success_response({
            'access_token': new_access_token,
            'refresh_token': new_refresh_token,
            'expires_in': settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES * 60,
        })


class LogoutView(APIView):
    """
    Invalidate the current access token and optionally revoke the refresh token.

    POST /api/v1/auth/logout/
    """

    def post(self, request):
        """
        Blacklist the current access token JTI and revoke refresh token if provided.

        Args:
            request: DRF request with optional refresh_token in body.

        Returns:
            Response: Success confirmation.
        """
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user

        # Blacklist the access token
        try:
            # Decode the current access token to get its expiry
            token = request.META.get('HTTP_AUTHORIZATION', '')[7:]
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

            AuthBlacklist(
                token_jti=payload['jti'],
                staff_id=ObjectId(user.id),
                hospital_id=ObjectId(user.hospital_id),
                expires_at=datetime.datetime.utcfromtimestamp(payload['exp']),
            ).save()
        except Exception as e:
            logger.warning("Failed to blacklist access token: %s", str(e))

        # Revoke refresh token if provided
        refresh_token = serializer.validated_data.get('refresh_token')
        if refresh_token:
            try:
                refresh_payload = jwt.decode(
                    refresh_token,
                    settings.JWT_SECRET_KEY,
                    algorithms=[settings.JWT_ALGORITHM],
                    options={"verify_exp": False},
                )
                refresh_jti = refresh_payload.get('jti')
                if refresh_jti:
                    AuthRefreshToken.objects(token_jti=refresh_jti).update(
                        set__revoked_at=datetime.datetime.utcnow()
                    )
            except Exception as e:
                logger.warning("Failed to revoke refresh token: %s", str(e))

        return success_response({'success': True})
