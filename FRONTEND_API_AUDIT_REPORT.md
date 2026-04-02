# Frontend API Audit Report

## Summary
- Total pages audited: 28
- Total layout/route guards audited: 6
- Total major shared components audited: 6
- Total frontend API functions audited: 13 (10 used by pages, 3 currently unused)
- Total external API endpoints used: 2
- Auth mechanism: Auth context + localStorage token/user persistence + role-gated layouts
- Runtime mode split:
  - Live API mode when NEXT_PUBLIC_USE_DEMO_DATA is false and NEXT_PUBLIC_API_URL is set
  - Demo mode fallback when NEXT_PUBLIC_USE_DEMO_DATA is true or API URL is missing
- API base URL source: [lib/api-client.ts](lib/api-client.ts) and [.env.local.example](.env.local.example)

---

## Page: Root Redirect
**Route:** /  
**File:** [app/page.tsx](app/page.tsx)  
**Purpose:** Redirects authenticated users to role home routes, otherwise to login.

### Data Requirements
- Entities: Auth user from context
- Fields used:
  - user.role
  - isLoading
- Forms: none
- Filters/pagination: none

### API Calls
No direct backend calls from this page.

### Notes / Flags
- Redirect uses window.location.href, full page reload behavior.

---

## Page: Login
**Route:** /login  
**File:** [app/login/page.tsx](app/login/page.tsx)  
**Purpose:** Authenticates user and redirects to role dashboard.

### Data Requirements
- Entities: Auth credentials and mapped user
- Form fields submitted:
  - email: string
  - password: string
- Fields displayed/used:
  - localStorage hms_user role for post-login redirect
- Filters/pagination: none

### API Calls

#### Call 1: Login
| Field | Detail |
|---|---|
| Purpose | Authenticate user |
| HTTP Method | POST |
| Endpoint URL | /api/v1/auth/login/ |
| Called From | [lib/auth-context.tsx](lib/auth-context.tsx), login function via apiLogin |
| Trigger | Form submit in [app/login/page.tsx](app/login/page.tsx) |
| Request Headers | Content-Type: application/json |
| Request Body / Params | { email: string, password: string } |
| Expected Response Shape | { access_token, refresh_token, token_type, expires_in, user: { id, full_name, email, role, hospital_id? } } |
| How Response is Used | Maps backend role to frontend role; stores hms_user and hms_access_token in localStorage; redirects by role |
| Error Handling | Displays inline error alert with returned error message |

### Notes / Flags
- In login page, redirect role is read from localStorage hms_user even after auth context already has mapped user.
- Demo credentials are hardcoded in UI and auth context.

---

## Page: Admin Dashboard
**Route:** /admin  
**File:** [app/admin/page.tsx](app/admin/page.tsx)  
**Purpose:** Shows administrative operational analytics and alerts.

### Data Requirements
- Entities: Patient, Visit, Medicine, Invoice, User from demo store
- Fields used extensively:
  - patient.full_name, patient.registration_number, patient.addiction_type, patient.date_of_birth
  - visit.visit_date, visit.status, visit.current_stage
  - medicine.name, medicine.stock_quantity, medicine.reorder_level, medicine.expiry_date
  - invoice.invoice_date, invoice.grand_total
  - user.role
- Forms: none
- Filters/pagination: none

### API Calls
No backend API calls. Reads demo store only.

### Notes / Flags
- Pure frontend aggregation logic; no backend synchronization in this page.

---

## Page: Admin Patients
**Route:** /admin/patients  
**File:** [app/admin/patients/page.tsx](app/admin/patients/page.tsx)  
**Purpose:** Admin CRUD view for patient records.

### Data Requirements
- Entities: Patient, Visit
- Displayed fields:
  - registration_number, full_name, patient_category, date_of_birth, gender, phone, status
  - aadhaar_number, address, city, state, pincode
  - blood_group, addiction_type, addiction_duration, first_visit_date
  - medical_history, allergies
  - emergency_contact_name, emergency_contact_phone
- Form fields edited:
  - full_name, patient_category, status, date_of_birth, gender, phone, aadhaar_number
  - address, city, state, pincode
  - blood_group, addiction_type, addiction_duration
  - medical_history, allergies
  - emergency_contact_name, emergency_contact_phone
- Filters/search:
  - searchQuery over name/registration/phone/aadhaar
  - categoryFilter
  - statusFilter

### API Calls
No backend API calls. Uses demo store mutations:
- updatePatient
- deletePatient

### Notes / Flags
- Export button exists but no backend export call.
- All edits are local to demo store.

---

## Page: Admin Profile
**Route:** /admin/profile  
**File:** [app/admin/profile/page.tsx](app/admin/profile/page.tsx)  
**Purpose:** Admin profile, user management, and static system settings.

### Data Requirements
- Entities: Auth user, User list
- Profile fields:
  - full_name, email, phone
- New user form fields:
  - full_name, email, phone, role, password
