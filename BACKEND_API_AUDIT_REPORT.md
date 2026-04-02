# Backend API Audit Report

## Summary
- Framework: Django 4.2.17 + Django REST Framework 3.14.0 (Python)
- Database: MongoDB via MongoEngine 0.29.1
  - archive alias: `hms_archive`
  - active alias: `hms_active`
- Auth: Custom JWT auth (`PyJWT`) with refresh-token persistence + access-token blacklist
- Base URL: `/api/v1`
- Versioning strategy: Path prefix versioning (`/api/v1/...`)
- Total endpoints documented: 30
- Total collections documented: 8

---

## Technology Overview
- Language/runtime: Python, Django project with DRF APIView classes.
- Data layer:
  - No Django ORM models/migrations are used (`DATABASES = {}`).
  - MongoEngine `Document`/`EmbeddedDocument` models define schema and indexes.
  - Two MongoDB DBs are connected at startup via `utils/db.py`:
    - `hms_archive` for permanent records (`patients`, `visits`, `staff`, `medicines`, `inventory_transactions`, `auth_refresh_tokens`).
    - `hms_active` for operational/transient records (`active_sessions`, `auth_blacklist`).
- Authentication:
  - Access tokens: JWT (`token_type=access`) signed with `JWT_SECRET_KEY`, expiry = `JWT_ACCESS_TOKEN_LIFETIME_MINUTES`.
  - Refresh tokens: JWT (`token_type=refresh`) signed similarly, expiry = `JWT_REFRESH_TOKEN_LIFETIME_DAYS`.
  - Refresh tokens are hashed (SHA-256) and persisted in `auth_refresh_tokens`.
  - Access-token revocation is enforced through `auth_blacklist` by JTI.
- API prefix routing:
  - `/api/v1/auth/...` for auth app.
  - Other app URLs included under `/api/v1/...`.
- Roles in code: `receptionist`, `consultant`, `doctor`, `pharmacy`.

---

## API Endpoints

## Auth Module

### POST /api/v1/auth/login/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/auth_app/views.py` -> `LoginView.post` |
| Purpose | Authenticate staff by email/password and issue access + refresh JWTs. |
| Authentication Required | No (`AllowAny`) |
| Request - Path Params | None |
| Request - Query Params | None |
| Request - Headers | `Content-Type: application/json` |

**Request Body:**
```json
{
  "email": "string, required, valid email",
  "password": "string, required"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "jwt-string",
    "refresh_token": "jwt-string",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": "string(ObjectId)",
      "full_name": "string",
      "email": "string",
      "role": "receptionist|consultant|doctor|pharmacy",
      "hospital_id": "string(ObjectId)"
    }
  }
}
```

**Error Responses:**
- 400: serializer validation error envelope
- 401: `INVALID_CREDENTIALS`
- 403: `ACCOUNT_INACTIVE`
- 500: `INTERNAL_ERROR`

**Side Effects:**
- Creates refresh-token row in `auth_refresh_tokens`.
- Updates `staff.last_login_at`.

---

### POST /api/v1/auth/refresh/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/auth_app/views.py` -> `RefreshTokenView.post` |
| Purpose | Validate refresh token, rotate it, and issue new access token. |
| Authentication Required | No (`AllowAny`) |
| Request - Path Params | None |
| Request - Query Params | None |
| Request - Headers | `Content-Type: application/json` |

**Request Body:**
```json
{
  "refresh_token": "string, required"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "jwt-string",
    "refresh_token": "jwt-string",
    "expires_in": 3600
  }
}
```

**Error Responses:**
- 400: serializer validation error envelope
- 401: `TOKEN_EXPIRED` or `INVALID_TOKEN` or `USER_NOT_FOUND`
- 403: `TOKEN_REVOKED`
- 500: `INTERNAL_ERROR`

**Side Effects:**
- Revokes previous refresh token (`revoked_at` set).
- Stores newly issued refresh token hash/document.

---

### POST /api/v1/auth/logout/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/auth_app/views.py` -> `LogoutView.post` |
| Purpose | Blacklist current access token and optionally revoke supplied refresh token. |
| Authentication Required | Yes (default `IsAuthenticated` + JWT auth) |
| Request - Path Params | None |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <access_token>` |

**Request Body:**
```json
{
  "refresh_token": "string, optional"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

**Error Responses:**
- 400: serializer validation error envelope
- 401: unauthorized or invalid/missing access token
- 500: `INTERNAL_ERROR`

**Side Effects:**
- Inserts JTI row into `auth_blacklist` (best effort; exceptions are swallowed/logged).
- Revokes provided refresh token by `token_jti` (best effort).

---

## Patients Module

### POST /api/v1/patients/register/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/patients/views.py` -> `RegisterPatientView.post` |
| Purpose | Create a new patient with Tier-1 required fields only. |
| Authentication Required | Yes, role `receptionist` |
| Request - Path Params | None |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{
  "full_name": "string, required",
  "phone_number": "string, required",
  "date_of_birth": "YYYY-MM-DD, required",
  "sex": "male|female|other, required",
  "fingerprint_hash": "string, required"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "patient_id": "string(ObjectId)",
    "registration_number": "string",
    "full_name": "string",
    "phone_number": "string",
    "date_of_birth": "YYYY-MM-DD",
    "sex": "male|female|other",
    "status": "active|inactive|dead",
    "general_data_complete": false,
    "outstanding_debt": 0.0,
    "blood_group": null,
    "email": null,
    "address_line1": null,
    "city": null,
    "state": null,
    "pincode": null,
    "aadhaar_number_last4": null,
    "addiction_type": null,
    "addiction_duration_text": null,
    "emergency_contact_name": null,
    "emergency_contact_phone": null,
    "emergency_contact_relation": null,
    "family_history": null,
    "medical_history": null,
    "allergies": null,
    "current_medications": null,
    "previous_treatments": null
  }
}
```

**Error Responses:**
- 400: validation errors
- 401: unauthorized
- 403: forbidden role
- 500: `INTERNAL_ERROR` (including duplicate-key collisions not explicitly handled)

**Side Effects:**
- Creates patient with generated `patient_uid` and `registration_number`.

---

### GET /api/v1/patients/lookup/?registration_number=...|fingerprint_hash=...
| Field | Detail |
|---|---|
| Controller / Handler | `apps/patients/views.py` -> `PatientLookupView.get` |
| Purpose | Lookup a patient by registration number or biometric hash. |
| Authentication Required | Yes, role `receptionist` |
| Request - Path Params | None |
| Request - Query Params | `registration_number` (optional), `fingerprint_hash` (optional), at least one required |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{}
```

