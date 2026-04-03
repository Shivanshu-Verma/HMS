"""Live coverage for follow-up, patient-status, and debt-payment APIs."""
import datetime
import os
import unittest
import uuid

import jwt
from bson import ObjectId
from cryptography.fernet import Fernet
from django.conf import settings
from rest_framework.test import APIClient

from apps.patients.models import AuthRefreshToken, Patient, Staff, Visit


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
class LiveFollowupAndDebtTests(unittest.TestCase):
    """Exercise the remaining consultant and pharmacy routes against live MongoDB."""

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
        self.hospital_id = ObjectId(settings.DEFAULT_HOSPITAL_ID)
        self.created_patient_ids = []
        self.created_visit_ids = []
        self.created_refresh_jtis = set()
        self.staff_snapshots = {}

    def tearDown(self):
        for visit_id in self.created_visit_ids:
            Visit.objects(id=visit_id).delete()
        for patient_id in self.created_patient_ids:
            Patient.objects(id=patient_id).delete()
        for token_jti in self.created_refresh_jtis:
            AuthRefreshToken.objects(token_jti=token_jti).delete()
        for snapshot in self.staff_snapshots.values():
            if snapshot["last_login_at"] is None:
                Staff.objects(id=snapshot["id"]).update(unset__last_login_at=1)
            else:
                Staff.objects(id=snapshot["id"]).update(
                    set__last_login_at=snapshot["last_login_at"]
                )

    def test_followup_status_reporting_and_debt_payment_apis(self):
        receptionist_client, _ = self._login("receptionist")
        consultant_client, _ = self._login("consultant")
        pharmacy_client, _ = self._login("pharmacy")

        suffix = uuid.uuid4().hex[:8]
        register_response = receptionist_client.post(
            "/api/v1/patients/register/",
            {
                "full_name": f"Live Followup {suffix}",
                "phone_number": f"9{uuid.uuid4().int % 1000000000:09d}",
                "date_of_birth": "1991-04-17",
                "sex": "male",
                "patient_category": "deaddiction",
                "file_number": f"LIVE-{uuid.uuid4().hex[:8].upper()}",
                "aadhaar_number": f"9999-8888-{uuid.uuid4().hex[:4]}",
                "relative_phone": f"8{uuid.uuid4().int % 1000000000:09d}",
                "address_line1": f"Followup Test Street {suffix}",
                "fingerprint_template": f"live-fp-followup-{suffix}",
            },
            format="json",
        )
        self.assertEqual(register_response.status_code, 201, register_response.data)
        patient_id = ObjectId(register_response.data["data"]["patient_id"])
        self.created_patient_ids.append(patient_id)

        consultant_patients = consultant_client.get(
            "/api/v1/counsellor/patients/",
            {"q": f"Live Followup {suffix}"},
        )
        self.assertEqual(consultant_patients.status_code, 200, consultant_patients.data)
        self.assertIn(
            str(patient_id),
            {item["patient_id"] for item in consultant_patients.data["data"]["items"]},
        )

        status_response = consultant_client.patch(
            f"/api/v1/counsellor/patients/{patient_id}/status/",
            {"status": "active"},
            format="json",
        )
        self.assertEqual(status_response.status_code, 200, status_response.data)
        self.assertEqual(status_response.data["data"]["status"], "active")

        consultant_reports = consultant_client.get("/api/v1/counsellor/reports/")
        self.assertEqual(consultant_reports.status_code, 200, consultant_reports.data)
        self.assertGreaterEqual(
            consultant_reports.data["data"]["daily"]["total_followups"],
            1,
        )

        patient = Patient.objects.get(id=patient_id, hospital_id=self.hospital_id)
        patient.outstanding_debt = 150.0
        patient.updated_at = datetime.datetime.utcnow()
        patient.save()

        debt_payment_response = pharmacy_client.post(
            "/api/v1/pharmacy/debt-payment/",
            {
                "patient_id": str(patient_id),
                "payment": {
                    "cash_amount": 150.0,
                    "online_amount": 0.0,
                    "debt_cleared": 150.0,
                },
            },
            format="json",
        )
        self.assertEqual(debt_payment_response.status_code, 200, debt_payment_response.data)
        self.assertEqual(debt_payment_response.data["data"]["outstanding_debt"], 0.0)

        debt_visit = Visit.objects(
            hospital_id=self.hospital_id,
            patient_id=patient_id,
            visit_type="debt_payment",
        ).order_by("-visit_date").first()
        self.assertIsNotNone(debt_visit)
        self.created_visit_ids.append(debt_visit.id)

        old_visit_date = datetime.datetime.utcnow() - datetime.timedelta(
            days=settings.FOLLOWUP_THRESHOLD_DAYS + 5
        )
        Visit.objects(id=debt_visit.id).update(set__visit_date=old_visit_date)
        Patient.objects(id=patient_id).update(
            set__last_visit_at=old_visit_date,
            set__updated_at=datetime.datetime.utcnow(),
        )

        followup_response = consultant_client.get(
            "/api/v1/counsellor/followup/",
            {"page": 1, "pageSize": 50},
        )
        self.assertEqual(followup_response.status_code, 200, followup_response.data)
        self.assertIn(
            str(patient_id),
            {item["patient_id"] for item in followup_response.data["data"]["items"]},
        )

    def _login(self, role: str):
        defaults = {
            "receptionist": ("reception@hms.com", "reception123"),
            "consultant": ("counsellor@hms.com", "counsellor123"),
            "pharmacy": ("pharmacy@hms.com", "pharmacy123"),
        }
        email, password = defaults[role]
        email = os.getenv(f"HMS_LIVE_API_{role.upper()}_EMAIL", email)
        password = os.getenv(f"HMS_LIVE_API_{role.upper()}_PASSWORD", password)
        staff = Staff.objects.get(hospital_id=self.hospital_id, email=email)
        self.staff_snapshots.setdefault(str(staff.id), {"id": staff.id, "last_login_at": staff.last_login_at})

        client = APIClient()
        response = client.post("/api/v1/auth/login/", {"email": email, "password": password}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        refresh_cookie = client.cookies.get(settings.JWT_REFRESH_COOKIE_NAME)
        self.assertIsNotNone(refresh_cookie)
        token_jti = jwt.decode(
            refresh_cookie.value,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )["jti"]
        self.created_refresh_jtis.add(token_jti)
        staff.reload()
        return client, staff
