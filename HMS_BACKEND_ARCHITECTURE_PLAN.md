## Section 1: Database Schema

### hms_archive — Collections

#### patients

Purpose: Master patient registry and longitudinal identity record.

Fields

- \_id: ObjectId, required, indexed unique, Mongo primary key.
- hospital_id: ObjectId, required, indexed (compound), future-safe tenant partition key; included in all auth claims.
- patient_uid: String, required, indexed unique (compound with hospital_id), immutable patient identifier shown to staff.
- registration_number: String, required, indexed unique (compound with hospital_id), human-readable registration ID used in UI search.
- full_name: String, required, indexed text (with phone, registration_number), patient name.
- date_of_birth: Date, required, not indexed, DOB.
- gender: String enum(male,female,other), required, indexed (low-cardinality optional for reporting/filtering).
- blood_group: String, optional, not indexed.
- phone: String, required, indexed (compound with hospital_id), primary contact.
- email: String, optional, sparse index.
- address: Embedded Object, required:
  - line1: String
  - city: String
  - state: String
  - pincode: String (indexed with hospital_id for occasional locality filter)
- aadhaar_number_last4: String, optional, sparse index, last 4 digits only (never store full ID in cleartext).
- addiction_profile: Embedded Object, required:
  - addiction_type: String enum(alcohol,drugs,tobacco,gambling,other), required, indexed
  - addiction_duration_text: String, optional
- emergency_contact: Embedded Object, required:
  - name: String
  - phone: String
  - relation: String
- medical_background: Embedded Object, optional:
  - family_history: String
  - medical_history: String
  - allergies: String
  - current_medications: String
  - previous_treatments: String
- biometric: Embedded Object, required:
  - fingerprint_hash_sha256: String, required, indexed unique (compound with hospital_id), direct hash lookup only.
  - fingerprint_hash_version: String, required, e.g. sha256-v1
  - fingerprint_enrolled_at: Date, required
- status: String enum(active,discharged,follow_up), required, indexed.
- visit_ids: Array<ObjectId>, required default [], indexed multikey (for reverse navigation from patient to visits).
- visit_count: Number, required default 0, indexed for quick summary.
- last_visit_at: Date, optional, indexed.
- created_by: ObjectId ref staff.\_id, required.
- created_at: Date, required, indexed.
- updated_at: Date, required, indexed.

Indexes

- Unique: (hospital_id, patient_uid)
- Unique: (hospital_id, registration_number)
- Unique: (hospital_id, biometric.fingerprint_hash_sha256)
- Non-unique: (hospital_id, phone)
- Non-unique: (hospital_id, status, updated_at desc)
- Text: full_name + registration_number + phone

Relationships

- 1:N to visits via visits.patient_id and patients.visit_ids.
- N:1 to staff via created_by.

Embedding vs reference

- Embedded: emergency_contact, addiction_profile, medical_background, biometric metadata because always read together in patient profile screens.
- Referenced: visits (not embedded full visit objects) to avoid unbounded patient document growth.

---

#### visits

Purpose: Immutable archived, completed visit records (source of truth for history).

Fields

- \_id: ObjectId, required, indexed unique.
- hospital_id: ObjectId, required, indexed.
- visit_uid: String, required, indexed unique (compound with hospital_id), external visit ID.
- patient_id: ObjectId ref patients.\_id, required, indexed.
- patient_snapshot: Embedded Object, required:
  - patient_uid: String
  - registration_number: String
  - full_name: String
  - gender: String
  - date_of_birth: Date
  - addiction_type: String
    Reason: historical consistency if patient demographics later change.
- visit_number: Number, required, indexed.
- visit_date: Date, required, indexed.
- lifecycle: Embedded Object, required:
  - status: String enum(completed,cancelled), required, indexed
  - current_stage: String enum(completed), required
  - checkin_at: Date
  - counsellor_started_at: Date
  - counsellor_completed_at: Date
  - doctor_started_at: Date
  - doctor_completed_at: Date
  - pharmacy_started_at: Date
  - pharmacy_completed_at: Date
  - completed_at: Date, required, indexed
- assignments: Embedded Object, required:
  - receptionist_id: ObjectId ref staff.\_id, optional
  - counsellor_id: ObjectId ref staff.\_id, required
  - doctor_id: ObjectId ref staff.\_id, required
  - pharmacist_id: ObjectId ref staff.\_id, required
- counsellor_stage: Embedded Object, required:
  - session_notes: String, required
  - mood_assessment: Number (1-10), optional
  - risk_level: String enum(low,medium,high), required, indexed
  - recommendations: String, optional
  - follow_up_required: Boolean, required
  - session_duration_minutes: Number, optional
  - created_at: Date, required
- doctor_stage: Embedded Object, required:
  - diagnosis: String, required, indexed text
  - treatment_plan: String, optional
  - clinical_notes: String, optional
  - vital_signs: Embedded:
    - blood_pressure: String
    - pulse: Number
    - weight_kg: Number
    - temperature_f: Number
  - next_visit_date: Date, optional
  - created_at: Date, required
- prescription_items: Array<Embedded>, required:
  - prescription_item_id: ObjectId
  - medicine_id: ObjectId ref medicines.\_id
  - medicine_snapshot: {name, generic_name, unit, category}
  - dosage: String
  - frequency: String enum(once_daily,twice_daily,thrice_daily,as_needed)
  - duration_days: Number
  - quantity_prescribed: Number
  - instructions: String optional
  - dispensed: Boolean
  - quantity_dispensed: Number
  - dispensed_at: Date