**Success Response (200):**
- Same shape as patient serializer in registration response.

**Error Responses:**
- 400: `VALIDATION_ERROR` when both query params are missing
- 404: `PATIENT_NOT_FOUND`
- 401/403 auth errors

**Side Effects:** None.

---

### GET /api/v1/patients/{patient_id}/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/patients/views.py` -> `GetPatientView.get` |
| Purpose | Retrieve full patient details by id. |
| Authentication Required | Yes, roles `receptionist|consultant|doctor` |
| Request - Path Params | `patient_id` (string ObjectId) |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{}
```

**Success Response (200):**
- Same patient payload shape as registration response.

**Error Responses:**
- 404: `PATIENT_NOT_FOUND`
- 500: invalid ObjectId may bubble to `INTERNAL_ERROR`
- 401/403 auth errors

**Side Effects:** None.

---

### PATCH /api/v1/patients/{patient_id}/general/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/patients/views.py` -> `UpdatePatientGeneralView.patch` |
| Purpose | Partially update Tier-2 profile fields and recompute `general_data_complete`. |
| Authentication Required | Yes, roles `receptionist|consultant` |
| Request - Path Params | `patient_id` (string ObjectId) |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body (all optional, partial):**
```json
{
  "blood_group": "string|null",
  "email": "valid-email|string|null",
  "address_line1": "string|null",
  "city": "string|null",
  "state": "string|null",
  "pincode": "string|null",
  "aadhaar_number_last4": "string|null",
  "addiction_type": "alcohol|drugs|tobacco|gambling|other|null",
  "addiction_duration_text": "string|null",
  "emergency_contact_name": "string|null",
  "emergency_contact_phone": "string|null",
  "emergency_contact_relation": "string|null",
  "family_history": "string|null",
  "medical_history": "string|null",
  "allergies": "string|null",
  "current_medications": "string|null",
  "previous_treatments": "string|null"
}
```

**Success Response (200):**
- Same patient payload shape as registration response.

**Error Responses:**
- 400: serializer validation errors
- 404: `PATIENT_NOT_FOUND`
- 500: invalid ObjectId -> `INTERNAL_ERROR`
- 401/403 auth errors

**Side Effects:**
- Mutates nested embedded docs (`address`, `addiction_profile`, `emergency_contact`, `medical_background`).
- Recomputes `general_data_complete` based on complete non-empty coverage of `GENERAL_FIELDS`.

---

## Sessions Module

### POST /api/v1/sessions/checkin/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/sessions/views.py` -> `CheckinView.post` |
| Purpose | Create active session for patient check-in. |
| Authentication Required | Yes, role `receptionist` |
| Request - Path Params | None |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{
  "patient_id": "string(ObjectId), required"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "session_id": "string(ObjectId)",
    "patient_id": "string(ObjectId)",
    "patient_name": "string",
    "checked_in_by": "string(ObjectId)",
    "checked_in_by_name": "string",
    "checked_in_at": "ISO-8601 datetime",
    "status": "checked_in|dispensing|completed",
    "dispense_items": [],
    "outstanding_debt_at_checkin": 0.0
  }
}
```

**Error Responses:**
- 404: `PATIENT_NOT_FOUND`
- 403: `PATIENT_DECEASED`
- 409: `SESSION_ALREADY_ACTIVE`
- 500: invalid `patient_id` ObjectId leads to `INTERNAL_ERROR`
- 401/403 auth errors

**Side Effects:**
- Creates row in `active_sessions`.

---

## Receptionist Module

### GET /api/v1/receptionist/reports/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/receptionist/views.py` -> `ReceptionistReportsView.get` |
| Purpose | Fetch daily/monthly/yearly check-in counts for current receptionist. |
| Authentication Required | Yes, role `receptionist` |
| Request - Path Params | None |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "daily": {
      "date": "YYYY-MM-DD",
      "total_checkins": 0
    },
    "monthly": {
      "year": 2026,
      "month": 4,
      "breakdown": [{ "day": 1, "count": 0 }],
      "total_checkins": 0
    },
    "yearly": {
      "year": 2026,
      "breakdown": [{ "month": 1, "count": 0 }],
      "total_checkins": 0
    }
  }
}
```

**Error Responses:**
- 401/403 auth errors
- 500: `INTERNAL_ERROR`

**Side Effects:** None.

---

## Counsellor Module

### GET /api/v1/counsellor/followup/?page=1&pageSize=20
| Field | Detail |
|---|---|
| Controller / Handler | `apps/consultant/views.py` -> `CounsellorFollowupView.get` |
| Purpose | Return active patients whose last visit is older than follow-up threshold (30 days). |
| Authentication Required | Yes, role `consultant` |
| Request - Path Params | None |
| Request - Query Params | `page` optional int default 1; `pageSize` optional int default 20 |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "patient_id": "string(ObjectId)",
        "full_name": "string",
        "phone_number": "string",
        "last_visit_date": "ISO-8601 datetime|null",
        "days_since_last_visit": 0,
        "status": "active"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 0
    }
  }
}
```

**Error Responses:**
- 401/403 auth errors
- 500: invalid integer casts from query params can raise `INTERNAL_ERROR` (no try/except on cast)

**Side Effects:** None.

---

### PATCH /api/v1/counsellor/patients/{patient_id}/status/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/consultant/views.py` -> `CounsellorPatientStatusView.patch` |
| Purpose | Update patient status and append status-update audit entry. |
| Authentication Required | Yes, role `consultant` |
| Request - Path Params | `patient_id` string ObjectId |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{
  "status": "active|inactive|dead (required)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "patient_id": "string(ObjectId)",
    "full_name": "string",
    "status": "active|inactive|dead",
    "latest_status_update": {
      "updated_by": "string(ObjectId)",
      "updated_by_name": "string",
      "previous_status": "active|inactive|dead",
      "new_status": "active|inactive|dead",
      "updated_at": "ISO-8601 datetime"
    }
  }
}
```

**Error Responses:**
- 400: validation error
- 404: `PATIENT_NOT_FOUND`
- 500: invalid ObjectId -> `INTERNAL_ERROR`
- 401/403 auth errors

**Side Effects:**
- Appends embedded `status_updates` entry on patient document.

---

### GET /api/v1/counsellor/reports/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/consultant/views.py` -> `CounsellorReportsView.get` |
| Purpose | Return daily/monthly/yearly counts of status updates made by counsellor. |
| Authentication Required | Yes, role `consultant` |
| Request - Path Params | None |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "daily": {
      "date": "YYYY-MM-DD",
      "total_followups": 0
    },
    "monthly": {
      "year": 2026,
      "month": 4,
      "breakdown": [{ "day": 1, "count": 0 }],
      "total": 0
    },
    "yearly": {
      "year": 2026,
      "breakdown": [{ "month": 1, "count": 0 }],
      "total": 0
    }
  }
}
```

**Error Responses:**
- 401/403 auth errors
- 500: `INTERNAL_ERROR`

**Side Effects:** None.

---

## Doctor Module

> Important actual behavior note: the doctor module references legacy fields (`state`, `timestamps`, `assignments`, `participants`, `doctor_stage`) not present in the current `ActiveSession` schema. Most doctor endpoints are therefore currently non-functional and can raise runtime exceptions.

### GET /api/v1/doctor/queue
| Field | Detail |
|---|---|
| Controller / Handler | `apps/doctor/views.py` -> `DoctorQueueView.get` |
| Purpose | Intended to list sessions waiting at doctor stage. |
| Authentication Required | Yes, role `doctor` |
| Request - Path Params | None |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:** `{}`

**Intended Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": ["legacy active-session serializer payload"],
    "total": 0
  }
}
```