- Edit user fields:
  - full_name, email, phone, role, is_active
- System settings fields:
  - hospital name/address/contact, hours
- Filters: none

### API Calls
No backend API calls. Uses demo store mutations:
- addUser
- updateUser
- deleteUser

### Notes / Flags
- Password change UI has no API integration.
- New user password is collected but not persisted in any auth backend path.

---

## Page: Admin Reports
**Route:** /admin/reports  
**File:** [app/admin/reports/page.tsx](app/admin/reports/page.tsx)  
**Purpose:** Administrative analytics and reporting across patients/visits/revenue/staff/inventory.

### Data Requirements
- Entities: Patient, Visit, Invoice, Medicine, User
- Key fields:
  - patient.patient_category, date_of_birth, created_at
  - visit.visit_date, status
  - invoice.invoice_date, grand_total
  - medicine.stock_quantity, reorder_level, expiry_date, category
  - user.role, is_active
- Form/filter fields:
  - dateRange.from, dateRange.to
  - categoryFilter
- Pagination: none

### API Calls
No backend API calls.

### Notes / Flags
- Date range controls are present; many calculations still derive from full local arrays and partial custom logic.

---

## Page: Admin Users Redirect
**Route:** /admin/users  
**File:** [app/admin/users/page.tsx](app/admin/users/page.tsx)  
**Purpose:** Redirects to admin profile page.

### Data Requirements
- None

### API Calls
No API calls.

### Notes / Flags
- Immediate client redirect to /admin/profile.

---

## Page: Reception Dashboard
**Route:** /reception  
**File:** [app/reception/page.tsx](app/reception/page.tsx)  
**Purpose:** Reception operational dashboard with quick actions and drill-down sheets.

### Data Requirements
- Entities: DashboardStats, Patient, Visit
- Fields used:
  - stats totalPatients/todayVisits/pendingCounsellor/pendingDoctor/pendingPharmacy/completedToday
  - patient.full_name, registration_number, date_of_birth, gender, phone, status, address/city/state/pincode
  - patient.addiction_type, addiction_duration, blood_group, emergency_contact_name/phone
  - visit.id, patient_id, checkin_time, current_stage, status
- Forms: none
- Filters/pagination: none (drill-down by card type)

### API Calls
No backend API calls.

### Notes / Flags
- Uses local stage strings including reception in some visual components, while typed visit stage union elsewhere includes checkin.

---

## Page: Reception Register
**Route:** /reception/register  
**File:** [app/reception/register/page.tsx](app/reception/register/page.tsx)  
**Purpose:** Fast patient registration with category selection, photo and fingerprint capture.

### Data Requirements
- Entities: Registration form + auth token
- Form fields:
  - patient_category: psychiatric | deaddiction
  - full_name: string
  - file_number: string
  - aadhaar_number: string (formatted 12-digit)
  - date_of_birth: date string
  - phone: string
  - relative_phone: string
  - address: string
  - fingerprint_template: string
  - photo: data URL string
- Validation:
  - category required
  - full_name, phone, date_of_birth required
  - relative_phone required
  - address required
  - aadhaar length must be 12 digits if provided
- Filters/pagination: none

### API Calls

#### Call 1: Register patient (Tier-1)
| Field | Detail |
|---|---|
| Purpose | Create minimal patient record |
| HTTP Method | POST |
| Endpoint URL | /api/v1/patients/register/ |
| Called From | [app/reception/register/page.tsx](app/reception/register/page.tsx), handleInstantSubmit |
| Trigger | Register submit button |
| Request Headers | Authorization: Bearer token, Content-Type: application/json |
| Request Body / Params | { full_name: string, phone_number: string, date_of_birth: string, sex: "male", fingerprint_hash: string } |
| Expected Response Shape | Uses registration_number from response, also patient_id/full_name/phone_number/date_of_birth/sex/status/outstanding_debt supported by type |
| How Response is Used | Shows success screen and File Number from result.registration_number |
| Error Handling | Toast error with thrown message |

### Notes / Flags
- Hardcoded sex is always male regardless of form data.
- file_number and patient_category are collected in UI but not sent to backend registration payload.
- Uniqueness checks for file and Aadhaar are stubs that always return true.

---

## Page: Reception Check-in
**Route:** /reception/checkin  
**File:** [app/reception/checkin/page.tsx](app/reception/checkin/page.tsx)  
**Purpose:** Searches patient, verifies fingerprint, performs check-in.

### Data Requirements
- Entities: Patient lookup result, RD service status, check-in state
- Search input:
  - searchQuery: string
- Mapped patient fields displayed:
  - id from patient_id
  - registration_number
  - full_name
  - phone from phone_number
  - date_of_birth
  - status
  - address from address_line1 when present
  - emergency_contact_phone when present
- Local verification state:
  - biometricVerified
  - verificationStep
- Filters/pagination: none

### API Calls

