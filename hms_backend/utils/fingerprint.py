"""
Fingerprint template crypto helpers.

Provides encryption, decryption, and SHA-256 derivation helpers for raw
The raw template is never stored — only its SHA-256 digest.
"""
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

from utils.exceptions import HMSError


def _get_cipher() -> Fernet:
    """
    Build the configured Fernet cipher for fingerprint template encryption.

    Returns:
        Fernet: Cipher instance backed by the configured application key.

    Raises:
        HMSError: If the encryption key is missing or invalid.
    """
    key = settings.FINGERPRINT_TEMPLATE_ENCRYPTION_KEY
    if not key:
        raise HMSError(
            code='FINGERPRINT_ENCRYPTION_NOT_CONFIGURED',
            message='Fingerprint encryption is not configured.',
            status_code=500,
        )

    try:
        return Fernet(key.encode('utf-8'))
    except (ValueError, TypeError) as exc:
        raise HMSError(
            code='FINGERPRINT_ENCRYPTION_INVALID',
            message=(
                'Fingerprint encryption key is invalid. '
                'Expected a Fernet key, for example one generated with '
                '`python -c "from cryptography.fernet import Fernet; '
                'print(Fernet.generate_key().decode())"`.'
            ),
            status_code=500,
        ) from exc


def hash_fingerprint_template(template: str) -> str:
    """
    Compute a SHA-256 hex digest of a fingerprint template string.

    Args:
        template (str): The raw fingerprint template data.

    Returns:
        str: Lowercase hex-encoded SHA-256 hash.
    """
    return hashlib.sha256(template.encode('utf-8')).hexdigest()


def encrypt_fingerprint_template(template: str) -> str:
    """
    Encrypt a raw fingerprint template for storage.

    Args:
        template (str): Raw template captured from the fingerprint device.

    Returns:
        str: Fernet-encrypted template payload.
    """
    return _get_cipher().encrypt(template.encode('utf-8')).decode('utf-8')


def decrypt_fingerprint_template(encrypted_template: str) -> str:
    """
    Decrypt a stored fingerprint template for authorized verification flows.

    Args:
        encrypted_template (str): Fernet-encrypted template payload.

    Returns:
        str: Raw fingerprint template.

    Raises:
        HMSError: If the encrypted payload cannot be decrypted.
    """
    try:
        return _get_cipher().decrypt(encrypted_template.encode('utf-8')).decode('utf-8')
    except InvalidToken as exc:
        raise HMSError(
            code='FINGERPRINT_TEMPLATE_INVALID',
            message='Stored fingerprint template could not be decrypted.',
            status_code=500,
        ) from exc