**Observed Risk/Error Cases:**
- 500 likely due invalid query field `state__current_stage` on `ActiveSession`.
- 401/403 auth errors.

**Side Effects:** None.

---

### POST /api/v1/doctor/consultations/{session_id}/start
| Field | Detail |
|---|---|
| Controller / Handler | `apps/doctor/views.py` -> `StartConsultationView.post` |
| Purpose | Intended to mark doctor consultation started. |
| Authentication Required | Yes, role `doctor` |
| Request - Path Params | `session_id` string ObjectId |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:** `{}`

**Intended Success Response:** serialized legacy active-session queue payload.

**Observed Risk/Error Cases:**
- 404 `SESSION_NOT_FOUND`.
- 409 `WRONG_STAGE`.
- 500 likely due missing `state/assignments/timestamps/participants` attrs in model.

**Side Effects:** Intended to mutate session stage fields.

---

### GET /api/v1/doctor/consultations/{session_id}/context
| Field | Detail |
|---|---|
| Controller / Handler | `apps/doctor/views.py` -> `ConsultationContextView.get` |
| Purpose | Intended to return session + patient details + previous visits. |
| Authentication Required | Yes, role `doctor` |
| Request - Path Params | `session_id` string ObjectId |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Success Response (intended):**
```json
{
  "success": true,
  "data": {
    "...legacy_session_fields": "...",
    "patient_details": { "...": "..." },
    "previous_visits": [{ "id": "...", "visit_uid": "..." }]
  }
}
```

**Error Responses:**
- 404 `SESSION_NOT_FOUND`
- 500 likely due serializer touching missing fields
- 401/403 auth errors

**Side Effects:** None.

---

### POST /api/v1/doctor/consultations/{session_id}/findings
| Field | Detail |
|---|---|
| Controller / Handler | `apps/doctor/views.py` -> `SaveFindingsView.post` |
| Purpose | Intended to store diagnosis/findings/vitals into active session. |
| Authentication Required | Yes, role `doctor` |
| Request - Path Params | `session_id` string ObjectId |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{
  "diagnosis": "string, required",
  "treatment_plan": "string, optional",
  "clinical_notes": "string, optional",
  "vital_signs": {
    "blood_pressure": "string, optional",
    "pulse": "integer|null, optional",
    "weight": "number|null, optional",
    "temperature": "number|null, optional"
  },
  "next_visit_date": "YYYY-MM-DD|null, optional"
}
```

**Intended Success Response:** legacy active-session payload.

**Error Responses:**
- 400 validation error
- 404 `SESSION_NOT_FOUND`
- 409 `WRONG_STAGE`
- 500 likely due missing model fields (`state`, `doctor_stage`, `timestamps`)

**Side Effects:** Intended session mutation only.

---

### POST /api/v1/doctor/consultations/{session_id}/prescriptions
| Field | Detail |
|---|---|
| Controller / Handler | `apps/doctor/views.py` -> `SavePrescriptionsView.post` |
| Purpose | Intended to save prescription draft lines in active session. |
| Authentication Required | Yes, role `doctor` |
| Request - Path Params | `session_id` string ObjectId |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{
  "prescriptions": [
    {
      "medicine_id": "string(ObjectId), required",
      "dosage": "string, required",
      "frequency": "once_daily|twice_daily|thrice_daily|as_needed, required",
      "duration_days": "int>=1, required",
      "quantity": "int>=1, required",
      "instructions": "string, optional"
    }
  ]
}
```

**Intended Success Response:** legacy active-session payload.

**Error Responses:**
- 400 validation errors
- 404 `SESSION_NOT_FOUND`
- 409 `WRONG_STAGE`
- 500 likely due absent `doctor_stage/state/timestamps` schema

**Side Effects:** Intended session mutation.

---

### PATCH /api/v1/doctor/consultations/{session_id}/assign-pharmacy
| Field | Detail |
|---|---|
| Controller / Handler | `apps/doctor/views.py` -> `AssignPharmacyView.patch` |
| Purpose | Intended to complete doctor stage and forward session to pharmacy stage. |
| Authentication Required | Yes, role `doctor` |
| Request - Path Params | `session_id` string ObjectId |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:** `{}`

**Intended Success Response:** legacy active-session payload.

**Error Responses:**
- 404 `SESSION_NOT_FOUND`
- 409 `WRONG_STAGE`
- 400 `FINDINGS_NOT_SUBMITTED`
- 500 likely from missing `state/doctor_stage/timestamps` fields

**Side Effects:** Intended session-stage transition.

---

### GET /api/v1/medicines/search?q=...
| Field | Detail |
|---|---|
| Controller / Handler | `apps/doctor/views.py` -> `MedicineSearchView.get` |
| Purpose | Search active medicines for doctor/pharmacy. |
| Authentication Required | Yes, role `doctor` OR `pharmacy` |
| Request - Path Params | None |
| Request - Query Params | `q` optional string |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:** `{}`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "string(ObjectId)",
        "name": "string",
        "generic_name": "string|null",
        "category": "string",
        "manufacturer": "string|null",
        "unit": "tablet|capsule|ml|mg|syrup|injection",
        "price_per_unit": 0.0,
        "stock_quantity": 0,
        "reorder_level": 0,
        "expiry_date": "ISO-8601 datetime|null",
        "is_active": true,
        "created_at": "ISO-8601 datetime|null"
      }
    ]
  }
}
```

**Error Responses:**
- 401/403 auth errors
- 500 `INTERNAL_ERROR`

**Side Effects:** None.

---

### GET /api/v1/doctor/history?page=1&pageSize=20
| Field | Detail |
|---|---|
| Controller / Handler | `apps/doctor/views.py` -> `DoctorHistoryView.get` |
| Purpose | Return paginated archived visits assigned to current doctor. |
| Authentication Required | Yes, role `doctor` |
| Request - Path Params | None |
| Request - Query Params | `page`, `pageSize` optional |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:** `{}`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "string(ObjectId)",
        "visit_uid": "string|null",
        "visit_date": "ISO-8601 datetime|null",
        "patient_id": "string(ObjectId)|null",
        "visit_type": "standard|debt_payment",
        "medicines_total": 0.0
      }
    ]
  },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "hasNextPage": false
  }
}
```