- pharmacy_stage: Embedded Object, required:
  - dispensed_items_count: Number
  - stock_deductions: Array<Embedded>:
    - medicine_id: ObjectId
    - quantity_out: Number
    - stock_before: Number
    - stock_after: Number
  - dispensing_notes: String optional
  - created_at: Date
- audit: Embedded Object, required:
  - archived_from_active_session_id: ObjectId
  - archived_by: ObjectId ref staff.\_id
  - archive_txn_id: String
  - version: Number
- created_at: Date, required, indexed.

Indexes

- Unique: (hospital_id, visit_uid)
- Unique: (hospital_id, patient_id, visit_number)
- Non-unique: (hospital_id, patient_id, visit_date desc)
- Non-unique: (hospital_id, assignments.counsellor_id, lifecycle.completed_at desc)
- Non-unique: (hospital_id, assignments.doctor_id, lifecycle.completed_at desc)
- Non-unique: (hospital_id, assignments.pharmacist_id, lifecycle.completed_at desc)
- Non-unique: (hospital_id, lifecycle.completed_at desc)
- Text: doctor_stage.diagnosis + counsellor_stage.session_notes

Relationships

- N:1 to patients via patient_id.
- N:1 to staff via assignments and audit.archived_by.
- N:1 to medicines via prescription_items.medicine_id.

Embedding vs reference

- Embedded: entire stage outputs and prescription snapshots to keep each visit immutable and fetchable in one read.
- Referenced: medicines and staff IDs retained for relational integrity and lightweight updates to staff metadata outside historical snapshots.

---

#### staff

Purpose: Staff identity, role, and authentication profile.

Fields

- \_id: ObjectId, required, indexed unique.
- hospital_id: ObjectId, required, indexed.
- staff_uid: String, required, indexed unique (compound with hospital_id).
- email: String, required, indexed unique (compound with hospital_id).
- password_hash: String, required.
- full_name: String, required, indexed text.
- role: String enum(receptionist,consultant,doctor,pharmacy), required, indexed.
- phone: String, optional, indexed sparse.
- is_active: Boolean, required, indexed.
- last_login_at: Date, optional, indexed.
- created_at: Date, required.
- updated_at: Date, required.

Indexes

- Unique: (hospital_id, email)
- Unique: (hospital_id, staff_uid)
- Non-unique: (hospital_id, role, is_active)

Relationships

- 1:N with visits through assignments.
- 1:N with active_sessions through assignment fields.

---

#### medicines

Purpose: Master medicine catalog and current stock.

Fields

- \_id: ObjectId, required, indexed unique.
- hospital_id: ObjectId, required, indexed.
- medicine_uid: String, required, indexed unique (compound with hospital_id).
- name: String, required, indexed text.
- generic_name: String, optional, indexed text.
- category: String, optional, indexed.
- manufacturer: String, optional.
- unit: String enum(tablet,capsule,ml,mg,syrup,injection), required, indexed.
- price_per_unit: Number, required.
- stock_quantity: Number, required, indexed.
- reorder_level: Number, required, indexed.
- expiry_date: Date, optional, indexed.
- is_active: Boolean, required, indexed.
- created_by: ObjectId ref staff.\_id, required.
- created_at: Date, required.
- updated_at: Date, required.

Indexes

- Unique: (hospital_id, medicine_uid)
- Non-unique: (hospital_id, is_active, stock_quantity)
- Non-unique: (hospital_id, category, is_active)
- Text: name + generic_name
- Non-unique: (hospital_id, expiry_date)

Relationships

- 1:N with inventory_transactions.
- N referenced from visits.prescription_items and active_sessions.prescription draft items.

---

#### inventory_transactions

Purpose: Immutable inventory ledger for stock in/out.

Fields

- \_id: ObjectId, required, indexed unique.
- hospital_id: ObjectId, required, indexed.
- medicine_id: ObjectId ref medicines.\_id, required, indexed.
- transaction_type: String enum(in,out,adjustment), required, indexed.
- quantity: Number, required.
- stock_before: Number, required.
- stock_after: Number, required.
- reference_type: String enum(dispense,stock_update,manual), required, indexed.
- reference_id: ObjectId, optional, indexed.
- performed_by: ObjectId ref staff.\_id, required, indexed.
- notes: String, optional.
- created_at: Date, required, indexed.

Indexes

- Non-unique: (hospital_id, medicine_id, created_at desc)
- Non-unique: (hospital_id, reference_type, reference_id)
- Non-unique: (hospital_id, performed_by, created_at desc)

Relationships

- N:1 to medicines.
- N:1 to staff.

---

#### auth_refresh_tokens

Purpose: Refresh token session store for rotation and revocation.

Fields

- \_id: ObjectId, required.
- hospital_id: ObjectId, required, indexed.
- staff_id: ObjectId ref staff.\_id, required, indexed.
- token_jti: String, required, indexed unique.
- token_hash: String, required.
- user_agent: String, optional.
- ip_address: String, optional.
- expires_at: Date, required, TTL index.
- revoked_at: Date, optional, indexed sparse.
- created_at: Date, required.

Indexes

- Unique: token_jti
- TTL: expires_at (expireAfterSeconds: 0)
- Non-unique: (staff_id, revoked_at, expires_at)

