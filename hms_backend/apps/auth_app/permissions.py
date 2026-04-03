"""
Custom DRF authentication and permission classes for the HMS backend.

Provides JWT-based authentication that validates tokens against the blacklist,
and role-based permission classes for each staff role.
"""
import logging

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission
from rest_framework import exceptions

from apps.sessions.models import AuthBlacklist

logger = logging.getLogger(__name__)


class JWTUser:
    """
    Lightweight user object extracted from a validated JWT payload.

    Avoids a database round-trip on every request — the role and IDs
    are already encoded in the token.
    """

    def __init__(self, user_id: str, role: str, hospital_id: str, email: str, full_name: str, jti: str):
        """
        Initialise a JWT user from token claims.

        Args:
            user_id (str): Staff document ObjectId string.
            role (str): Staff role (receptionist, consultant, doctor, pharmacy).
            hospital_id (str): Hospital ObjectId string.
            email (str): Staff email.
            full_name (str): Staff full name.
            jti (str): Unique token identifier for blacklist checking.
        """
        self.id = user_id
        self.role = role
        self.hospital_id = hospital_id
        self.email = email
        self.full_name = full_name
        self.jti = jti
        self.is_authenticated = True


class JWTAuthentication(BaseAuthentication):
    """
    Custom DRF authentication class that validates JWT access tokens.

    Extracts the Bearer token from the Authorization header, decodes it,
    checks the blacklist, and returns a JWTUser instance.
    """

    def authenticate(self, request):
        """
        Authenticate the request by validating the JWT access token.

        Args:
            request: DRF request object.

        Returns:
            tuple: (JWTUser, token_string) if valid, None if no token present.

        Raises:
            AuthenticationFailed: If the token is invalid, expired, or blacklisted.
        """
        token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)

        if not token:
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]

        if not token:
            return None

        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("Access token has expired.")
        except jwt.InvalidTokenError:
            raise exceptions.AuthenticationFailed("Invalid access token.")

        # Check if token type is access
        if payload.get('token_type') != 'access':
            raise exceptions.AuthenticationFailed("Invalid token type.")

        # Check blacklist
        jti = payload.get('jti')
        if jti and _is_token_blacklisted(jti):
            raise exceptions.AuthenticationFailed("Token has been revoked.")

        user = JWTUser(
            user_id=payload.get('user_id'),
            role=payload.get('role'),
            hospital_id=payload.get('hospital_id'),
            email=payload.get('email', ''),
            full_name=payload.get('full_name', ''),
            jti=jti,
        )

        return (user, token)


def _is_token_blacklisted(jti: str) -> bool:
    """
    Check if a token JTI exists in the blacklist.

    Args:
        jti (str): The token's unique identifier.

    Returns:
        bool: True if the token has been blacklisted (logged out).
    """
    try:
        return AuthBlacklist.objects(token_jti=jti).count() > 0
    except Exception:
        # If blacklist check fails, err on the side of allowing access
        # rather than locking out all users
        logger.warning("Failed to check token blacklist for jti=%s", jti)
        return False


# ---------------------------------------------------------------------------
# Role-based permission classes
# ---------------------------------------------------------------------------

class IsReceptionist(BasePermission):
    """Allows access only to staff with the 'receptionist' role."""

    def has_permission(self, request, view):
        """
        Check if the authenticated user has the receptionist role.

        Args:
            request: DRF request with user attribute.
            view: The view being accessed.

        Returns:
            bool: True if user role is 'receptionist'.
        """
        return hasattr(request.user, 'role') and request.user.role == 'receptionist'


class IsConsultant(BasePermission):
    """Allows access only to staff with the 'consultant' role."""

    def has_permission(self, request, view):
        """
        Check if the authenticated user has the consultant role.

        Args:
            request: DRF request with user attribute.
            view: The view being accessed.

        Returns:
            bool: True if user role is 'consultant'.
        """
        return hasattr(request.user, 'role') and request.user.role == 'consultant'


class IsDoctor(BasePermission):
    """Allows access only to staff with the 'doctor' role."""

    def has_permission(self, request, view):
        """
        Check if the authenticated user has the doctor role.

        Args:
            request: DRF request with user attribute.
            view: The view being accessed.

        Returns:
            bool: True if user role is 'doctor'.
        """
        return hasattr(request.user, 'role') and request.user.role == 'doctor'


class IsPharmacy(BasePermission):
    """Allows access only to staff with the 'pharmacy' role."""

    def has_permission(self, request, view):
        """
        Check if the authenticated user has the pharmacy role.

        Args:
            request: DRF request with user attribute.
            view: The view being accessed.

        Returns:
            bool: True if user role is 'pharmacy'.
        """
        return hasattr(request.user, 'role') and request.user.role == 'pharmacy'


class IsAnyStaff(BasePermission):
    """Allows access to any authenticated staff member regardless of role."""

    def has_permission(self, request, view):
        """
        Check if the user is any authenticated staff member.

        Args:
            request: DRF request with user attribute.
            view: The view being accessed.

        Returns:
            bool: True if user has a valid role.
        """
        valid_roles = ('receptionist', 'consultant', 'doctor', 'pharmacy')
        return hasattr(request.user, 'role') and request.user.role in valid_roles


class IsReceptionistOrConsultantOrDoctor(BasePermission):
    """Allows access to receptionist, consultant, or doctor roles."""

    def has_permission(self, request, view):
        """
        Check if the user has receptionist, consultant, or doctor role.

        Args:
            request: DRF request with user attribute.
            view: The view being accessed.

        Returns:
            bool: True if user role is one of the allowed roles.
        """
        allowed = ('receptionist', 'consultant', 'doctor')
        return hasattr(request.user, 'role') and request.user.role in allowed


class IsConsultantOrDoctor(BasePermission):
    """Allows access to consultant or doctor roles."""

    def has_permission(self, request, view):
        """
        Check if the user has consultant or doctor role.

        Args:
            request: DRF request with user attribute.
            view: The view being accessed.

        Returns:
            bool: True if user role is consultant or doctor.
        """
        allowed = ('consultant', 'doctor')
        return hasattr(request.user, 'role') and request.user.role in allowed


class IsDoctorOrPharmacy(BasePermission):
    """Allows access to doctor or pharmacy roles."""

    def has_permission(self, request, view):
        """
        Check if the user has doctor or pharmacy role.

        Args:
            request: DRF request with user attribute.
            view: The view being accessed.

        Returns:
            bool: True if user role is doctor or pharmacy.
        """
        allowed = ('doctor', 'pharmacy')
        return hasattr(request.user, 'role') and request.user.role in allowed


class IsReceptionistOrConsultant(BasePermission):
    """Allows access to receptionist and consultant (counsellor) roles."""

    def has_permission(self, request, view):
        allowed = ('receptionist', 'consultant')
        return hasattr(request.user, 'role') and request.user.role in allowed