**Error Responses:**
- 401/403 auth errors
- 500 `INTERNAL_ERROR`

**Side Effects:** None.

---

## Pharmacy Module

### GET /api/v1/pharmacy/queue/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/pharmacy/views.py` -> `PharmacyQueueView.get` |
| Purpose | List active sessions for pharmacy queue. |
| Authentication Required | Yes, role `pharmacy` |
| Request - Path Params | None |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "session_id": "string(ObjectId)",
        "patient_id": "string(ObjectId)",
        "patient_name": "string",
        "checked_in_at": "ISO-8601 datetime",
        "checked_in_by_name": "string",
        "outstanding_debt": 0.0,
        "session_status": "checked_in|dispensing|completed"
      }
    ],
    "total": 0
  }
}
```

**Error Responses:**
- 401/403 auth errors
- 500 `INTERNAL_ERROR`

**Side Effects:** None.

---

### GET /api/v1/pharmacy/session/{session_id}/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/pharmacy/views.py` -> `PharmacySessionDetailView.get` |
| Purpose | Return session details + patient + staged dispense items. |
| Authentication Required | Yes, role `pharmacy` |
| Request - Path Params | `session_id` string ObjectId |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "session_id": "string(ObjectId)",
    "patient": {
      "patient_id": "string(ObjectId)",
      "full_name": "string",
      "phone_number": "string",
      "date_of_birth": "YYYY-MM-DD|null",
      "sex": "male|female|other",
      "registration_number": "string"
    },
    "outstanding_debt": 0.0,
    "dispense_items": [
      {
        "medicine_id": "string(ObjectId)",
        "medicine_name": "string",
        "quantity": 1,
        "unit_price": 0.0,
        "line_total": 0.0
      }
    ],
    "session_status": "checked_in|dispensing|completed"
  }
}
```

**Error Responses:**
- 404 `SESSION_NOT_FOUND` or `PATIENT_NOT_FOUND`
- 500 invalid ObjectId -> `INTERNAL_ERROR`
- 401/403 auth errors

**Side Effects:** None.

---

### GET /api/v1/pharmacy/medicines/search/?q=&page=&pageSize=
| Field | Detail |
|---|---|
| Controller / Handler | `apps/pharmacy/views.py` -> `PharmacyMedicineSearchView.get` |
| Purpose | Search active medicines with positive stock for dispense UI. |
| Authentication Required | Yes, role `pharmacy` |
| Request - Path Params | None |
| Request - Query Params | `q` optional; `page` optional int; `pageSize` optional int |
| Request - Headers | `Authorization: Bearer <token>` |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "medicine_id": "string(ObjectId)",
        "name": "string",
        "category": "string",
        "unit_price": 0.0,
        "stock_quantity": 0
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 0
    }
  }
}
```

**Error Responses:**
- 500 possible if query param integer parsing fails
- 401/403 auth errors

**Side Effects:** None.

---