Relationships

- N:1 staff.

---

### hms_active — Collections

#### active_sessions

Purpose: Single in-progress object that travels through checkin -> consultant -> doctor -> pharmacy.

Fields

- \_id: ObjectId, required, indexed unique.
- hospital_id: ObjectId, required, indexed.
- active_visit_uid: String, required, indexed unique (compound with hospital_id).
- patient_id: ObjectId ref hms_archive.patients.\_id, required, indexed.
- patient_snapshot: Embedded Object, required:
  - patient_uid: String
  - registration_number: String
  - full_name: String
  - date_of_birth: Date
  - gender: String
  - phone: String
  - addiction_type: String
  - allergies: String optional
  - medical_history: String optional
    Reason: queue/context pages should render in one fetch without joining full patient doc repeatedly.
- visit_number: Number, required.
- visit_date: Date, required, indexed.
- state: Embedded Object, required:
  - current_stage: String enum(counsellor,doctor,pharmacy), required, indexed
  - stage_status: String enum(waiting,in_progress,ready_for_next), required, indexed
  - status: String enum(in_progress,cancelled), required, indexed
- assignments: Embedded Object, required:
  - receptionist_id: ObjectId ref staff.\_id, required
  - counsellor_id: ObjectId ref staff.\_id, optional, indexed
  - doctor_id: ObjectId ref staff.\_id, optional, indexed
  - pharmacist_id: ObjectId ref staff.\_id, optional, indexed
- timestamps: Embedded Object, required:
  - checkin_at: Date, required
  - counsellor_started_at: Date optional
  - counsellor_completed_at: Date optional
  - doctor_started_at: Date optional
  - doctor_completed_at: Date optional
  - pharmacy_started_at: Date optional
  - updated_at: Date, required, indexed
- counsellor_stage: Embedded Object, optional:
  - session_notes: String
  - mood_assessment: Number
  - risk_level: String enum(low,medium,high)
  - recommendations: String
  - follow_up_required: Boolean
  - session_duration_minutes: Number
  - completed_by: ObjectId ref staff.\_id
  - completed_at: Date
- doctor_stage: Embedded Object, optional:
  - diagnosis: String
  - treatment_plan: String
  - clinical_notes: String
  - vital_signs: {blood_pressure, pulse, weight_kg, temperature_f}
  - next_visit_date: Date
  - prescriptions: Array<Embedded>:
    - draft_item_id: ObjectId
    - medicine_id: ObjectId ref hms_archive.medicines.\_id
    - dosage: String
    - frequency: String
    - duration_days: Number
    - quantity: Number
    - instructions: String
  - completed_by: ObjectId
  - completed_at: Date
- pharmacy_stage: Embedded Object, optional:
  - dispense_items: Array<Embedded>:
    - medicine_id: ObjectId
    - quantity_prescribed: Number
    - quantity_dispensed: Number
    - selected_for_dispense: Boolean
    - stock_before: Number optional
    - stock_after: Number optional
  - completed_by: ObjectId
  - completed_at: Date
- participants: Array<ObjectId>, required, indexed multikey (all staff who touched visit; used for relationship checks).
- version: Number, required default 1 (optimistic concurrency).
- expires_at: Date, required, TTL index for stale sessions.
- created_at: Date, required.
- updated_at: Date, required.

Indexes

- Unique: (hospital_id, active_visit_uid)
- Unique partial: (hospital_id, patient_id, visit_date, state.status=in_progress) to prevent duplicate active visits same day.
- Queue index consultant: (hospital_id, state.current_stage, assignments.counsellor_id, state.stage_status, timestamps.checkin_at)
- Queue index doctor: (hospital_id, state.current_stage, assignments.doctor_id, state.stage_status, timestamps.counsellor_completed_at)
- Queue index pharmacy: (hospital_id, state.current_stage, assignments.pharmacist_id, state.stage_status, timestamps.doctor_completed_at)
- Non-unique: (hospital_id, visit_date, state.status)
- Multikey: (hospital_id, participants)
- TTL: expires_at (expireAfterSeconds: 0), recommend 30 days as safety cleanup.

Relationships

- N:1 patients (archive DB reference by ObjectId).
- N:1 staff via assignments and participants.
- N:1 medicines via doctor_stage.prescriptions and pharmacy_stage.dispense_items.

Embedding vs reference

- Embedded stage data by design (single traveling object).
- Referenced patient and medicine master records (no duplication of source-of-truth docs).
- Small patient snapshot embedded to avoid over-joining for every queue render.

---

#### active_locks

Purpose: Prevent double-start/double-complete race conditions.

Fields

- \_id: ObjectId.
- hospital_id: ObjectId, indexed.
- active_session_id: ObjectId ref active_sessions.\_id, required, indexed unique.
- stage: String enum(counsellor,doctor,pharmacy), required.
- locked_by: ObjectId ref staff.\_id, required.
- lock_reason: String enum(start_session,submit_stage,close_visit), required.
- expires_at: Date, required, TTL index.
- created_at: Date, required.

Indexes

- Unique: (hospital_id, active_session_id, stage)
- TTL: expires_at

---

#### auth_blacklist

Purpose: Fast logout invalidation for access token JTI.

Fields

- \_id: ObjectId.
- token_jti: String, required, indexed unique.
- staff_id: ObjectId ref staff.\_id, required, indexed.
- hospital_id: ObjectId, required, indexed.
- expires_at: Date, required, TTL.
- created_at: Date, required.