#### Call 1: Lookup patient
| Field | Detail |
|---|---|
| Purpose | Find patient before check-in |
| HTTP Method | GET |
| Endpoint URL | /api/v1/patients/lookup/?registration_number=value |
| Called From | [app/reception/checkin/page.tsx](app/reception/checkin/page.tsx), handleSearch |
| Trigger | Search button / Enter key |
| Request Headers | Authorization: Bearer token, Content-Type: application/json |
| Request Body / Params | Query params: registration_number (only this key is used from UI) |
| Expected Response Shape | patient_id, registration_number, full_name, phone_number, date_of_birth, status, optional address_line1, emergency_contact_phone |
| How Response is Used | Mapped into local LookupPatient and rendered in selection card |
| Error Handling | Clears results and shows toast |

#### Call 2: Check in patient
| Field | Detail |
|---|---|
| Purpose | Start session/queue flow |
| HTTP Method | POST |
| Endpoint URL | /api/v1/sessions/checkin/ |
| Called From | [app/reception/checkin/page.tsx](app/reception/checkin/page.tsx), handleCheckin |
| Trigger | Proceed to Queue button after biometric step |
| Request Headers | Authorization: Bearer token, Content-Type: application/json |
| Request Body / Params | { patient_id: string } |
| Expected Response Shape | session_id, patient_id, patient_name, checked_in_by_name, checked_in_at, status, outstanding_debt_at_checkin |
| How Response is Used | Only success state and toast; response fields are not rendered directly |
| Error Handling | Toast error |

### Notes / Flags
- Search placeholder says file/name/phone/aadhaar, but API query actually sends only registration_number.
- Check-in blocked for status dead in UI.
- Biometric verification is currently simulated, not actual matching.

---

## Page: Reception Patients
**Route:** /reception/patients  
**File:** [app/reception/patients/page.tsx](app/reception/patients/page.tsx)  
**Purpose:** Full patient master-data view and editor with extensive demographic/substance/medical fields and export.

### Data Requirements
- Entities: Patient, Visit
- Display/edit fields include almost full Patient contract:
  - IDs: registration_number, hdams_id, aadhaar_number
  - personal: full_name, date_of_birth, gender, blood_group, nationality, religion
  - contact: phone, relative_phone, emergency_contact_name/phone/relation
  - family: father_name, mother_name, grandfather_name, spouse_name
  - address: address, block_mc, city, district, state, pincode
  - socio-economic: education, occupation, employment_status, monthly_income, marital_status, living_arrangement
  - substance: substance_used_currently, substance_ever_used, injection_use_ever/currently, route_of_admission, syringe_sharing
  - medical: sti_std, jaundice, sex_with_sex_worker, hiv_screening, hiv_result, comorbid_medical_illness, comorbid_psychiatric_illness, previous_drug_treatment, ever_hospitalized, allergies
  - legacy: addiction_type, addiction_duration, first_visit_date, medical_history, family_history
- Filters/search:
  - searchQuery by registration_number/full_name/phone/aadhaar/hdams_id
  - filterDateFrom/filterDateTo on registration_date
  - filterAddictionType
  - filterDistrict
  - filterState
  - sortOrder by registration_number asc/desc
- Export:
  - CSV export with fixed header schema and mapped labels

### API Calls
No backend API calls.
- Uses demo store get/update operations only.

### Notes / Flags
- Exports local filtered dataset only.
- Very broad schema assumptions in frontend may drift from backend DTOs if not aligned.

---

## Page: Reception Queue Snapshot
**Route:** /reception/queue  
**File:** [app/reception/queue/page.tsx](app/reception/queue/page.tsx)  
**Purpose:** Displays throughput metrics instead of legacy stage queue.

### Data Requirements
- Entities: Reception reports response
- Fields used:
  - data.daily.total_checkins
  - data.monthly.total_checkins
  - data.yearly.total_checkins

### API Calls

#### Call 1: Reception reports
| Field | Detail |
|---|---|
| Purpose | Pull check-in throughput metrics |
| HTTP Method | GET |
| Endpoint URL | /api/v1/receptionist/reports/ |
| Called From | [app/reception/queue/page.tsx](app/reception/queue/page.tsx), useEffect |
| Trigger | On mount/token availability |
| Request Headers | Authorization: Bearer token, Content-Type: application/json |
| Request Body / Params | none |
| Expected Response Shape | daily.total_checkins, monthly.total_checkins, yearly.total_checkins |
| How Response is Used | Renders three metric cards |
| Error Handling | Sets data null (silent fallback in UI) |

### Notes / Flags
- No explicit loading/error state.

---

## Page: Reception Reports
**Route:** /reception/reports  
**File:** [app/reception/reports/page.tsx](app/reception/reports/page.tsx)  
**Purpose:** Daily/monthly/custom reports with patient drilldown and CSV export.