### POST /api/v1/pharmacy/session/{session_id}/dispense/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/pharmacy/views.py` -> `PharmacyDispenseView.post` |
| Purpose | Stage dispense items on active session; stock is not deducted yet. |
| Authentication Required | Yes, role `pharmacy` |
| Request - Path Params | `session_id` string ObjectId |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{
  "items": [
    {
      "medicine_id": "string(ObjectId), required",
      "quantity": "int>=1, required",
      "unit_price": "float>=0, required"
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "session_id": "string(ObjectId)",
    "status": "dispensing",
    "dispense_items": [
      {
        "medicine_id": "string(ObjectId)",
        "medicine_name": "string",
        "quantity": 1,
        "unit_price": 0.0,
        "line_total": 0.0
      }
    ],
    "medicines_total": 0.0
  }
}
```

**Error Responses:**
- 400 validation errors
- 404 `SESSION_NOT_FOUND` or `MEDICINE_NOT_FOUND`
- 409 `INSUFFICIENT_STOCK`
- 500 invalid ObjectId -> `INTERNAL_ERROR`
- 401/403 auth errors

**Side Effects:**
- Writes dispense lines and sets `active_session.status='dispensing'`.

---

### POST /api/v1/pharmacy/session/{session_id}/checkout/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/pharmacy/views.py` -> `PharmacyCheckoutView.post` |
| Purpose | Validate payment and close active session into archived visit atomically. |
| Authentication Required | Yes, role `pharmacy` |
| Request - Path Params | `session_id` string ObjectId |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{
  "payment": {
    "method": "cash|online|split|debt",
    "cash_amount": "float>=0, optional default 0",
    "online_amount": "float>=0, optional default 0",
    "debt_cleared": "float>=0, optional default 0",
    "new_debt": "float>=0, optional default 0"
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "visit_id": "string(ObjectId)",
    "visit_type": "standard",
    "patient_id": "string(ObjectId)",
    "visit_date": "ISO-8601 datetime",
    "dispensed_by": "string(ObjectId)",
    "dispensed_by_name": "string",
    "checked_in_by": "string(ObjectId)",
    "checked_in_by_name": "string",
    "dispense_items": [
      {
        "medicine_id": "string(ObjectId)",
        "medicine_name": "string",
        "quantity": 1,
        "unit_price": 0.0,
        "line_total": 0.0
      }
    ],
    "medicines_total": 0.0,
    "payment": {
      "method": "cash|online|split|debt",
      "cash_amount": 0.0,
      "online_amount": 0.0,
      "new_debt": 0.0,
      "debt_cleared": 0.0,
      "total_charged": 0.0
    },
    "debt_snapshot": {
      "debt_before": 0.0,
      "debt_after": 0.0
    }
  }
}
```

**Error Responses:**
- 400 serializer or payment validation (`INVALID_*`, `PAYMENT_TOTAL_MISMATCH`, etc.)
- 404 `SESSION_NOT_FOUND`, `PATIENT_NOT_FOUND`, `MEDICINE_NOT_FOUND`
- 409 `INSUFFICIENT_STOCK`
- 500 `INTERNAL_ERROR`

**Side Effects:**
- Creates archived visit (`visits`).
- Updates patient debt/visit counters.
- Deducts medicine stock.
- Deletes active session.
- Transactional under MongoDB session/transaction.

---

### POST /api/v1/pharmacy/debt-payment/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/pharmacy/views.py` -> `PharmacyDebtPaymentView.post` |
| Purpose | Record debt-only payment when no active session exists. |
| Authentication Required | Yes, role `pharmacy` |
| Request - Path Params | None |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{
  "patient_id": "string(ObjectId), required",
  "payment": {
    "cash_amount": "float>=0, optional",
    "online_amount": "float>=0, optional",
    "debt_cleared": "float>=0, optional"
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "patient_id": "string(ObjectId)",
    "outstanding_debt": 0.0
  }
}
```

**Error Responses:**
- 400 `DEBT_PAYMENT_MISMATCH` or `DEBT_CLEARED_EXCEEDS_OUTSTANDING`
- 404 `PATIENT_NOT_FOUND`
- 500 invalid ObjectId -> `INTERNAL_ERROR`
- 401/403 auth errors

**Side Effects:**
- Updates patient debt and visit counters.
- Creates `visit_type='debt_payment'` visit with zero medicines.

---

### GET /api/v1/pharmacy/inventory/?q=&category=&page=&pageSize=
### POST /api/v1/pharmacy/inventory/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/pharmacy/views.py` -> `PharmacyInventoryView.get/post` |
| Purpose | List medicines with filters/pagination, or create a new medicine. |
| Authentication Required | Yes, role `pharmacy` |
| Request - Path Params | None |
| Request - Query Params (GET) | `q` optional, `category` optional, `page` optional, `pageSize` optional |
| Request - Headers | `Authorization: Bearer <token>` |

**POST Request Body:**
```json
{
  "name": "string, required",
  "category": "string, required",
  "unit": "string, required",
  "unit_price": "float>=0, required",
  "stock_quantity": "int>=0, required",
  "description": "string, optional"
}
```

**GET Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "medicine_id": "string(ObjectId)",
        "name": "string",
        "category": "string",
        "unit": "string",
        "unit_price": 0.0,
        "stock_quantity": 0,
        "description": "string",
        "is_active": true
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 0
    }
  }
}
```

**POST Success Response (201):** same medicine payload object in `data`.

**Error Responses:**
- 400 validation errors
- 500 parsing errors possible on query ints
- 401/403 auth errors

**Side Effects:**
- POST inserts medicine (`medicine_uid` auto generated).

---

### PATCH /api/v1/pharmacy/inventory/{medicine_id}/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/pharmacy/views.py` -> `PharmacyInventoryItemView.patch` |
| Purpose | Update medicine metadata (not stock increment). |
| Authentication Required | Yes, role `pharmacy` |
| Request - Path Params | `medicine_id` string ObjectId |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body (all optional):**
```json
{
  "name": "string",
  "category": "string",
  "unit": "string",
  "unit_price": "float>=0",
  "description": "string",
  "is_active": true
}
```

**Success Response (200):** medicine payload in `data`.

**Error Responses:**
- 400 validation errors
- 404 `MEDICINE_NOT_FOUND`
- 500 invalid ObjectId -> `INTERNAL_ERROR`
- 401/403 auth errors

**Side Effects:** updates medicine document.

---

### POST /api/v1/pharmacy/inventory/{medicine_id}/stock/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/pharmacy/views.py` -> `PharmacyAddStockView.post` |
| Purpose | Increment stock quantity for medicine. |
| Authentication Required | Yes, role `pharmacy` |
| Request - Path Params | `medicine_id` string ObjectId |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Request Body:**
```json
{
  "quantity_to_add": "int>=1, required"
}
```

**Success Response (200):** updated medicine payload in `data`.

**Error Responses:**
- 400 validation error
- 404 `MEDICINE_NOT_FOUND`
- 500 invalid ObjectId -> `INTERNAL_ERROR`
- 401/403 auth errors

**Side Effects:** increments `stock_quantity` and updates `updated_at`.

---