Indexes

- Unique: token_jti
- TTL: expires_at

---

## Section 2: ER Relationships Diagram (text-based)

hms_archive

- patients 1 ---- N visits
  - visits.patient_id -> patients.\_id
  - patients.visit_ids[] -> visits.\_id
- staff 1 ---- N visits
  - visits.assignments.counsellor_id -> staff.\_id
  - visits.assignments.doctor_id -> staff.\_id
  - visits.assignments.pharmacist_id -> staff.\_id
- medicines 1 ---- N inventory_transactions
  - inventory_transactions.medicine_id -> medicines.\_id
- staff 1 ---- N inventory_transactions
  - inventory_transactions.performed_by -> staff.\_id
- staff 1 ---- N auth_refresh_tokens
  - auth_refresh_tokens.staff_id -> staff.\_id

hms_active

- active_sessions N ---- 1 patients (cross-db reference)
  - active_sessions.patient_id -> hms_archive.patients.\_id
- active_sessions N ---- 1 staff (assignments + participants)
  - active_sessions.assignments.\*\_id -> hms_archive.staff.\_id
  - active_sessions.participants[] -> hms_archive.staff.\_id
- active_sessions N ---- 1 medicines
  - active_sessions.doctor_stage.prescriptions[].medicine_id -> hms_archive.medicines.\_id
- active_locks N ---- 1 active_sessions
  - active_locks.active_session_id -> active_sessions.\_id

Cardinality summary

- Patient to visits: 1:N
- Staff to active/archived work items: 1:N
- Visit to prescriptions: 1:N embedded
- Medicine to prescription items: 1:N referenced with embedded snapshot
- Active session to stage data: 1:1 embedded per stage object

Embedded vs referenced summary

- Embedded: Stage payloads inside active_sessions and visits (atomic business object, single-fetch UI context).
- Referenced: patient, staff, medicine masters for reuse, integrity, and manageable document size.

---

## Section 3: API Endpoints

Common API conventions

- Base path: /api/v1
- Auth: JWT Bearer access token; claims include user_id, role, hospital_id, jti, exp
- Pagination default: page=1, pageSize=20, maxPageSize=100
- List response envelope:
  - items: Array
  - total: Number
  - page: Number
  - pageSize: Number
  - hasNextPage: Boolean
- Error envelope:
  - error_code: String
  - message: String
  - details: Object optional
- Security rule applied to all patient reads:
  - requester must be receptionist who registered/currently owns queue relation, or assigned consultant/doctor/pharmacist, or participant in historical visit.
- Projection-by-default:
  - never return fingerprint hash
  - never return password hashes
  - avoid full medical_background unless detail page asks for it

---

### Auth

1. POST /api/v1/auth/login

- Roles allowed: public
- Description: authenticate staff and issue access/refresh tokens.
- Request body:
  - email: String required
  - password: String required
- Response 200:
  - access_token: String
  - refresh_token: String
  - token_type: String = Bearer
  - expires_in: Number seconds
  - user: {id, full_name, email, role, hospital_id}
- Errors:
  - 400 invalid payload
  - 401 invalid credentials
  - 403 inactive account
- DB operations:
  - Read hms_archive.staff by (hospital_id,email) projection: \_id,password_hash,role,is_active,full_name.
  - Insert hms_archive.auth_refresh_tokens with token_jti/hash/expiry.
  - Update staff.last_login_at.
- Performance:
  - Uses unique index (hospital_id,email), O(log n).

2. POST /api/v1/auth/refresh

- Roles allowed: authenticated refresh token holder
- Description: rotate refresh token and issue new access token.
- Request body:
  - refresh_token: String required
- Response 200:
  - access_token
  - refresh_token
  - expires_in
- Errors:
  - 401 expired/invalid token
  - 403 revoked token
- DB operations:
  - Read auth_refresh_tokens by token_jti.
  - Validate token hash and revoked_at null.
  - Transaction: revoke old token + insert new token.
- Performance:
  - Unique token_jti index, O(log n).

3. POST /api/v1/auth/logout

- Roles allowed: authenticated
- Description: invalidate current access token jti and refresh token.
- Request body:
  - refresh_token: String optional
- Response 200:
  - success: Boolean
- Errors:
  - 401 unauthorized
- DB operations:
  - Insert hms_active.auth_blacklist with access jti, exp.
  - Update matching refresh token revoked_at.
- Performance:
  - O(log n) on token_jti indexes; blacklist TTL auto cleanup.

---

### Receptionist

4. POST /api/v1/patients

- Roles: receptionist
- Description: register new patient with fingerprint hash.
- Request body:
  - full_name, date_of_birth, gender, blood_group?
  - phone, email?, address{line1,city,state,pincode}
  - aadhaar_number_last4?
  - addiction_profile{addiction_type,addiction_duration_text?}
  - emergency_contact{name,phone,relation}
  - medical_background{family_history?,medical_history?,allergies?,current_medications?,previous_treatments?}
  - fingerprint_hash_sha256: String required
- Response 200:
  - patient_id
  - patient_uid
  - registration_number
  - full_name
  - status
- Errors:
  - 400 validation error
  - 409 duplicate fingerprint or registration
- DB operations:
  - Insert hms_archive.patients.
  - Optional uniqueness pre-check on fingerprint hash.
  - Projection excluded from response: medical_background text blobs except if needed.
