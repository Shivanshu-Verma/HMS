"""Live end-to-end coverage for counsellor, doctor, and pharmacy APIs."""
import datetime
import os
import unittest
import uuid

import jwt
from bson import ObjectId
from cryptography.fernet import Fernet
from django.conf import settings
from rest_framework.test import APIClient

from apps.patients.models import AuthRefreshToken, Medicine, Patient, Staff, Visit
from apps.sessions.models import ActiveSession


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
class LiveCoreRoleFlowTests(unittest.TestCase):
    """Drive a patient through the full live queue and archive flow."""

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
        self.created_medicine_ids = []
        self.created_visit_ids = []
        self.created_active_session_ids = []
        self.created_refresh_jtis = set()
        self.staff_snapshots = {}

    def tearDown(self):
        for session_id in self.created_active_session_ids:
            ActiveSession.objects(id=session_id).delete()
        for visit_id in self.created_visit_ids:
            Visit.objects(id=visit_id).delete()
        for patient_id in self.created_patient_ids:
            ActiveSession.objects(patient_id=patient_id).delete()
            Patient.objects(id=patient_id).delete()
        for medicine_id in self.created_medicine_ids:
            Medicine.objects(id=medicine_id).delete()
        for token_jti in self.created_refresh_jtis:
            AuthRefreshToken.objects(token_jti=token_jti).delete()
        for snapshot in self.staff_snapshots.values():
            if snapshot["last_login_at"] is None:
                Staff.objects(id=snapshot["id"]).update(unset__last_login_at=1)
            else:
                Staff.objects(id=snapshot["id"]).update(
                    set__last_login_at=snapshot["last_login_at"]
                )

    def test_full_live_flow_covers_remaining_core_apis(self):
        receptionist_client, _ = self._login("receptionist")
        consultant_client, _ = self._login("consultant")
        doctor_client, doctor_staff = self._login("doctor")
        pharmacy_client, _ = self._login("pharmacy")

        medicine_response = pharmacy_client.post(
            "/api/v1/pharmacy/inventory/",
            {
                "name": f"Live API Medicine {uuid.uuid4().hex[:8]}",
                "category": "test-medicine",
                "unit": "tablet",
                "unit_price": 18.0,
                "stock_quantity": 40,
                "description": "Live smoke medicine",
            },
            format="json",
        )
        self.assertEqual(medicine_response.status_code, 201, medicine_response.data)
        medicine_id = ObjectId(medicine_response.data["data"]["medicine_id"])
        self.created_medicine_ids.append(medicine_id)

        inventory_list_response = pharmacy_client.get(
            "/api/v1/pharmacy/inventory/",
            {"q": "Live API", "category": "test-medicine"},
        )
        self.assertEqual(inventory_list_response.status_code, 200, inventory_list_response.data)
        self.assertIn(
            str(medicine_id),
            {item["medicine_id"] for item in inventory_list_response.data["data"]["items"]},
        )

        update_medicine_response = pharmacy_client.patch(
            f"/api/v1/pharmacy/inventory/{medicine_id}/",
            {"description": "Updated smoke inventory item", "unit_price": 19.5},
            format="json",
        )
        self.assertEqual(update_medicine_response.status_code, 200, update_medicine_response.data)

        add_stock_response = pharmacy_client.post(
            f"/api/v1/pharmacy/inventory/{medicine_id}/stock/",
            {"quantity_to_add": 15},
            format="json",
        )
        self.assertEqual(add_stock_response.status_code, 200, add_stock_response.data)

        doctor_medicine_search = doctor_client.get("/api/v1/medicines/search", {"q": "Live API"})
        self.assertEqual(doctor_medicine_search.status_code, 200, doctor_medicine_search.data)
        self.assertIn(
            str(medicine_id),
            {item["id"] for item in doctor_medicine_search.data["data"]["items"]},
        )

        pharmacy_medicine_search = pharmacy_client.get(
            "/api/v1/pharmacy/medicines/search/",
            {"q": "Live API", "page": 1, "pageSize": 10},
        )
        self.assertEqual(pharmacy_medicine_search.status_code, 200, pharmacy_medicine_search.data)
        self.assertIn(
            str(medicine_id),
            {item["medicine_id"] for item in pharmacy_medicine_search.data["data"]["items"]},
        )

        suffix = uuid.uuid4().hex[:8]
        patient_response = receptionist_client.post(
            "/api/v1/patients/register/",
            {
                "full_name": f"Live Core Flow {suffix}",
                "phone_number": f"9{uuid.uuid4().int % 1000000000:09d}",
                "date_of_birth": "1991-04-17",
                "sex": "male",
                "patient_category": "deaddiction",
                "file_number": f"LIVE-{uuid.uuid4().hex[:8].upper()}",
                "aadhaar_number": f"9999-8888-{uuid.uuid4().hex[:4]}",
                "relative_phone": f"8{uuid.uuid4().int % 1000000000:09d}",
                "address_line1": f"Live Test Street {suffix}",
                "fingerprint_template": f"live-fp-core-{suffix}",
            },
            format="json",
        )
        self.assertEqual(patient_response.status_code, 201, patient_response.data)
        patient_id = ObjectId(patient_response.data["data"]["patient_id"])
        self.created_patient_ids.append(patient_id)

        checkin_response = receptionist_client.post(
            "/api/v1/sessions/checkin/",
            {"patient_id": str(patient_id)},
            format="json",
        )
        self.assertEqual(checkin_response.status_code, 201, checkin_response.data)
        session_id = ObjectId(checkin_response.data["data"]["session_id"])
        self.created_active_session_ids.append(session_id)

        consultant_queue = consultant_client.get("/api/v1/counsellor/queue/")
        self.assertEqual(consultant_queue.status_code, 200, consultant_queue.data)
        self.assertIn(str(session_id), {item["session_id"] for item in consultant_queue.data["data"]["items"]})

        consultant_detail = consultant_client.get(f"/api/v1/counsellor/session/{session_id}/")
        self.assertEqual(consultant_detail.status_code, 200, consultant_detail.data)

        consultant_complete = consultant_client.post(
            f"/api/v1/counsellor/session/{session_id}/complete/",
            {
                "session_notes": "Live smoke counselling notes",
                "mood_assessment": 7,
                "risk_level": "low",
                "recommendations": "Continue programme",
                "follow_up_required": True,
            },
            format="json",
        )
        self.assertEqual(consultant_complete.status_code, 200, consultant_complete.data)

        consultant_report_sessions = consultant_client.get("/api/v1/counsellor/reports/sessions/")
        self.assertEqual(consultant_report_sessions.status_code, 200, consultant_report_sessions.data)
        self.assertIn(str(session_id), {item["session_id"] for item in consultant_report_sessions.data["data"]["items"]})

        doctor_queue = doctor_client.get("/api/v1/doctor/queue")
        self.assertEqual(doctor_queue.status_code, 200, doctor_queue.data)
        self.assertIn(str(session_id), {item["session_id"] for item in doctor_queue.data["data"]["items"]})

        doctor_start = doctor_client.post(f"/api/v1/doctor/consultations/{session_id}/start")
        self.assertEqual(doctor_start.status_code, 200, doctor_start.data)

        doctor_context = doctor_client.get(f"/api/v1/doctor/consultations/{session_id}/context")
        self.assertEqual(doctor_context.status_code, 200, doctor_context.data)

        doctor_findings = doctor_client.post(
            f"/api/v1/doctor/consultations/{session_id}/findings",
            {
                "diagnosis": "Routine live smoke diagnosis",
                "treatment_plan": "Hydration and observation",
                "clinical_notes": "Patient stable during smoke run.",
                "vital_signs": {
                    "blood_pressure": "120/80",
                    "pulse": 72,
                    "weight": 70.5,
                    "temperature": 98.6,
                },
                "next_visit_date": "2026-04-20",
            },
            format="json",
        )
        self.assertEqual(doctor_findings.status_code, 200, doctor_findings.data)

        doctor_prescriptions = doctor_client.post(
            f"/api/v1/doctor/consultations/{session_id}/prescriptions",
            {
                "prescriptions": [
                    {
                        "medicine_id": str(medicine_id),
                        "dosage": "1 tablet",
                        "frequency": "twice_daily",
                        "duration_days": 5,
                        "quantity": 2,
                        "instructions": "After food",
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(doctor_prescriptions.status_code, 200, doctor_prescriptions.data)

        doctor_assign = doctor_client.patch(
            f"/api/v1/doctor/consultations/{session_id}/assign-pharmacy",
            {},
            format="json",
        )
        self.assertEqual(doctor_assign.status_code, 200, doctor_assign.data)

        pharmacy_queue = pharmacy_client.get("/api/v1/pharmacy/queue/")
        self.assertEqual(pharmacy_queue.status_code, 200, pharmacy_queue.data)
        self.assertIn(str(session_id), {item["session_id"] for item in pharmacy_queue.data["data"]["items"]})

        pharmacy_detail = pharmacy_client.get(f"/api/v1/pharmacy/session/{session_id}/")
        self.assertEqual(pharmacy_detail.status_code, 200, pharmacy_detail.data)

        pharmacy_dispense = pharmacy_client.post(
            f"/api/v1/pharmacy/session/{session_id}/dispense/",
            {"items": [{"medicine_id": str(medicine_id), "quantity": 2, "unit_price": 19.5}]},
            format="json",
        )
        self.assertEqual(pharmacy_dispense.status_code, 200, pharmacy_dispense.data)
        medicines_total = pharmacy_dispense.data["data"]["medicines_total"]

        pharmacy_checkout = pharmacy_client.post(
            f"/api/v1/pharmacy/session/{session_id}/checkout/",
            {"payment": {"method": "cash", "cash_amount": medicines_total, "online_amount": 0.0, "new_debt": 0.0, "debt_cleared": 0.0}},
            format="json",
        )
        self.assertEqual(pharmacy_checkout.status_code, 200, pharmacy_checkout.data)
        visit_id = ObjectId(pharmacy_checkout.data["data"]["visit_id"])
        self.created_visit_ids.append(visit_id)
        self.created_active_session_ids.remove(session_id)

        archived_visit = Visit.objects.get(id=visit_id, hospital_id=self.hospital_id)
        self.assertEqual(archived_visit.assignments.doctor_id, doctor_staff.id)
        self.assertIsNone(ActiveSession.objects(id=session_id).first())

        doctor_history = doctor_client.get("/api/v1/doctor/history")
        self.assertEqual(doctor_history.status_code, 200, doctor_history.data)
        self.assertIn(str(visit_id), {item["id"] for item in doctor_history.data["data"]["items"]})

        pharmacy_invoices = pharmacy_client.get("/api/v1/pharmacy/invoices/")
        self.assertEqual(pharmacy_invoices.status_code, 200, pharmacy_invoices.data)
        self.assertIn(str(visit_id), {item["id"] for item in pharmacy_invoices.data["data"]["items"]})

        pharmacy_reports = pharmacy_client.get("/api/v1/pharmacy/reports/")
        self.assertEqual(pharmacy_reports.status_code, 200, pharmacy_reports.data)
        self.assertGreaterEqual(pharmacy_reports.data["data"]["daily"]["total_transactions"], 1)

    def _login(self, role: str):
        defaults = {
            "receptionist": ("reception@hms.com", "reception123"),
            "consultant": ("counsellor@hms.com", "counsellor123"),
            "doctor": ("doctor@hms.com", "doctor123"),
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