### GET /api/v1/pharmacy/reports/
| Field | Detail |
|---|---|
| Controller / Handler | `apps/pharmacy/views.py` -> `PharmacyReportsView.get` |
| Purpose | Return daily/monthly/yearly transaction/revenue aggregates for current pharmacist. |
| Authentication Required | Yes, role `pharmacy` |
| Request - Path Params | None |
| Request - Query Params | None |
| Request - Headers | `Authorization: Bearer <token>` |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "daily": {
      "date": "YYYY-MM-DD",
      "total_transactions": 0,
      "total_revenue": 0.0,
      "cash_collected": 0.0,
      "online_collected": 0.0,
      "debt_added": 0.0,
      "debt_cleared": 0.0
    },
    "monthly": {
      "year": 2026,
      "month": 4,
      "breakdown": [{ "day": 1, "total_transactions": 0, "total_revenue": 0.0 }],
      "total_transactions": 0,
      "total_revenue": 0.0
    },
    "yearly": {
      "year": 2026,
      "breakdown": [{ "month": 1, "total_transactions": 0, "total_revenue": 0.0 }],
      "total_transactions": 0,
      "total_revenue": 0.0
    }
  }
}
```

**Error Responses:**
- 401/403 auth errors
- 500 `INTERNAL_ERROR`

**Side Effects:** None.

---

## Authentication & Authorization

### Token issuance and validation
- Issuance:
  - `POST /api/v1/auth/login/` issues access + refresh token.
  - Access token claims: `token_type`, `user_id`, `role`, `hospital_id`, `email`, `full_name`, `jti`, `iat`, `exp`.
  - Refresh token claims: `token_type`, `user_id`, `hospital_id`, `jti`, `iat`, `exp`.
- Validation:
  - `JWTAuthentication` reads `Authorization: Bearer <token>`.
  - Decodes JWT with `JWT_SECRET_KEY` and `JWT_ALGORITHM`.
  - Ensures `token_type=access`.
  - Rejects expired/invalid/blacklisted JTI.
  - Constructs lightweight `JWTUser` from token claims (no DB lookup).
- Refresh rotation:
  - Refresh token hash (`sha256`) is compared against DB row.
  - Old refresh token row is revoked and a new one is issued.
- Logout:
  - Access token JTI is inserted into `auth_blacklist`.
  - Optional refresh token is revoked by JTI.

### Protected vs public
- Public:
  - `POST /api/v1/auth/login/`
  - `POST /api/v1/auth/refresh/`
- Protected:
  - All other endpoints require bearer auth.

### Role-based enforcement
- Implemented via permission classes in `apps/auth_app/permissions.py`:
  - `IsReceptionist`
  - `IsConsultant`
  - `IsDoctor`
  - `IsPharmacy`
  - Composite classes (`IsDoctorOrPharmacy`, etc.)
- Per-view `permission_classes` determine role restrictions.

### Login/logout/refresh endpoint details
- Already documented above under Auth module with request/response/error contracts.

---

## Database Schema

> Storage engine is MongoDB; below uses collection/field terminology (not SQL tables).

### Collection: patients (db: hms_archive)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | PK | Mongo document id |
| `hospital_id` | ObjectId | required | Tenant/hospital reference |
| `patient_uid` | string | required, unique with hospital | Stable patient UID |
| `registration_number` | string | required, unique with hospital | Human-readable reg number |
| `full_name` | string | required | Patient name |
| `date_of_birth` | datetime | required | DOB |
| `gender` | string | required, enum(`male`,`female`,`other`) | Sex |
| `blood_group` | string | optional | Blood group |
| `phone` | string | required | Phone |
| `email` | string | optional | Email |
| `address` | embedded(Address) | optional | Address fields |
| `aadhaar_number_last4` | string | optional | Last 4 Aadhaar digits |
| `addiction_profile` | embedded(AddictionProfile) | optional | Addiction details |
| `emergency_contact` | embedded(EmergencyContact) | optional | Contact details |
| `medical_background` | embedded(MedicalBackground) | optional | Medical history |
| `biometric` | embedded(Biometric) | required | Fingerprint hash metadata |
| `status` | string | required, default `active`, enum(`active`,`inactive`,`dead`) | Patient state |
| `general_data_complete` | bool | default false | Tier-2 completion flag |
| `outstanding_debt` | float | min 0, default 0 | Debt balance |
| `status_updates` | list(StatusUpdate) | default [] | Status change audit trail |
| `visit_ids` | list(ObjectId) | default [] | Visit references |
| `visits` | list(ObjectId) | default [] | Visit references (duplicate semantic) |
| `visit_count` | int | default 0 | Number of visits |
| `last_visit_at` | datetime | optional | Last visit time |
| `created_by` | ObjectId | required | Creator staff id |
| `created_at` | datetime | required | Created timestamp |
| `updated_at` | datetime | required | Updated timestamp |

**Embedded subdocuments:**
- `Address`: `line1`, `city`, `state`, `pincode` all required when embedded.
- `AddictionProfile`: `addiction_type` enum(`alcohol`,`drugs`,`tobacco`,`gambling`,`other`), `addiction_duration_text` optional.
- `EmergencyContact`: `name`, `phone`, `relation` required when embedded.
- `MedicalBackground`: all optional text fields.
- `Biometric`: `fingerprint_hash_sha256` required, `fingerprint_hash_version` default `sha256-v1`, `fingerprint_enrolled_at` required.
- `StatusUpdate`: updater identity + previous/new status + timestamp.

**Indexes:**
- Unique: `(hospital_id, patient_uid)`
- Unique: `(hospital_id, registration_number)`
- Unique sparse: `(hospital_id, biometric.fingerprint_hash_sha256)`
- `(hospital_id, phone)`
- `(hospital_id, status, -updated_at)`
- `(status)`
- `(status, outstanding_debt)`
- Text index on `full_name`, `registration_number`, `phone`
- `(created_at)`
- `(-updated_at)`

**Relationships:**
- One-to-many from patient to visits via ObjectId list (`visit_ids`/`visits`) and reverse `visits.patient_id`.
- References staff via `created_by` and `status_updates.updated_by`.

**Soft delete:**
- No soft-delete field present.

---

### Collection: visits (db: hms_archive)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | PK | Visit id |
| `visit_type` | string | required, default `standard`, enum(`standard`,`debt_payment`) | Visit category |
| `hospital_id` | ObjectId | required | Tenant id |
| `visit_uid` | string | required, unique with hospital | Human-readable visit id |
| `patient_id` | ObjectId | required | Patient reference |
| `patient_snapshot` | embedded(PatientSnapshot) | optional | Patient snapshot at visit time |
| `visit_number` | int | optional | Sequence number |
| `visit_date` | datetime | required | Visit timestamp |
| `lifecycle` | embedded(VisitLifecycle) | optional | Stage lifecycle timestamps |
| `assignments` | embedded(VisitAssignments) | optional | Staff assignment ids |
| `counsellor_stage` | embedded(CounsellorStage) | optional | Counsellor notes |
| `doctor_stage` | embedded(DoctorStage) | optional | Doctor findings |
| `prescription_items` | list(PrescriptionItem) | default [] | Prescribed medicines |
| `pharmacy_stage` | embedded(PharmacyStage) | optional | Pharmacy stage data |
| `audit` | embedded(VisitAudit) | optional | Archive trail |
| `dispensed_by` | ObjectId | optional | Pharmacist id |
| `dispensed_by_name` | string | optional | Pharmacist name |
| `checked_in_by` | ObjectId | optional | Receptionist id |
| `checked_in_by_name` | string | optional | Receptionist name |
| `dispense_items` | list(DispenseItem) | default [] | Dispensed lines |
| `medicines_total` | float | default 0 | Total medicine amount |
| `payment` | embedded(PaymentRecord) | optional | Payment split |
| `debt_snapshot` | embedded(DebtSnapshot) | optional | debt_before/debt_after |
| `created_at` | datetime | required | Created timestamp |

**Key enum fields in embedded docs:**
- `VisitLifecycle.status`: `completed|cancelled`
- `VisitLifecycle.current_stage`: `completed`
- `CounsellorStage.risk_level`: `low|medium|high`
- `PrescriptionItem.frequency`: `once_daily|twice_daily|thrice_daily|as_needed`
- `PaymentRecord.method`: `cash|online|split|debt`

**Indexes:**
- Unique: `(hospital_id, visit_uid)`
- Unique: `(hospital_id, patient_id, visit_number)`
- `(hospital_id, patient_id, -visit_date)`
- `(hospital_id, assignments.counsellor_id, -lifecycle.completed_at)`
- `(hospital_id, assignments.doctor_id, -lifecycle.completed_at)`
- `(hospital_id, assignments.pharmacist_id, -lifecycle.completed_at)`
- `(dispensed_by, visit_date)`
- `(hospital_id, -lifecycle.completed_at)`
- Text index on `doctor_stage.diagnosis`, `counsellor_stage.session_notes`

**Relationships:**
- Many visits to one patient (`patient_id`).
- Assignments reference `staff` ids.
- Dispense items reference `medicines` ids.

**Soft delete:** none.

---

### Collection: staff (db: hms_archive)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | PK | Staff id |
| `hospital_id` | ObjectId | required | Tenant id |
| `staff_uid` | string | required, unique with hospital | Staff UID |
| `email` | string | required, unique with hospital | Login email |
| `password_hash` | string | required | Django password hash |
| `full_name` | string | required | Full name |
| `role` | string | required, enum(`receptionist`,`consultant`,`doctor`,`pharmacy`) | Role |
| `phone` | string | optional | Phone |
| `is_active` | bool | default true | Active flag |
| `last_login_at` | datetime | optional | Last login |
| `created_at` | datetime | required | Created timestamp |
| `updated_at` | datetime | required | Updated timestamp |

**Indexes:**
- Unique `(hospital_id, email)`
- Unique `(hospital_id, staff_uid)`
- `(hospital_id, role, is_active)`
- Text index on `full_name`

**Relationships:** referenced by patients/visits/sessions via ObjectIds.

**Soft delete:** none (`is_active` used for account activity, not delete).

---

### Collection: medicines (db: hms_archive)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | PK | Medicine id |
| `hospital_id` | ObjectId | required | Tenant id |
| `medicine_uid` | string | required, unique with hospital | Medicine UID |
| `name` | string | required | Name |
| `generic_name` | string | optional | Generic name |
| `category` | string | required | Category |
| `manufacturer` | string | optional | Manufacturer/description |
| `unit` | string | required, enum(`tablet`,`capsule`,`ml`,`mg`,`syrup`,`injection`) | Unit |
| `unit_price` | float | required | Price per unit |
| `stock_quantity` | int | required, default 0 | Current stock |
| `reorder_level` | int | default 0 | Reorder threshold |
| `expiry_date` | datetime | optional | Expiry |
| `is_active` | bool | default true | Active flag |
| `created_by` | ObjectId | required | Creator staff |
| `created_at` | datetime | required | Created timestamp |
| `updated_at` | datetime | required | Updated timestamp |

**Indexes:**
- Unique `(hospital_id, medicine_uid)`
- `(hospital_id, is_active, stock_quantity)`
- `(is_active, stock_quantity)`
- `(hospital_id, category, is_active)`
- `(category)`
- Text index on `name`, `generic_name`
- `(hospital_id, expiry_date)`

**Relationships:** referenced by visit prescription/dispense and inventory transactions.

**Soft delete:** none (`is_active` acts as active flag).

---

### Collection: inventory_transactions (db: hms_archive)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | PK | Ledger entry id |
| `hospital_id` | ObjectId | required | Tenant id |
| `medicine_id` | ObjectId | required | Medicine reference |
| `transaction_type` | string | required, enum(`in`,`out`,`adjustment`) | Stock movement type |
| `quantity` | int | required | Quantity delta |
| `stock_before` | int | required | Previous stock |
| `stock_after` | int | required | New stock |
| `reference_type` | string | required, enum(`dispense`,`stock_update`,`manual`) | Source type |
| `reference_id` | ObjectId | optional | Source id |
| `performed_by` | ObjectId | required | Staff who performed action |
| `notes` | string | optional | Notes |
| `created_at` | datetime | required | Timestamp |

**Indexes:**
- `(hospital_id, medicine_id, -created_at)`
- `(hospital_id, reference_type, reference_id)`
- `(hospital_id, performed_by, -created_at)`

**Relationships:** many transactions to one medicine/staff.

**Soft delete:** none.

---

### Collection: auth_refresh_tokens (db: hms_archive)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | PK | Token row id |
| `hospital_id` | ObjectId | required | Tenant id |
| `staff_id` | ObjectId | required | Staff reference |
| `token_jti` | string | required, unique | Refresh token JTI |
| `token_hash` | string | required | SHA256 hash of refresh token |
| `user_agent` | string | optional | UA string |
| `ip_address` | string | optional | Source IP |
| `expires_at` | datetime | required | Expiry |
| `revoked_at` | datetime | optional | Revocation timestamp |
| `created_at` | datetime | required | Created timestamp |

**Indexes:**
- Unique `token_jti`
- TTL on `expires_at` (`expireAfterSeconds: 0`)
- `(staff_id, revoked_at, expires_at)`

**Relationships:** many token rows per staff.

**Soft delete:** none.

---

### Collection: active_sessions (db: hms_active)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | PK | Active session id |
| `hospital_id` | ObjectId | required | Tenant id |
| `patient_id` | ObjectId | required, unique | Patient with one active session max |
| `patient_name` | string | required | Snapshot name |
| `checked_in_by` | ObjectId | required | Receptionist id |
| `checked_in_by_name` | string | required | Receptionist name |
| `checked_in_at` | datetime | required | Check-in timestamp |
| `status` | string | required, default `checked_in`, enum(`checked_in`,`dispensing`,`completed`) | Session status |
| `dispense_items` | list(DispenseItem) | default [] | Staged medicine lines |
| `outstanding_debt_at_checkin` | float | min 0, default 0 | Debt snapshot |
| `created_at` | datetime | required | Created timestamp |
| `updated_at` | datetime | required | Updated timestamp |

**Embedded `dispense_items` fields:** `medicine_id`, `medicine_name`, `quantity(min=1)`, `unit_price(min=0)`, `line_total(min=0)`.

**Indexes:**
- Unique `(patient_id)`
- `(checked_in_at)`
- `(checked_in_by)`
- `(status)`
- `(hospital_id, checked_in_at)`

**Relationships:** references patient and receptionist staff by ObjectId.

**Soft delete:** none (rows deleted at checkout completion).

---

### Collection: auth_blacklist (db: hms_active)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | PK | Blacklist row id |
| `token_jti` | string | required, unique | Access token JTI |
| `staff_id` | ObjectId | required | Staff id |
| `hospital_id` | ObjectId | required | Tenant id |
| `expires_at` | datetime | required | Access token expiry |
| `created_at` | datetime | required | Insert timestamp |

**Indexes:**
- Unique `token_jti`
- TTL on `expires_at` (`expireAfterSeconds: 0`)

**Relationships:** references staff.

**Soft delete:** none.

---

## Data Validation & Business Rules

### Global/Authentication
- Default permission is authenticated user, unless overridden.
- JWT must be access token (`token_type='access'`) for protected routes.
- Blacklisted access token JTIs are denied.
- Refresh token rotation enforces hash match + non-revoked row.

### Patient rules
- Registration requires exact required fields from `PatientRegistrationSerializer`.
- Patient lookup requires at least one of `registration_number` or `fingerprint_hash`.
- Check-in rejects patients with status `dead`.
- At most one active session per patient (`active_sessions.patient_id` unique + explicit conflict check).
- `general_data_complete` is server-computed from all GENERAL_FIELDS and should not be client-controlled directly.
- Generated server-side fields not client-supplied:
  - `patient_uid`, `registration_number`, `created_by`, `created_at`, `updated_at`.

### Consultant rules
- Follow-up threshold is server constant `FOLLOWUP_THRESHOLD_DAYS=30`.
- Status update appends audit entry containing updater metadata and previous status.

### Pharmacy/Checkout rules
- Dispense stage validates medicine existence + stock availability before staging.
- Checkout computes `medicines_total` from staged lines server-side.
- `PaymentValidator` rules:
  - method in `cash|online|split|debt`.
  - no negative amounts.
  - `debt_cleared <= outstanding_debt`.
  - `cash_amount + online_amount + new_debt == total_due (medicines + outstanding debt)` within tolerance 0.01.
  - strict method-specific constraints for `cash`, `online`, `debt`.
- Checkout transaction atomically:
  - inserts visit,
  - updates patient debt and visit counters,
  - decrements medicine stock,
  - deletes active session.

### Doctor rules (intended but currently broken)
- Requires doctor-stage state transitions and findings before forwarding to pharmacy.
- Requires diagnosis before assign-pharmacy.
- Currently invalid against actual ActiveSession schema (see gaps).

---

## Response Envelope & Error Format

### Success envelope
Standard success format (non-paginated):
```json
{
  "success": true,
  "data": { }
}
```

Paginated helper format (`paginated_response`):
```json
{
  "success": true,
  "data": {
    "items": []
  },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "hasNextPage": false
  }
}
```

### Error envelope
Standard error format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "field": "optional field or null"
  }
}
```

