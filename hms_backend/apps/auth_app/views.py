"""
Authentication views for the HMS backend.

Handles cookie-based staff login, session bootstrap, refresh rotation, and
logout. Refresh-token persistence and access-token blacklist checks continue to
use the hms_archive.auth_refresh_tokens and hms_active.auth_blacklist
collections.
"""
import datetime
import hashlib
import logging
import uuid

import jwt
from bson import ObjectId
from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.middleware import csrf
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.auth_app.permissions import JWTAuthentication
from apps.auth_app.serializers import LoginSerializer
from apps.patients.models import AuthRefreshToken, Staff
from apps.sessions.models import AuthBlacklist
from utils.exceptions import HMSError
from utils.response import success_response

logger = logging.getLogger(__name__)


def _cookie_domain():
    """
    Return the configured cookie domain or None when unset.

    Returns:
        str | None: Cookie domain for auth and CSRF cookies.
    """
    return settings.JWT_COOKIE_DOMAIN or None


def _set_auth_cookie(response, name: str, value: str, max_age: int, path: str) -> None:
    """
    Attach an auth cookie to the response using central security settings.

    Args:
        response: DRF response object.
        name (str): Cookie name.
        value (str): Cookie value.
        max_age (int): Cookie lifetime in seconds.
        path (str): Cookie path scope.
    """
    response.set_cookie(
        key=name,
        value=value,
        max_age=max_age,
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        domain=_cookie_domain(),
        path=path,
    )


def _clear_auth_cookie(response, name: str, path: str) -> None:
    """
    Clear an auth cookie from the response.

    Args:
        response: DRF response object.
        name (str): Cookie name.
        path (str): Cookie path scope.
    """
    response.delete_cookie(
        key=name,
        domain=_cookie_domain(),
        path=path,
        samesite=settings.JWT_COOKIE_SAMESITE,
    )


def _serialize_user(staff_doc) -> dict:
    """
    Serialize the authenticated staff payload returned to the frontend.

    Args:
        staff_doc: MongoEngine staff document.

    Returns:
        dict: Public user/session metadata.
    """
    return {
        'id': str(staff_doc.id),
        'full_name': staff_doc.full_name,
        'email': staff_doc.email,
        'role': staff_doc.role,
        'hospital_id': str(staff_doc.hospital_id),
    }


def _serialize_jwt_user(jwt_user) -> dict:
    """
    Serialize the lightweight JWT user returned by the auth backend.

    Args:
        jwt_user: JWTUser object created by the authentication backend.

    Returns:
        dict: Public user/session metadata.
    """
    return {
        'id': jwt_user.id,
        'full_name': jwt_user.full_name,
        'email': jwt_user.email,
        'role': jwt_user.role,
        'hospital_id': jwt_user.hospital_id,
    }


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