- Performance:
  - Unique indexes handle conflicts, O(log n).

5. GET /api/v1/patients/{patientId}

- Roles: receptionist, consultant, doctor
- Description: lookup by internal patient id.
- Query:
  - includeMedical: Boolean optional default false
- Response 200:
  - id, patient_uid, registration_number, full_name, gender, dob, phone, addiction_type, status, visit_count, last_visit_at
  - emergency_contact summary
  - medical_background only if includeMedical=true
- Errors: 404 not found, 403 no relationship
- DB operations:
  - Read patients by \_id + hospital_id projection tailored by includeMedical.
- Performance:
  - \_id index O(log n).

6. GET /api/v1/patients/by-registration/{registrationNumber}

- Roles: receptionist
- Description: lookup by registration number.
- Response 200: same as above.
- Errors: 404
- DB operations:
  - Read patients by (hospital_id,registration_number).
- Performance:
  - Unique index O(log n).

7. POST /api/v1/patients/lookup-fingerprint

- Roles: receptionist
- Description: exact match patient lookup by fingerprint hash.
- Request body:
  - fingerprint_hash_sha256: String required
- Response 200:
  - patient summary fields for checkin card.
- Errors:
  - 404 no match
- DB operations:
  - Read patients by (hospital_id,biometric.fingerprint_hash_sha256) projection: id,registration_number,full_name,phone,dob,addiction_type,status,emergency_contact.name.
- Performance:
  - Unique index O(log n), no fuzzy matching.

8. POST /api/v1/visits

- Roles: receptionist
- Description: create active visit session for patient checkin.
- Request body:
  - patient_id: ObjectId required
  - assigned_counsellor_id: ObjectId required
- Response 200:
  - active_session_id
  - active_visit_uid
  - current_stage
  - checkin_at
- Errors:
  - 409 existing active visit for patient today
- DB operations:
  - Read patients for minimal snapshot.
  - Compute visit_number using visits count + active today count (or patient.visit_count+1).
  - Insert hms_active.active_sessions.
  - Update participants with receptionist and counsellor.
- Performance:
  - Partial unique index prevents duplicates; O(log n).

9. PATCH /api/v1/visits/{activeSessionId}/assign-counsellor

- Roles: receptionist
- Description: reassign patient to specific consultant queue.
- Request body:
  - counsellor_id: ObjectId required
- Response 200:
  - active_session_id
  - counsellor_id
  - stage_status
- Errors:
  - 400 invalid stage (not counsellor)
  - 404 session not found
- DB operations:
  - Update active_sessions filter: \_id + current_stage=counsellor + status=in_progress.
- Performance:
  - Queue index hit; O(log n).

10. GET /api/v1/visits/active

- Roles: receptionist
- Description: list currently active patients for today.
- Query:
  - date default today
  - stage optional
  - page,pageSize
- Response 200:
  - items: [{active_session_id,patient_id,registration_number,full_name,current_stage,checkin_at,wait_minutes,assigned_staff_names}]
  - pagination meta
- DB operations:
  - Aggregate active_sessions match hospital/date/status + optional stage.
  - Lookup limited staff names and patient snapshot only.
  - Projection excludes stage notes.
- Performance:
  - Uses (hospital_id,visit_date,state.status) index; O(log n + k).

---

### Consultant

11. GET /api/v1/consultant/queue

- Roles: consultant
- Description: own queue ordered by wait/risk.
- Query: page,pageSize
- Response 200:
  - items: [{active_session_id,patient_summary,checkin_at,wait_minutes,risk_level?}]
- DB operations:
  - Match active_sessions by current_stage=counsellor, assignments.counsellor_id=user_id, stage_status in(waiting,in_progress).
  - Projection: patient_snapshot + counsellor_stage.risk_level.
- Performance:
  - Consultant queue compound index; O(log n + k).

12. POST /api/v1/consultant/sessions/{activeSessionId}/start

- Roles: consultant
- Description: mark session in-progress and lock stage.
- Response 200:
  - active_session_id
  - counsellor_started_at
  - stage_status=in_progress
- Errors:
  - 409 already started/locked by another user
- DB operations:
  - Acquire active_locks doc (unique).
  - Update active_sessions stage_status + counsellor_started_at + participants add user.
  - Transaction recommended (lock + update).
- Performance:
  - O(log n).

13. GET /api/v1/consultant/sessions/{activeSessionId}/context

- Roles: consultant
- Description: get consultation context.
- Response 200:
  - current_patient:
    - id, registration_number, full_name, age, gender, phone, addiction_type, allergies, medical_history
  - previous_visit_summaries: max 5
    - visit_id, visit_date, diagnosis_summary, risk_level, doctor_name, medicines_summary
  - previous_consultant_notes: max 5
    - visit_id, date, session_notes_summary, mood_assessment, risk_level, follow_up_required
- DB operations:
  - Read active_sessions by \_id projection patient_snapshot + minimal med/allergy.
  - Read visits by patient_id sorted completed_at desc limit 5 projection only summary fields.
  - No full embedded doctor_stage/notes blob except summary snippets.
- Performance:
  - patient_id + completed_at index; O(log n + 5).

14. POST /api/v1/consultant/sessions/{activeSessionId}/notes