### Consistency notes
- Custom `HMSError` subclasses map to explicit status codes.
- DRF serializer errors are wrapped as `VALIDATION_ERROR`, typically first field only.
- Invalid ObjectId conversion in many views is not explicitly handled; often returns generic 500 `INTERNAL_ERROR` rather than 400.

---

## Pagination, Filtering & Sorting

### Pagination mechanisms
- Common pattern: query params `page`, `pageSize`.
- `utils.pagination` caps `pageSize` to 100 for endpoints that use `parse_pagination_params`.
- Some endpoints manually parse ints without guard, so invalid values can throw 500.

### Endpoints with pagination
- `GET /api/v1/counsellor/followup/`:
  - `page`, `pageSize`
  - response: `data.items` + `data.pagination`.
- `GET /api/v1/pharmacy/medicines/search/`:
  - `q`, `page`, `pageSize`
  - response: `data.items` + `data.pagination`.
- `GET /api/v1/pharmacy/inventory/`:
  - `q`, `category`, `page`, `pageSize`
  - response: `data.items` + `data.pagination`.
- `GET /api/v1/doctor/history`:
  - `page`, `pageSize` via shared helper
  - response: `data.items` + top-level `meta`.

### Sorting
- Explicit sorts observed:
  - reception reports aggregates by date.
  - counsellor follow-up sorted ascending by oldest `last_visit_date`.
  - pharmacy queue sorted by `checked_in_at` ascending.
  - pharmacy and medicine searches sorted by medicine name ascending.
  - doctor history sorted by `-lifecycle.completed_at`.