def _generate_refresh_token(staff_doc, request) -> tuple:
    """
    Generate a refresh token and store its hash in the database.

    Args:
        staff_doc: MongoEngine Staff document.
        request: DRF request used for device metadata capture.

    Returns:
        tuple: (token_string, jti, expires_at_datetime)
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
        user_agent=request.META.get('HTTP_USER_AGENT', ''),
        ip_address=request.META.get('REMOTE_ADDR', ''),
        expires_at=expires_at,
    ).save()

    return token, jti, expires_at


def _issue_auth_response(request, staff_doc, access_token: str, refresh_token: str):
    """
    Build the login/refresh response and attach auth cookies.

    Args:
        request: DRF request.
        staff_doc: Staff document being authenticated.
        access_token (str): Signed access token.
        refresh_token (str): Signed refresh token.

    Returns:
        Response: Success response carrying the user payload and auth cookies.
    """
    response = success_response({
        'user': _serialize_user(staff_doc),
        'expires_in': settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES * 60,
    })

    _set_auth_cookie(
        response,
        settings.JWT_ACCESS_COOKIE_NAME,
        access_token,
        settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES * 60,
        '/',
    )
    _set_auth_cookie(
        response,
        settings.JWT_REFRESH_COOKIE_NAME,
        refresh_token,
        settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60,
        settings.JWT_REFRESH_COOKIE_PATH,
    )

    csrf.get_token(request)
    return response


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    """
    Authenticate staff and set cookie-based JWT access and refresh tokens.

    POST /api/v1/auth/login/
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        """
        Validate credentials and start a cookie-backed authenticated session.

        Args:
            request: DRF request with email and password in body.

        Returns:
            Response: Authenticated user profile and auth cookies on success.

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

        access_token, _, _ = _generate_access_token(staff)
        refresh_token, _, _ = _generate_refresh_token(staff, request)

        staff.last_login_at = datetime.datetime.utcnow()
        staff.save()

        return _issue_auth_response(request, staff, access_token, refresh_token)


class SessionView(APIView):
    """
    Return the current authenticated session for frontend bootstrap.

    GET /api/v1/auth/session/
    """

    permission_classes = [AllowAny]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        """
        Return the current authenticated user and ensure the CSRF cookie exists.

        Args:
            request: DRF request object.

        Returns:
            Response: Authenticated user payload for frontend bootstrap.

        Raises:
            HMSError: If no valid authenticated session exists.
        """
        csrf.get_token(request)

        if not getattr(request, 'user', None):
            raise HMSError(
                code='UNAUTHORIZED',
                message='No active authenticated session.',
                status_code=401,
            )

        return success_response({
            'user': _serialize_jwt_user(request.user),
            'expires_in': settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES * 60,
        })


class RefreshTokenView(APIView):
    """
    Rotate the refresh token cookie and issue a new access token cookie.

    POST /api/v1/auth/refresh/
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        """
        Validate the refresh cookie and issue a fresh cookie pair.

        Args:
            request: DRF request using a refresh token cookie.

        Returns:
            Response: Updated user payload with rotated auth cookies.

        Raises:
            HMSError: On invalid, expired, or revoked refresh token.
        """
        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not refresh_token:
            raise HMSError(code="INVALID_TOKEN", message="Refresh token cookie is missing.", status_code=401)

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

        token_hash = hashlib.sha256(refresh_token.encode('utf-8')).hexdigest()

        try:
            stored_token = AuthRefreshToken.objects.get(token_jti=payload.get('jti'))
        except AuthRefreshToken.DoesNotExist:
            raise HMSError(code="INVALID_TOKEN", message="Refresh token not found.", status_code=401)

        if stored_token.revoked_at is not None:
            raise HMSError(code="TOKEN_REVOKED", message="Refresh token has been revoked.", status_code=403)

        if stored_token.token_hash != token_hash:
            raise HMSError(code="INVALID_TOKEN", message="Token hash mismatch.", status_code=401)

        stored_token.revoked_at = datetime.datetime.utcnow()
        stored_token.save()

        try:
            staff = Staff.objects.get(id=ObjectId(payload['user_id']))
        except Staff.DoesNotExist:
            raise HMSError(code="USER_NOT_FOUND", message="User no longer exists.", status_code=401)

        new_access_token, _, _ = _generate_access_token(staff)
        new_refresh_token, _, _ = _generate_refresh_token(staff, request)
        return _issue_auth_response(request, staff, new_access_token, new_refresh_token)


class LogoutView(APIView):
    """
    Invalidate the current cookie-backed session.

    POST /api/v1/auth/logout/
    """

    def post(self, request):
        """
        Blacklist the current access token and clear auth cookies.

        Args:
            request: Authenticated DRF request.

        Returns:
            Response: Success confirmation with cleared auth cookies.
        """
        user = request.user

        try:
            token = request.auth or request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

            AuthBlacklist(
                token_jti=payload['jti'],
                staff_id=ObjectId(user.id),
                hospital_id=ObjectId(user.hospital_id),
                expires_at=datetime.datetime.utcfromtimestamp(payload['exp']),
            ).save()
        except Exception as exc:
            logger.warning("Failed to blacklist access token: %s", str(exc))

        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
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
            except Exception as exc:
                logger.warning("Failed to revoke refresh token: %s", str(exc))

        response = success_response({'logged_out': True})
        _clear_auth_cookie(response, settings.JWT_ACCESS_COOKIE_NAME, '/')
        _clear_auth_cookie(response, settings.JWT_REFRESH_COOKIE_NAME, settings.JWT_REFRESH_COOKIE_PATH)
        return response