- Roles: consultant
- Description: submit counsellor notes.
- Request body:
  - session_notes: String required
  - mood_assessment: Number 1-10 optional
  - risk_level: String required
  - recommendations: String optional
  - follow_up_required: Boolean required
- Response 200:
  - active_session_id
  - counsellor_completed_at
  - risk_level
- Errors:
  - 400 invalid ranges
  - 409 version conflict
- DB operations:
  - Update active_sessions counsellor_stage fields, counsellor_completed_at, version +1.
- Performance:
  - O(log n); optimistic concurrency on version.

15. PATCH /api/v1/consultant/sessions/{activeSessionId}/assign-doctor

- Roles: consultant
- Description: assign patient to doctor and move stage.
- Request body:
  - doctor_id: ObjectId required
- Response 200:
  - active_session_id
  - current_stage=doctor
  - assigned_doctor_id
- DB operations:
  - Update active_sessions filter \_id + current_stage=counsellor.
  - Set assignments.doctor_id, state.current_stage=doctor, state.stage_status=waiting.
- Performance:
  - doctor queue index ready for next read.

16. GET /api/v1/consultant/history

- Roles: consultant
- Description: own past attended sessions.
- Query:
  - q optional (patient name/registration)
  - from,to optional
  - page,pageSize
- Response 200:
  - items: [{visit_id,visit_date,patient_id,patient_name,registration_number,risk_level,mood_assessment,follow_up_required,session_duration_minutes,session_notes_preview}]
  - pagination meta
- DB operations:
  - Read visits match assignments.counsellor_id=user_id + completed date range.
  - Optional text/regex on patient_snapshot fields.
  - Projection excludes doctor/pharmacy heavy blocks.
- Performance:
  - (hospital_id,assignments.counsellor_id,completed_at) index; O(log n + k).

---

### Doctor

17. GET /api/v1/doctor/queue

- Roles: doctor
- Description: own queue with counsellor preview and risk.
- Query: page,pageSize
- Response 200:
  - items: [{active_session_id,patient_summary,counsellor_summary{risk_level,mood_assessment,session_notes_preview,recommendations},wait_from_counsellor_end}]
- DB operations:
  - Match active_sessions current_stage=doctor and assignments.doctor_id=user_id.
  - Sort by counsellor risk high first then counsellor_completed_at asc.
  - Projection excludes full pharmacy data.
- Performance:
  - doctor queue index; O(log n + k).

18. POST /api/v1/doctor/consultations/{activeSessionId}/start

- Roles: doctor
- Description: start doctor session.
- Response 200:
  - doctor_started_at
  - stage_status=in_progress
- DB operations:
  - lock stage + update timestamps/participants (transaction).
- Performance:
  - O(log n).

19. GET /api/v1/doctor/consultations/{activeSessionId}/context

- Roles: doctor
- Description: full exam context.
- Response 200:
  - current_patient summary with allergies/current meds
  - counsellor_notes_current_visit full
  - previous_doctor_notes: max 5 (diagnosis,treatment_plan_preview,vitals,next_visit_date,doctor_name,date)
  - previous_prescriptions: max 5 visits summary (medicine names,frequency,duration)
- DB operations:
  - Read active_sessions with counsellor_stage + patient_snapshot.
  - Read visits by patient_id limit 5 projection doctor_stage summary + prescription snapshots.
- Performance:
  - patient_id index; O(log n + 5).

20. POST /api/v1/doctor/consultations/{activeSessionId}/findings

- Roles: doctor
- Description: save doctor findings before/with prescription.
- Request body:
  - diagnosis: String required
  - treatment_plan: String optional
  - clinical_notes: String optional
  - vital_signs: {blood_pressure?,pulse?,weight_kg?,temperature_f?}
  - next_visit_date: Date optional
- Response 200:
  - active_session_id
  - diagnosis
  - updated_at
- DB operations:
  - Update active_sessions.doctor_stage findings fields only.
- Performance:
  - O(log n).

21. POST /api/v1/doctor/consultations/{activeSessionId}/prescriptions

- Roles: doctor
- Description: upsert prescription list for active visit.
- Request body:
  - items: Array required min1
    - medicine_id: ObjectId
    - dosage: String
    - frequency: enum
    - duration_days: Number
    - quantity: Number
    - instructions?: String
- Response 200:
  - active_session_id
  - items_count
  - medicine_availability_summary
- Errors:
  - 400 invalid items
  - 409 insufficient stock (optional strict reserve mode)
- DB operations:
  - Validate medicines exist and active via medicines collection projection: \_id,name,unit,stock_quantity,is_active.
  - Update active_sessions.doctor_stage.prescriptions.
- Performance:
  - medicine \_id index; O(m log n), m small.

22. PATCH /api/v1/doctor/consultations/{activeSessionId}/assign-pharmacy

- Roles: doctor
- Description: complete doctor stage and move to pharmacy queue.
- Request body:
  - pharmacist_id: ObjectId required
- Response 200:
  - current_stage=pharmacy
  - doctor_completed_at
- DB operations:
  - Update active_sessions set state.current_stage/pharmacy assignment and doctor_completed_at.
- Performance:
  - pharmacy queue index supports downstream read.

23. GET /api/v1/medicines/search

- Roles: doctor, pharmacy
- Description: medicine search for prescription dropdown.
- Query:
  - q optional
  - category optional
  - inStockOnly default true
  - page,pageSize