### Filtering
- `patients/lookup`: `registration_number` or `fingerprint_hash`.
- medicine search endpoints filter by regex on name/category/generic_name.
- inventory filters by `q` and exact `category`.

---

## File Uploads & Media
- No API endpoint handles file upload.
- No `multipart/form-data` parser usage found.
- `utils/fingerprint.py` hashes string template input only; no file storage paths/integrations.

---

## Third-Party Integrations & Background Jobs
- External libraries/services used:
  - MongoDB (`mongoengine`/`pymongo`) as primary persistence.
  - JWT signing/verification (`PyJWT`).
- No outbound third-party API integrations (SMS/email/payment gateway/webhooks) found in backend code.
- Background jobs/schedulers:
  - No Celery/cron/scheduler code found.
  - TTL indexes on `auth_refresh_tokens.expires_at` and `auth_blacklist.expires_at` are database-managed expiry behavior.

---

## Known Gaps or TODOs

1. Doctor module appears schema-incompatible with current `ActiveSession` model.
- Uses non-existent fields: `state`, `timestamps`, `assignments`, `participants`, `doctor_stage`.
- Imports/uses `ActiveDoctorStage`, `ActiveVitalSigns`, `ActivePrescriptionDraft` embedded types that are not fields on `ActiveSession`.
- Uses receptionist serializer `serialize_active_session_for_queue` that also expects those non-existent fields.
- Impact: doctor endpoints likely fail at runtime with 500 or query errors.

2. Multi-tenant data leakage risk in several endpoints due missing `hospital_id` filters.
- `patients/{id}` and `patients/{id}/general` do not filter by request user hospital.
- Pharmacy queue/session/medicine/inventory/debt endpoints often query by id only or global collections.

3. Inventory transaction model exists but is not written by current pharmacy stock-changing code.
- `inventory_transactions` appears unused in runtime endpoint flows.

4. Query param integer parsing is unsafe in multiple endpoints.
- Manual `int(...)` casts without guard can throw 500 instead of validation 400.

5. ObjectId parsing exceptions are not uniformly handled.
- Invalid path/body ObjectId strings often produce generic 500 instead of 400.

6. `receptionist/serializers.py` contains serializer utilities for legacy active-session shape not backed by current model and not used by receptionist routes directly.

7. `utils.exceptions.hms_exception_handler` only returns first serializer error key/message, potentially hiding full validation detail list.

---

## Global Observations
- Response envelope is mostly consistent (`success + data` / `success + error`).
- Error code semantics are reasonably explicit where `HMSError` is used, but low-level cast/query failures can degrade into generic 500.
- Authentication architecture is coherent (access blacklist + refresh rotation with hash persistence).
- Significant backend functional risk centers on the doctor flow due to schema drift between models and views.
- Frontend integration mismatch risk areas:
  - legacy doctor response shapes vs actual persisted active session shape,
  - inconsistent pagination envelope style (`data.pagination` vs top-level `meta`),
  - unguarded failures on malformed IDs/query values.
