"""
SHA-256 fingerprint hashing utility.

Provides a one-way hash function for fingerprint templates.
The raw template is never stored — only its SHA-256 digest.
"""
import hashlib


def hash_fingerprint(template: str) -> str:
    """
    Compute a SHA-256 hex digest of a fingerprint template string.

    Args:
        template (str): The raw fingerprint template data (e.g. PID XML or base64 blob).

    Returns:
        str: Lowercase hex-encoded SHA-256 hash.
    """
    return hashlib.sha256(template.encode('utf-8')).hexdigest()