- Response 200:
  - items: [{medicine_id,name,generic_name,category,unit,stock_quantity,price_per_unit,reorder_level}]
  - pagination meta
- DB operations:
  - Query medicines by hospital_id + is_active + optional filters.
  - Projection excludes created_by/audit fields.
- Performance:
  - text index on name/generic_name, category/is_active indexes; O(log n + k).

24. GET /api/v1/doctor/history

- Roles: doctor
- Description: own past treated patients and prescription summary.
- Query:
  - q optional (name/registration/diagnosis)
  - from,to optional
  - page,pageSize
- Response 200:
  - items: [{visit_id,visit_date,patient_summary,diagnosis,treatment_plan_preview,vital_signs_summary,prescription_summary[],next_visit_date}]
- DB operations:
  - visits match assignments.doctor_id=user_id with range filters and optional text.
  - projection excludes counsellor/pharmacy heavy objects.
- Performance:
  - (doctor_id,completed_at) index; O(log n + k).

---

### Pharmacy

25. GET /api/v1/pharmacy/queue

- Roles: pharmacy
- Description: own pending dispense queue.
- Query: page,pageSize
- Response 200:
  - items: [{active_session_id,patient_summary,prescription_preview[{medicine_name,qty,unit}],doctor_completed_at,pending_items_count}]
- DB operations:
  - active_sessions match current_stage=pharmacy + assignments.pharmacist_id=user_id.
  - Projection: patient_snapshot + doctor_stage.prescriptions minimal.
- Performance:
  - pharmacy queue index; O(log n + k).

26. GET /api/v1/pharmacy/dispense/{activeSessionId}

- Roles: pharmacy
- Description: full dispense detail page data.
- Response 200:
  - patient_summary
  - doctor_notes_summary {diagnosis,treatment_plan,next_visit_date}
  - prescription_items full for dispense table
- DB operations:
  - Read active_sessions by \_id projection patient_snapshot + doctor_stage.
  - Optional medicine lookup for latest stock/price (single aggregate with lookup).
- Performance:
  - \_id index O(log n).

27. POST /api/v1/pharmacy/dispense/{activeSessionId}

- Roles: pharmacy
- Description: mark selected prescription items as dispensed and deduct stock.
- Request body:
  - items: Array required
    - medicine_id
    - quantity_dispensed
    - selected_for_dispense Boolean
  - dispensing_notes?: String
- Response 200:
  - active_session_id
  - dispensed_items_count
  - stock_updates[{medicine_id,stock_before,stock_after}]
- Errors:
  - 409 insufficient stock / concurrent update
- DB operations:
  - Transaction across hms_archive.medicines + hms_archive.inventory_transactions + hms_active.active_sessions:
    - For each selected item: atomic stock decrement with guard stock_quantity >= qty.
    - Insert inventory_transactions out records.
    - Update active_sessions.pharmacy_stage.dispense_items and timestamps.pharmacy_started_at/completed_at.
- Performance:
  - medicine \_id index; O(m log n), m is medicines in prescription.

28. POST /api/v1/pharmacy/visits/{activeSessionId}/close

- Roles: pharmacy
- Description: atomically archive completed visit then remove active session.
- Response 200:
  - visit_id (archive)
  - patient_id
  - archived_at
- Errors:
  - 409 not eligible (doctor stage incomplete or no dispensed items)
  - 500 archive transaction failure
- DB operations (single Mongo transaction spanning both databases on same cluster):
  - Read active_sessions by \_id with full stage data.
  - Insert hms_archive.visits document (single embedded summary object).
  - Update hms_archive.patients:
    - push visit_id into visit_ids
    - increment visit_count
    - set last_visit_at
  - Delete hms_active.active_sessions document only after insert/update success.
  - Remove active_locks for session.
- Performance:
  - all key operations by \_id, O(log n).
- Notes:
  - this endpoint is the canonical completion boundary.

29. GET /api/v1/pharmacy/inventory

- Roles: pharmacy, doctor(read-only optional)
- Description: list inventory with low-stock filtering.
- Query:
  - q optional
  - stockFilter all|low|out
  - category optional
  - page,pageSize
- Response 200:
  - items: [{medicine_id,name,generic_name,category,unit,price_per_unit,stock_quantity,reorder_level,expiry_date,is_active,stock_status}]
- DB operations:
  - Query medicines with projection of display fields only.
- Performance:
  - category/is_active/stock indexes + text index; O(log n + k).

30. PATCH /api/v1/pharmacy/inventory/{medicineId}/stock

- Roles: pharmacy
- Description: add stock when new stock arrives.
- Request body:
  - quantity_add: Number required >0
  - notes?: String
- Response 200:
  - medicine_id
  - stock_before
  - stock_after
- DB operations:
  - Transaction:
    - update medicines $inc stock_quantity
    - insert inventory_transactions type=in
- Performance:
  - \_id index O(log n).

31. POST /api/v1/pharmacy/inventory

- Roles: pharmacy
- Description: add new medicine.
- Request body:
  - name required
  - generic_name?
  - category?
  - manufacturer?
  - unit required
  - price_per_unit required
  - stock_quantity default 0
  - reorder_level required
  - expiry_date?
- Response 200:
  - medicine_id + key display fields
- Errors:
  - 409 duplicate medicine_uid/name policy conflict
- DB operations:
  - Insert medicines.
- Performance:
  - unique medicine_uid index O(log n).

32. GET /api/v1/pharmacy/history

