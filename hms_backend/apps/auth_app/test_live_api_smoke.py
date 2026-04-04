"""Live Mongo-backed API smoke tests for the HMS backend.

These tests are intentionally opt-in because they exercise the configured
MongoDB connections directly and create temporary records in the real
databases behind this environment.

Run with:
    HMS_RUN_LIVE_API_TESTS=true python manage.py test apps.auth_app.test_live_api_smoke
"""
import hashlib
import os
import unittest
import uuid

import jwt
from bson import ObjectId
from cryptography.fernet import Fernet
from django.conf import settings
from rest_framework.test import APIClient

from apps.patients.models import AuthRefreshToken, Patient, Staff
from apps.patients.serializers import GENERAL_FIELDS
from apps.sessions.models import ActiveSession, AuthBlacklist


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


RUN_LIVE_API_TESTS = _env_flag("HMS_RUN_LIVE_API_TESTS", default=False)


@unittest.skipUnless(
    RUN_LIVE_API_TESTS,
    "Set HMS_RUN_LIVE_API_TESTS=true to run the live Mongo-backed API smoke suite.",
)
class LiveBackendAPISmokeTests(unittest.TestCase):
    """Smoke-test the core auth, patient, and check-in flows against live MongoDB."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._original_fingerprint_key = settings.FINGERPRINT_TEMPLATE_ENCRYPTION_KEY
        try:
            Fernet((cls._original_fingerprint_key or "").encode("utf-8"))
        except Exception:
            settings.FINGERPRINT_TEMPLATE_ENCRYPTION_KEY = Fernet.generate_key().decode()

    @classmethod
    def tearDownClass(cls):
        settings.FINGERPRINT_TEMPLATE_ENCRYPTION_KEY = cls._original_fingerprint_key
        super().tearDownClass()

    def setUp(self):
        self.client = APIClient()
        self.hospital_id = ObjectId(settings.DEFAULT_HOSPITAL_ID)
        self.created_patient_ids = []
        self.created_active_session_ids = []
        self.created_refresh_jtis = set()
        self.created_blacklist_jtis = set()
        self.staff_snapshot = None

    def tearDown(self):
        for session_id in self.created_active_session_ids:
            ActiveSession.objects(id=session_id).delete()

        for patient_id in self.created_patient_ids:
            ActiveSession.objects(patient_id=patient_id).delete()
            Patient.objects(id=patient_id).delete()

        for token_jti in self.created_refresh_jtis:
            AuthRefreshToken.objects(token_jti=token_jti).delete()

        for token_jti in self.created_blacklist_jtis:
            AuthBlacklist.objects(token_jti=token_jti).delete()

        if self.staff_snapshot:
            snapshot = self.staff_snapshot
            if snapshot["last_login_at"] is None:
                Staff.objects(id=snapshot["id"]).update(unset__last_login_at=1)
            else:
                Staff.objects(id=snapshot["id"]).update(
                    set__last_login_at=snapshot["last_login_at"]
                )

        self.client.cookies.clear()

    def test_auth_cookie_flow_persists_and_revokes_live_tokens(self):
        """Login, session bootstrap, refresh rotation, and logout should touch live auth collections."""

        staff = self._login_as_receptionist()

        initial_refresh_token, initial_refresh_payload = self._capture_refresh_cookie()
        self._assert_refresh_token_saved(
            refresh_token=initial_refresh_token,
            refresh_jti=initial_refresh_payload["jti"],
            staff_id=staff.id,
        )

        session_response = self.client.get("/api/v1/auth/session/")
        self.assertEqual(session_response.status_code, 200, session_response.data)
        self.assertEqual(session_response.data["data"]["user"]["email"], staff.email)

        refresh_response = self.client.post("/api/v1/auth/refresh/")
        self.assertEqual(refresh_response.status_code, 200, refresh_response.data)

        rotated_old_token = AuthRefreshToken.objects.get(
            token_jti=initial_refresh_payload["jti"]
        )
        self.assertIsNotNone(rotated_old_token.revoked_at)

        rotated_refresh_token, rotated_refresh_payload = self._capture_refresh_cookie()
        self.assertNotEqual(
            rotated_refresh_payload["jti"],
            initial_refresh_payload["jti"],
        )
        self._assert_refresh_token_saved(
            refresh_token=rotated_refresh_token,
            refresh_jti=rotated_refresh_payload["jti"],
            staff_id=staff.id,
        )

        access_token = self._capture_access_cookie()
        access_payload = self._decode_token(access_token)
        self.created_blacklist_jtis.add(access_payload["jti"])

        logout_response = self.client.post("/api/v1/auth/logout/")
        self.assertEqual(logout_response.status_code, 200, logout_response.data)
        self.assertTrue(logout_response.data["data"]["logged_out"])

        self.assertIsNotNone(
            AuthBlacklist.objects(token_jti=access_payload["jti"]).first()
        )
        self.assertIsNotNone(
            AuthRefreshToken.objects.get(
                token_jti=rotated_refresh_payload["jti"]
            ).revoked_at
        )

        post_logout_session = self.client.get("/api/v1/auth/session/")
        self.assertEqual(post_logout_session.status_code, 401, post_logout_session.data)

    def test_patient_registration_update_and_checkin_hit_live_databases(self):
        """Registering and checking in a patient should persist across the archive and active DBs."""

        self._login_as_receptionist()

        registration_payload = self._build_patient_registration_payload()
        register_response = self.client.post(
            "/api/v1/patients/register/",
            registration_payload,
            format="json",
        )
        self.assertEqual(register_response.status_code, 201, register_response.data)

        patient_id = ObjectId(register_response.data["data"]["patient_id"])
        self.created_patient_ids.append(patient_id)

        patient = Patient.objects.get(id=patient_id, hospital_id=self.hospital_id)
        self.assertEqual(patient.full_name, registration_payload["full_name"])
        self.assertEqual(patient.phone, registration_payload["phone_number"])
        self.assertTrue(getattr(patient.biometric, "fingerprint_template_encrypted", None))
        self.assertFalse(patient.general_data_complete)

        lookup_response = self.client.get(
            "/api/v1/patients/lookup/",
            {"registration_number": patient.registration_number},
        )
        self.assertEqual(lookup_response.status_code, 200, lookup_response.data)
        self.assertEqual(lookup_response.data["data"]["total"], 1)
        self.assertEqual(
            lookup_response.data["data"]["items"][0]["patient_id"],
            str(patient_id),
        )

        fingerprint_response = self.client.get(
            f"/api/v1/patients/{patient_id}/fingerprint-template/"
        )
        self.assertEqual(fingerprint_response.status_code, 200, fingerprint_response.data)
        self.assertEqual(
            fingerprint_response.data["data"]["fingerprint_template"],
            registration_payload["fingerprint_template"],
        )

        general_payload = self._build_patient_general_payload()
        general_response = self.client.patch(
            f"/api/v1/patients/{patient_id}/general/",
            general_payload,
            format="json",
        )
        self.assertEqual(general_response.status_code, 200, general_response.data)

        patient.reload()
        self.assertTrue(patient.general_data_complete)
        self.assertEqual(patient.address.line1, general_payload["address_line1"])
        self.assertEqual(
            patient.addiction_profile.addiction_type,
            general_payload["addiction_type"],
        )
        self.assertEqual(
            patient.emergency_contact.phone,
            general_payload["emergency_contact_phone"],
        )
        self.assertEqual(
            patient.medical_background.current_medications,
            general_payload["current_medications"],
        )

        get_patient_response = self.client.get(f"/api/v1/patients/{patient_id}/")
        self.assertEqual(get_patient_response.status_code, 200, get_patient_response.data)
        self.assertTrue(get_patient_response.data["data"]["general_data_complete"])

        checkin_response = self.client.post(
            "/api/v1/sessions/checkin/",
            {"patient_id": str(patient_id)},
            format="json",
        )
        self.assertEqual(checkin_response.status_code, 201, checkin_response.data)

        active_session_id = ObjectId(checkin_response.data["data"]["session_id"])
        self.created_active_session_ids.append(active_session_id)

        active_session = ActiveSession.objects.get(
            id=active_session_id,
            patient_id=patient_id,
            hospital_id=self.hospital_id,
        )
        self.assertEqual(active_session.patient_name, registration_payload["full_name"])
        self.assertEqual(active_session.status, "checked_in")

        queue_response = self.client.get("/api/v1/receptionist/queue/")
        self.assertEqual(queue_response.status_code, 200, queue_response.data)
        queue_session_ids = {
            item["session_id"] for item in queue_response.data["data"]["items"]
        }
        self.assertIn(str(active_session_id), queue_session_ids)

        patient_list_response = self.client.get(
            "/api/v1/receptionist/patients/",
            {"q": registration_payload["full_name"]},
        )
        self.assertEqual(patient_list_response.status_code, 200, patient_list_response.data)
        patient_ids = {
            item["patient_id"] for item in patient_list_response.data["data"]["items"]
        }
        self.assertIn(str(patient_id), patient_ids)

        dashboard_response = self.client.get("/api/v1/receptionist/dashboard/")
        self.assertEqual(dashboard_response.status_code, 200, dashboard_response.data)
        self.assertGreaterEqual(dashboard_response.data["data"]["todayVisits"], 1)

        reports_response = self.client.get("/api/v1/receptionist/reports/")
        self.assertEqual(reports_response.status_code, 200, reports_response.data)
        daily_patient_ids = {
            item["patient_id"] for item in reports_response.data["data"]["daily"]["items"]
        }
        self.assertIn(str(patient_id), daily_patient_ids)

    def _login_as_receptionist(self):
        email = os.getenv("HMS_LIVE_API_RECEPTION_EMAIL", "reception@hms.com")
        password = os.getenv("HMS_LIVE_API_RECEPTION_PASSWORD", "reception123")

        try:
            staff = Staff.objects.get(hospital_id=self.hospital_id, email=email)
        except Staff.DoesNotExist as exc:
            self.fail(
                "Live API smoke tests need an existing receptionist account. "
                "Set HMS_LIVE_API_RECEPTION_EMAIL/HMS_LIVE_API_RECEPTION_PASSWORD "
                "or seed the baseline staff records first."
            )
            raise exc

        self.staff_snapshot = {
            "id": staff.id,
            "last_login_at": staff.last_login_at,
        }

        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": email, "password": password},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200, login_response.data)

        staff.reload()
        self.assertIsNotNone(staff.last_login_at)
        return staff

    def _build_patient_registration_payload(self) -> dict:
        unique_suffix = uuid.uuid4().hex[:8]
        return {
            "full_name": f"Live API Test {unique_suffix}",
            "phone_number": f"9{uuid.uuid4().int % 1000000000:09d}",
            "date_of_birth": "1991-04-17",
            "sex": "male",
            "patient_category": "deaddiction",
            "file_number": f"LIVE-{unique_suffix.upper()}",
            "aadhaar_number": f"9999-8888-{unique_suffix[:4]}",
            "relative_phone": f"8{uuid.uuid4().int % 1000000000:09d}",
            "address_line1": f"Live Test Street {unique_suffix}",
            "fingerprint_template": f"live-fp-{unique_suffix}",
        }

    def _build_patient_general_payload(self) -> dict:
        payload = {
            "blood_group": "O+",
            "email": f"live-api-{uuid.uuid4().hex[:8]}@example.com",
            "address_line1": "Updated Test Address",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600001",
            "aadhaar_number_last4": "1234",
            "addiction_type": "alcohol",
            "addiction_duration_text": "3 years",
            "emergency_contact_name": "Test Relative",
            "emergency_contact_phone": "9123456780",
            "emergency_contact_relation": "brother",
            "family_history": "No significant family history",
            "medical_history": "No chronic illness",
            "allergies": "None",
            "current_medications": "Vitamin supplements",
            "previous_treatments": "Brief counselling",
        }

        missing_fields = [field for field in GENERAL_FIELDS if field not in payload]
        self.assertEqual(missing_fields, [], f"Missing general fields: {missing_fields}")
        return payload

    def _capture_access_cookie(self) -> str:
        token = self.client.cookies.get(settings.JWT_ACCESS_COOKIE_NAME)
        self.assertIsNotNone(token, "Access cookie is missing from the test client.")
        return token.value

    def _capture_refresh_cookie(self):
        token = self.client.cookies.get(settings.JWT_REFRESH_COOKIE_NAME)
        self.assertIsNotNone(token, "Refresh cookie is missing from the test client.")
        payload = self._decode_token(token.value)
        self.created_refresh_jtis.add(payload["jti"])
        return token.value, payload

    def _decode_token(self, token: str) -> dict:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )

    def _assert_refresh_token_saved(
        self,
        refresh_token: str,
        refresh_jti: str,
        staff_id: ObjectId,
    ):
        refresh_doc = AuthRefreshToken.objects.get(token_jti=refresh_jti)
        self.assertEqual(refresh_doc.staff_id, staff_id)
        self.assertEqual(refresh_doc.hospital_id, self.hospital_id)
        self.assertEqual(
            refresh_doc.token_hash,
            hashlib.sha256(refresh_token.encode("utf-8")).hexdigest(),
        )
