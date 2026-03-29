"""
MongoEngine multi-database connection setup.

Registers two database aliases:
  - 'archive' → hms_archive (permanent patient records, visits, staff, medicines)
  - 'active'  → hms_active  (in-progress sessions, locks, token blacklist)

Both URIs are read from environment variables. Called from config/settings.py
during Django startup.
"""
import mongoengine
from decouple import config


def connect_databases():
    """
    Register MongoEngine connections for both HMS databases.

    Reads connection URIs and database names from environment variables.
    Must be called once during application startup (from settings.py).

    Raises:
        mongoengine.ConnectionFailure: If a connection URI is malformed or unreachable.
    """
    archive_uri = config('MONGODB_ARCHIVE_URI', default='mongodb://localhost:27017/hms_archive')
    active_uri = config('MONGODB_ACTIVE_URI', default='mongodb://localhost:27017/hms_active')
    archive_db = config('MONGODB_ARCHIVE_DB', default='hms_archive')
    active_db = config('MONGODB_ACTIVE_DB', default='hms_active')

    mongoengine.connect(
        db=archive_db,
        alias='archive',
        host=archive_uri,
    )

    mongoengine.connect(
        db=active_db,
        alias='active',
        host=active_uri,
    )