- Roles: pharmacy
- Description: own past dispenses (not invoices).
- Query:
  - q optional patient/registration/medicine
  - from,to
  - page,pageSize
- Response 200:
  - items: [{visit_id,visit_date,patient_summary,dispensed_items_count,dispensed_medicines_summary,pharmacist_name,completed_at}]
- DB operations:
  - Query visits by assignments.pharmacist_id=user_id and completed_at range.
  - Projection excludes large counsellor/doctor notes.
- Performance:
  - pharmacist index O(log n + k).

---

### Patient Records (Cross-role access)

33. GET /api/v1/patients/{patientId}/summary

- Roles: receptionist, consultant, doctor
- Description: basic profile + visit count.
- Response 200:
  - patient_id, registration_number, full_name, age, gender, phone, addiction_type, status, visit_count, last_visit_at
- DB operations:
  - read patients projection minimal.
- Performance:
  - \_id index O(log n).

34. GET /api/v1/patients/{patientId}/history

- Roles: consultant, doctor
- Description: paginated visit summaries (not full docs).
- Query:
  - page,pageSize
  - from,to optional
- Response 200:
  - items: [{visit_id,visit_date,risk_level,diagnosis_summary,doctor_name,prescription_summary,next_visit_date,completed_at}]
- DB operations:
  - visits by patient_id with projection of summary fields only.
  - no full stage dumps.
- Performance:
  - (patient_id,visit_date desc) index O(log n + k).

35. GET /api/v1/visits/{visitId}

- Roles: consultant, doctor
- Description: full specific visit detail (drill-down).
- Response 200:
  - complete archived visit record sections:
    - patient_snapshot
    - lifecycle timestamps
    - counsellor_stage full
    - doctor_stage full
    - prescription_items full
    - pharmacy_stage full
- DB operations:
  - read visits by \_id + hospital_id.
  - relationship check: requester participated in visit OR currently assigned in active session OR is receptionist with checkin relationship.
- Performance:
  - \_id index O(log n).

---

### Endpoint-level relationship enforcement rule

For all patient-data endpoints, before returning data:

- Build access predicate:
  - active assignment in active_sessions (consultant/doctor/pharmacy),
  - historical assignment in visits for that patient,
  - receptionist relation if created checkin/active session.
- If predicate false: 403.
- Implement as one pre-check query with projection of only \_id and assignment fields.

---

### Explicitly out of scope

- Admin endpoints
- Invoice generation/payment processing endpoints as business domain
- SMS/email notifications, analytics, scheduling, billing systems

Note: The current frontend includes invoice screens in demo mode; backend production spec above intentionally omits invoice business APIs per scope constraint and keeps pharmacy history based on dispenses.

---

## Section 4: Architecture Notes

### Embedding vs referencing decisions

- Active flow uses embedded stage objects in active_sessions because each role appends data to one traveling object; this minimizes cross-collection joins and makes queue/context endpoints single-read.
- Archive visits embed complete stage snapshots and prescription snapshots to preserve immutable historical truth and avoid reconstruction joins.
- Patients, staff, medicines remain referenced master entities to avoid data duplication and support independent updates.
- Patient snapshot is embedded in active and archived visit documents for read speed and historical consistency.

### Index strategy mapped to query patterns

- Queue endpoints rely on stage+assignment compound indexes in active_sessions.
- Search endpoints rely on text indexes for names/registration/medicine names.
- History endpoints rely on assignment_id + completed_at descending indexes in visits.
- Fingerprint lookup relies on unique exact hash index.
- Duplicate-active-visit prevention relies on unique partial index (patient_id + visit_date + in_progress).

### Atomic archive close

- Visit close is a single transaction:
  1. insert archive visit
  2. update patient visit refs/counters
  3. delete active session
- If any step fails, none are committed.
- Active session is never deleted before archive write success.

### Performance and scalability concerns

- High queue volume: keep active_sessions document bounded; do not append unbounded event logs into same doc.
- Text search at scale: move to Atlas Search when patient and medicine catalogs grow.
- Stock contention: use conditional stock decrement in transactions to prevent overselling.
- Hotspot risk on medicines: for very high write rates, sharding by hospital_id and hashed \_id is recommended.
- Large patient history responses: enforce strict summary projection and pagination, fetch full detail only by visit drill-down.

### Auditing and reliability

- inventory_transactions and archived visits are immutable ledgers.
- Include archive_txn_id and version for traceability.
- Use optimistic concurrency version field in active_sessions updates.

### Recommended backend stack

Recommendation: Node.js + TypeScript with NestJS + MongoDB driver/Mongoose (or native driver for tighter transaction control).

Why this fits this HMS:

- Frontend is Next.js/TypeScript; shared DTO schemas and validation are easier end-to-end.
- Queue-like stage transitions benefit from event-driven, non-blocking I/O.
- Strong support for JWT auth, guards, role decorators, and request validation.
- Good fit for MongoDB transactional patterns required at close-visit and stock deduction boundaries.

Django would also work, but for this codebase and expected frequent stage-status reads/writes, TypeScript alignment and lower integration friction make Node.js/NestJS the more pragmatic production choice.

### Final implementation guardrails

- Enforce projection-by-default in repository layer.
- Enforce role and relationship checks in centralized authorization middleware.
- Make all list endpoints paginated by default.
- Keep biometric raw templates out of persistence; store only SHA-256 hash and metadata.