### Data Requirements
- Entities: Visit, Patient, optional backend report aggregate
- Daily fields:
  - visit: id, visit_date, checkin_time, current_stage, status
  - patient: registration_number, full_name, phone, date_of_birth, gender, blood_group, addiction_type, addiction_duration, emergency contact
- Monthly fields:
  - grouped by day, totals, uniquePatients, newRegistrations, averagePerDay
- Custom range fields:
  - total, completed, uniquePatients, list of visits
- Filters:
  - selectedDate
  - selectedMonth
  - startDate/endDate
- Export:
  - CSV headers File No/Patient Name/Phone/Visit Date/Check-in Time/Stage/Status

### API Calls

#### Call 1: Reception reports
| Field | Detail |
|---|---|
| Purpose | Backend aggregate report source (non-demo mode) |
| HTTP Method | GET |
| Endpoint URL | /api/v1/receptionist/reports/ |
| Called From | [app/reception/reports/page.tsx](app/reception/reports/page.tsx), useEffect |
| Trigger | On mount/token availability |
| Request Headers | Authorization: Bearer token, Content-Type: application/json |
| Request Body / Params | none |
| Expected Response Shape | Uses daily.total_checkins, monthly.total_checkins, yearly.total_checkins when backendReports present |
| How Response is Used | Replaces some aggregate counters; tables still use local visit data |
| Error Handling | Falls back to local store calculations |

### Notes / Flags
- Hybrid model: backend aggregates + local visit lists can diverge.
- Several detailed table/filter views remain demo-store driven even in API mode.

---

## Page: Counsellor Dashboard
**Route:** /counsellor  
**File:** [app/counsellor/page.tsx](app/counsellor/page.tsx)  
**Purpose:** Counsellor queue overview and quick navigation.

### Data Requirements
- Entities: Visit, Patient, CounsellorSession
- Fields:
  - visit.current_stage, checkin_time, id
  - patient.full_name, registration_number
  - session count today from sessions.created_at
- Forms/filters: none

### API Calls
No backend API calls.

### Notes / Flags
- Queue ordering by checkin_time ascending.

---

## Page: Counsellor Queue
**Route:** /counsellor/queue  
**File:** [app/counsellor/queue/page.tsx](app/counsellor/queue/page.tsx)  
**Purpose:** Full waiting list for counselling sessions.

### Data Requirements
- Entities: Visit + Patient
- Fields:
  - visit.id, visit.checkin_time
  - patient.full_name, registration_number, date_of_birth, gender, phone
- Forms/filters: none

### API Calls
No backend API calls.

---

## Page: Counsellor Session
**Route:** /counsellor/session/:visitId  
**File:** [app/counsellor/session/[visitId]/page.tsx](app/counsellor/session/[visitId]/page.tsx)  
**Purpose:** Records counselling session and forwards patient to doctor stage.

### Data Requirements
- Entities: Visit, Patient, CounsellorSession, Auth user
- Form fields submitted:
  - session_notes: string (required)
  - mood_assessment: number 1-10
  - risk_level: low | medium | high
  - recommendations: string
  - follow_up_required: boolean
- Derived fields:
  - session_duration_minutes
  - visit assignment/start/end timestamps
- Sidebar fields:
  - patient addiction/medical summary
  - previous session notes/risk/mood

### API Calls
No backend API calls.
- Writes local session and updates local visit stage to doctor.

### Notes / Flags
- Completion uses window.location.href to /counsellor after local write.

---

## Page: Counsellor Patients
**Route:** /counsellor/patients  
**File:** [app/counsellor/patients/page.tsx](app/counsellor/patients/page.tsx)  
**Purpose:** View/edit comprehensive patient profile and session/visit history.

### Data Requirements
- Uses near-complete Patient schema.
- Filters:
  - search by full_name/registration_number/phone/hdams_id
  - category filter all/psychiatric/deaddiction
- Profile sections:
  - personal, family, address/contact, education/employment, substance use, medical history
- Edit form mirrors profile sections with large field set.
- Session history fields:
  - created_at, session_duration_minutes, mood_assessment, risk_level, session_notes, recommendations
- Visit history:
  - visit_date, current_stage, checkin_time, status

### API Calls
No backend API calls.

### Notes / Flags
- Heavy reliance on label maps and optional field rendering.

---

## Page: Counsellor History
**Route:** /counsellor/history  
**File:** [app/counsellor/history/page.tsx](app/counsellor/history/page.tsx)  
**Purpose:** Lists completed counselling sessions with search.

### Data Requirements
- Entities: CounsellorSession + Patient
- Fields:
  - patient.full_name, registration_number
  - session.created_at, session_duration_minutes, mood_assessment, risk_level, session_notes, recommendations, follow_up_required
- Filter:
  - search by patient name or registration number

### API Calls
No backend API calls.

---

## Page: Counsellor Reports
**Route:** /counsellor/reports  
**File:** [app/counsellor/reports/page.tsx](app/counsellor/reports/page.tsx)  
**Purpose:** Daily/monthly counselling metrics and risk/mood breakdown.

