"""Helpers for deriving the current lifecycle stage of an active session."""


def is_counsellor_stage(session) -> bool:
    """Return True when the active session is waiting on counsellor completion."""

    return session.status == 'checked_in' and not session.counsellor_completed_at


def is_doctor_stage(session) -> bool:
    """Return True when counsellor is done and doctor has not completed yet."""

    return (
        session.status == 'checked_in'
        and bool(session.counsellor_completed_at)
        and not session.doctor_completed_at
    )


def is_pharmacy_stage(session) -> bool:
    """Return True when the session has been forwarded to pharmacy."""

    return session.status == 'dispensing'


def get_active_session_stage(session) -> str:
    """Derive the current active workflow stage from the flat session fields."""

    if is_pharmacy_stage(session):
        return 'pharmacy'
    if is_doctor_stage(session):
        return 'doctor'
    if is_counsellor_stage(session):
        return 'counsellor'
    if session.status == 'completed':
        return 'completed'
    return 'unknown'