### Data Requirements
- Entities: CounsellorSession, Patient, Visit, optional backend report
- Filters:
  - selectedDate
  - selectedMonth
- Aggregates:
  - total sessions
  - category split psychiatric/deaddiction
  - risk split high/medium/low
  - avg mood
  - monthly by-day breakdown

### API Calls

#### Call 1: Counsellor reports
| Field | Detail |
|---|---|
| Purpose | Pull backend follow-up/report aggregate |
| HTTP Method | GET |
| Endpoint URL | /api/v1/counsellor/reports/ |
| Called From | [app/counsellor/reports/page.tsx](app/counsellor/reports/page.tsx), useEffect |
| Trigger | On mount/token availability, non-demo mode |
| Request Headers | Authorization: Bearer token, Content-Type: application/json |
| Request Body / Params | none |
| Expected Response Shape | Uses backendReports.daily.total_followups and backendReports.monthly.total |
| How Response is Used | Replaces top-level totals while detailed rows remain local |
| Error Handling | Falls back to local store stats |

### Notes / Flags
- Same hybrid mismatch risk as reception reports.

---

## Page: Doctor Dashboard
**Route:** /doctor  
**File:** [app/doctor/page.tsx](app/doctor/page.tsx)  
**Purpose:** Doctor queue overview prioritizing high-risk patients.

### Data Requirements
- Entities: Visit, Patient, CounsellorSession, DoctorConsultation count
- Fields:
  - visit.current_stage, counsellor_end_time
  - patient.full_name, registration_number
  - session.risk_level
- Forms/filters: none

### API Calls
No backend API calls.

---

## Page: Doctor Queue
**Route:** /doctor/queue  
**File:** [app/doctor/queue/page.tsx](app/doctor/queue/page.tsx)  
**Purpose:** Detailed doctor waiting queue with counsellor note preview.

### Data Requirements
- Entities: Visit + Patient + CounsellorSession
- Fields:
  - patient.full_name, registration_number, addiction_type
  - session.risk_level, mood_assessment, session_notes, recommendations
  - visit.id, counsellor_end_time
- Forms/filters: none

### API Calls
No backend API calls.

---

## Page: Doctor Consultation
**Route:** /doctor/consultation/:visitId  
**File:** [app/doctor/consultation/[visitId]/page.tsx](app/doctor/consultation/[visitId]/page.tsx)  
**Purpose:** Creates consultation and prescriptions, then forwards to pharmacy.

### Data Requirements
- Entities: Visit, Patient, CounsellorSession, Medicine, DoctorConsultation, Prescription
- Form fields submitted:
  - diagnosis: string (required)
  - treatment_plan: string
  - clinical_notes: string
  - next_visit_date: date string
  - vital_signs:
    - blood_pressure: string
    - pulse: number
    - weight: number
    - temperature: number
  - prescription items array:
    - medicine_id: string
    - quantity: number
    - dosage: string
    - frequency: once_daily | twice_daily | thrice_daily | as_needed
    - duration_days: number
    - instructions: string
- Uses medicine fields:
  - id, name, stock_quantity, unit
- Filters: none

### API Calls
No backend API calls.
- Local writes: addConsultation, addPrescription, updateVisit stage to pharmacy.

### Notes / Flags
- Medicine availability uses local stock only.

---

## Page: Doctor History
**Route:** /doctor/history  
**File:** [app/doctor/history/page.tsx](app/doctor/history/page.tsx)  
**Purpose:** Lists previous consultations and associated prescriptions.

### Data Requirements
- Entities: DoctorConsultation + Patient + Prescription + Medicine
- Fields:
  - consultation diagnosis/treatment_plan/vital_signs/next_visit_date/created_at
  - patient.full_name/registration_number
  - prescription medicine name, dosage, frequency, duration_days
- Filters:
  - search by patient name/registration/diagnosis

### API Calls
No backend API calls.

---

## Page: Pharmacy Dashboard
**Route:** /pharmacy  
**File:** [app/pharmacy/page.tsx](app/pharmacy/page.tsx)  
**Purpose:** Shows pending dispense queue and inventory/revenue summary.

### Data Requirements
- Entities: Visit, Patient, Prescription, Medicine, Invoice
- Fields:
  - visit.current_stage
  - patient.full_name, registration_number
  - prescriptions length and medicine linkage
  - low stock count from stock_quantity/reorder_level
  - today invoices revenue
- Forms/filters: none

### API Calls
No backend API calls.

---

## Page: Pharmacy Queue
**Route:** /pharmacy/queue  
**File:** [app/pharmacy/queue/page.tsx](app/pharmacy/queue/page.tsx)  
**Purpose:** Displays active prescription queue from backend or demo fallback.

### Data Requirements
- Entities: QueueItem
- Fields rendered:
  - session_id, patient_name, checked_in_by_name, outstanding_debt, session_status
- Demo fallback fields from visits:
  - id mapped as session_id
  - patient full_name
- Forms/filters: none

### API Calls

#### Call 1: Pharmacy queue
| Field | Detail |
|---|---|
| Purpose | Fetch queue items for pharmacy |
| HTTP Method | GET |
| Endpoint URL | /api/v1/pharmacy/queue/ |
| Called From | [app/pharmacy/queue/page.tsx](app/pharmacy/queue/page.tsx), useEffect |
| Trigger | On mount/token availability in non-demo mode |
| Request Headers | Authorization: Bearer token, Content-Type: application/json |
| Request Body / Params | none |
| Expected Response Shape | items array cast to QueueItem with fields session_id, patient_id, patient_name, checked_in_at, checked_in_by_name, outstanding_debt, session_status |
| How Response is Used | Render queue cards and route to dispense page |
| Error Handling | Falls back to demo queue mapping |

### Notes / Flags
- Response typing is forced cast from unknown to QueueItem[].

---

## Page: Pharmacy Dispense
**Route:** /pharmacy/dispense/:visitId  
**File:** [app/pharmacy/dispense/[visitId]/page.tsx](app/pharmacy/dispense/[visitId]/page.tsx)  
**Purpose:** Dispenses selected prescriptions, updates inventory, generates invoice.

### Data Requirements
- Entities: Visit, Patient, DoctorConsultation, Prescription, Medicine, Invoice
- Form fields:
  - selected prescription booleans
  - discount: number percent
  - payment_method: cash | card | upi | insurance
- Computed billing fields:
  - consultationFee fixed 500
  - medicineTotal
  - subtotal
  - discountAmount
  - tax fixed 5%
  - grandTotal
- Invoice fields produced:
  - invoice_number, invoice_date, consultation_fee, medicine_total, discount, tax, grand_total, payment_status, payment_method
- Inventory operations:
  - inventory transaction out with quantity and reference id

### API Calls
No backend API calls.
- Local writes:
  - addInvoice
  - updatePrescription dispensed
  - addInventoryTransaction
  - updateVisit status completed

### Notes / Flags
- Uses fixed consultation fee and fixed 5% GST assumptions in frontend.

---

## Page: Pharmacy Inventory
**Route:** /pharmacy/inventory  
**File:** [app/pharmacy/inventory/page.tsx](app/pharmacy/inventory/page.tsx)  
**Purpose:** Lists inventory and performs medicine/stock mutations in API mode.

### Data Requirements
- Entities: Medicine list (backend mapped or demo)
- Display fields:
  - name, generic_name, category, unit, price_per_unit, stock_quantity, reorder_level
- Add medicine form fields:
  - name, generic_name, category, manufacturer, unit, price_per_unit, stock_quantity, reorder_level, expiry_date
- Add stock form fields:
  - selectedMedicine.id
  - stockToAdd: number
- Filters/search:
  - searchQuery by name/generic_name
  - filterStock all/low/out

### API Calls

#### Call 1: Get inventory
| Field | Detail |
|---|---|
| Purpose | Load inventory list |
| HTTP Method | GET |
| Endpoint URL | /api/v1/pharmacy/inventory/?q=&category=&page=1&pageSize=20 (query keys conditional) |
| Called From | [app/pharmacy/inventory/page.tsx](app/pharmacy/inventory/page.tsx), useEffect and post-mutation refresh |
| Trigger | On mount in API mode; after add medicine; after add stock |
| Request Headers | Authorization: Bearer token, Content-Type: application/json |
| Request Body / Params | Query params q, category, page, pageSize |
| Expected Response Shape | items array where each item has medicine_id, name, category, description, unit, unit_price, stock_quantity, is_active |
| How Response is Used | Mapped into local Medicine-like objects with hardcoded reorder_level 50 |
| Error Handling | Fallback to demo store list |

#### Call 2: Add medicine
| Field | Detail |
|---|---|
| Purpose | Create new inventory medicine |
| HTTP Method | POST |
| Endpoint URL | /api/v1/pharmacy/inventory/ |
| Called From | [app/pharmacy/inventory/page.tsx](app/pharmacy/inventory/page.tsx), handleAddMedicine |
| Trigger | Add Medicine dialog submit |
| Request Headers | Authorization: Bearer token, Content-Type: application/json |
| Request Body / Params | { name, category, unit, unit_price, stock_quantity, description } |
| Expected Response Shape | Not directly used; immediate refetch via getInventory |
| How Response is Used | Refreshes table |
| Error Handling | Toast error |

#### Call 3: Add medicine stock
| Field | Detail |
|---|---|
| Purpose | Increase stock quantity |
| HTTP Method | POST |
| Endpoint URL | /api/v1/pharmacy/inventory/:medicineId/stock/ |
| Called From | [app/pharmacy/inventory/page.tsx](app/pharmacy/inventory/page.tsx), handleAddStock |
| Trigger | Add Stock dialog submit |
| Request Headers | Authorization: Bearer token, Content-Type: application/json |
| Request Body / Params | { quantity_to_add: number } |
| Expected Response Shape | Not directly used; immediate refetch via getInventory |
| How Response is Used | Refreshes table and closes dialog |
| Error Handling | Toast error |

### Notes / Flags
- In demo mode, mutation is intentionally blocked with toast.
- Reorder level is hardcoded to 50 for mapped backend items.

---

## Page: Pharmacy Invoices
**Route:** /pharmacy/invoices  
**File:** [app/pharmacy/invoices/page.tsx](app/pharmacy/invoices/page.tsx)  
**Purpose:** Displays generated invoice history and revenue totals.

### Data Requirements
- Entities: Invoice + Patient
- Fields:
  - invoice_number, invoice_date, payment_status, payment_method
  - consultation_fee, medicine_total, discount, tax, grand_total
  - patient.full_name, patient.registration_number
- Filters:
  - search by patient name / invoice number / registration number

### API Calls
No backend API calls.

---

## Layout / Guard Components

### Root Layout
**Route Scope:** all routes  
**File:** [app/layout.tsx](app/layout.tsx)  
- Wraps app in AuthProvider and toaster.
- No API calls directly.

### Admin Layout
**Route Scope:** /admin/*  
**File:** [app/admin/layout.tsx](app/admin/layout.tsx)  
- Requires role admin.

### Reception Layout
**Route Scope:** /reception/*  
**File:** [app/reception/layout.tsx](app/reception/layout.tsx)  
- Requires role reception or admin.

### Counsellor Layout
**Route Scope:** /counsellor/*  
**File:** [app/counsellor/layout.tsx](app/counsellor/layout.tsx)  
- Requires role counsellor or admin.

### Doctor Layout
**Route Scope:** /doctor/*  
**File:** [app/doctor/layout.tsx](app/doctor/layout.tsx)  
- Requires role doctor or admin.

### Pharmacy Layout
**Route Scope:** /pharmacy/*  
**File:** [app/pharmacy/layout.tsx](app/pharmacy/layout.tsx)  
- Requires role pharmacist or admin.

---

## Major Shared Components

## Component: Sidebar and Role Navigation
**File:** [components/dashboard-sidebar.tsx](components/dashboard-sidebar.tsx)  
**Purpose:** Role-specific navigation menu and logout panel.

### Data Requirements
- user.role drives nav tree
- role route maps:
  - admin: dashboard/users/patients/reports/profile
  - reception: dashboard/checkin/register/patients/reports/queue
  - counsellor: dashboard/queue/patients/reports/history
  - doctor: dashboard/queue/history
  - pharmacist: dashboard/queue/inventory/invoices
- currentPath tracked with:
  - popstate listener
  - 100ms setInterval polling of pathname

### API Calls
No backend calls.

### Notes / Flags
- Route watching polls every 100ms, which is an ongoing timer.

---

## Component: Patient Card
**File:** [components/patient-card.tsx](components/patient-card.tsx)  
**Purpose:** Standard patient summary card used in queue-like pages.

### Data Requirements
- patient fields: full_name, photo_url, registration_number, date_of_birth, gender, phone, addiction_type, addiction_duration
- optional visit.current_stage
- optional waitTime

### API Calls
None.

---

## Component: Patient Flow Tracker
**File:** [components/patient-flow-tracker.tsx](components/patient-flow-tracker.tsx)  
**Purpose:** Visual pipeline count by current stage.

### Data Requirements
- visit.current_stage and visit.status

### API Calls
None.

### Notes / Flags
- Uses stage key reception in UI mapping, while core type VisitStage uses checkin.

---

## Component: Analytics Cards
**File:** [components/analytics-cards.tsx](components/analytics-cards.tsx)  
**Purpose:** Charts for addiction mix, stage distribution, and 7-day trend.

### Data Requirements
- patients.addiction_type
- visits.visit_date and current_stage

### API Calls
None.

---

## Component: Search Filter Bar
**File:** [components/search-filter-bar.tsx](components/search-filter-bar.tsx)  
**Purpose:** Reusable local search/filter control.

### Data Requirements
- query string and key/value filter map

### API Calls
None.

---

## Component: Status Badge Set
**File:** [components/status-badge.tsx](components/status-badge.tsx)  
**Purpose:** Unified stage/risk/payment/stock badges.

### Data Requirements
- stage strings, risk level, payment status, stock quantity thresholds

### API Calls
None.

---

## Authentication & Authorization

- Core auth context: [lib/auth-context.tsx](lib/auth-context.tsx)
- Login backend call: /api/v1/auth/login/
- Token storage:
  - hms_access_token in localStorage
  - user object in hms_user (or demo_user in demo mode)
- Token attachment:
  - centralized in [lib/api-client.ts](lib/api-client.ts)
  - Authorization: Bearer token when token is passed
- Protected route behavior:
  - role checks in per-domain layout files listed above
  - redirect to /login on unauthorized
- Role mapping from backend:
  - receptionist -> reception
  - consultant -> counsellor
  - pharmacy -> pharmacist
  - doctor -> doctor
- Role-based UI differences:
  - Navigation menu differs by role in [components/dashboard-sidebar.tsx](components/dashboard-sidebar.tsx)
  - Layout access gates differ by route group

---

## State Management & Data Flow

- Primary approaches:
  - React local component state for form/view state
  - Auth Context for user/session token
  - DemoStore singleton for domain data in demo/local mode
- DemoStore:
  - In-memory singleton with localStorage persistence
  - Storage keys:
    - aggarwal_hospital_patients
    - aggarwal_hospital_visits
    - aggarwal_hospital_sessions
    - aggarwal_hospital_consultations
    - aggarwal_hospital_prescriptions
    - aggarwal_hospital_invoices
    - aggarwal_hospital_inventory
    - aggarwal_hospital_medicines
- API response caching:
  - No dedicated cache layer (no SWR/React Query/Redux)
  - Pages keep fetched API data in local state; many pages fallback to store
- Polling/realtime:
  - No websocket/SSE
  - Sidebar path watcher uses 100ms setInterval (navigation state polling only)

---

## Third-Party / External API Calls

### External Call 1: RD service info
- File: [lib/biometric.ts](lib/biometric.ts)
- Endpoint: https://localhost:11100/rd/info
- Method: RDSERVICE
- Purpose: Detect biometric RD service and device info
- Response usage:
  - Parses XML RDService attributes info, dpId, status
- Error handling:
  - Marks device unavailable and returns friendly error text

### External Call 2: RD capture
- File: [lib/biometric.ts](lib/biometric.ts)
- Endpoint: https://localhost:11100/rd/capture
- Method: CAPTURE
- Request body:
  - XML PidOptions payload
- Purpose: Capture fingerprint PID XML
- Response usage:
  - Parses XML Resp errCode/errInfo and returns success/data or error
- Error handling:
  - timeout and generic capture error handling

---

## Hardcoded Values & Assumptions

- Base URL and mode assumptions:
  - NEXT_PUBLIC_API_URL default empty -> demo mode fallback in [lib/runtime-mode.ts](lib/runtime-mode.ts)
  - Example env hardcodes http://0.0.0.0:8000/ in [.env.local.example](.env.local.example)
- API response envelope assumption in [lib/api-client.ts](lib/api-client.ts):
  - Expects payload.success not false
  - Expects payload.data for actual DTO
  - Expects payload.error.message for errors
- Global request header assumption:
  - Content-Type always application/json even for GETs
- Registration hardcoding:
  - sex sent as male in reception register flow
- Billing hardcoding:
  - consultation fee fixed 500
  - GST fixed 5%
- Inventory mapping hardcoding:
  - reorder_level forced to 50 for backend inventory records
- Stage/status enums hardcoded in many views:
  - active/inactive/dead/discharged
  - in_progress/completed
  - counsellor/doctor/pharmacy/completed
- Queue/search UI assumptions:
  - checkin search placeholder suggests multiple lookup modes but only registration_number is sent
- Runtime fallback assumptions:
  - API failures often silently fallback to demo store data in reports and queue pages
- Type/model mismatch risk in demo seed:
  - demo medicines include fields like dosage_form, unit_price, batch_number while type expects unit and price_per_unit; frontend compensates in places but shape mismatch risk remains
- Unsafe casts:
  - Pharmacy queue casts unknown response items to QueueItem without runtime validation

---

## Global Observations

- Pattern 1: Mixed runtime model
  - Several pages are fully demo-store only.
  - Some pages use backend only for aggregates while detail tables remain local store driven.
  - This can produce mismatched totals across widgets and tables.

- Pattern 2: Thin API abstraction
  - All backend calls go through [lib/hms-api.ts](lib/hms-api.ts) + [lib/api-client.ts](lib/api-client.ts), which is good for endpoint centralization.
  - However, many defined API functions are currently unused by pages:
    - /api/v1/counsellor/followup/
    - /api/v1/counsellor/patients/:id/status/
    - /api/v1/pharmacy/reports/

- Pattern 3: Role security is client-side route gating
  - Layout checks block UI, but there is no frontend evidence of backend route-level auth checks from this audit scope.

- Pattern 4: Error handling consistency
  - Most API pages use toast or fallback states.
  - Some pages silently set null/fallback on failure, with minimal user visibility.

- Pattern 5: Integration fragility points to verify against backend audit
  - Response envelope shape payload.data/payload.success
  - Registration payload missing many UI-collected fields
  - Hardcoded sex field
  - Pharmacy queue response cast
  - Inventory item mapping and fixed reorder_level
  - Stage naming drift between checkin and reception labels

If you want, I can produce a second artifact next: a strict endpoint-by-endpoint mismatch checklist template keyed to this report so your backend audit can be compared line-by-line quickly.
