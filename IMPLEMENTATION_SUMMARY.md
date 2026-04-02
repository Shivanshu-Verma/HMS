# HMS Backend Re-Integration Summary

## Overview
This implementation realigns the Django + MongoEngine backend with the redesigned HMS workflow:
- Tiered patient registration and general-data completion tracking
- Counsellor follow-up and status-action workflow
- Receptionist check-in and reports workflow
- Pharmacist-led dispense, checkout, debt, and inventory workflow
- Debt-aware visit archival transaction

## Architecture Notes
- MongoDB remains the only persistence backend for archive and active data.
- No task queue, caching layer, invoice generation, or notifications were introduced.
- Follow-up threshold is centrally defined as `FOLLOWUP_THRESHOLD_DAYS = 30` in settings.
- Doctor module endpoints remain present in the codebase but are now dormant from the active frontend contract.

## API Endpoints (Current)

### Patients
- `POST /api/v1/patients/register/`
- `GET /api/v1/patients/lookup/`
- `GET /api/v1/patients/{patient_id}/`
- `PATCH /api/v1/patients/{patient_id}/general/`

### Sessions
- `POST /api/v1/sessions/checkin/`

### Counsellor
- `GET /api/v1/counsellor/followup/`
- `PATCH /api/v1/counsellor/patients/{patient_id}/status/`
- `GET /api/v1/counsellor/reports/`

### Receptionist
- `GET /api/v1/receptionist/reports/`

### Pharmacy
- `GET /api/v1/pharmacy/queue/`
- `GET /api/v1/pharmacy/session/{session_id}/`
- `GET /api/v1/pharmacy/medicines/search/`
- `POST /api/v1/pharmacy/session/{session_id}/dispense/`
- `POST /api/v1/pharmacy/session/{session_id}/checkout/`
- `POST /api/v1/pharmacy/debt-payment/`
- `GET /api/v1/pharmacy/inventory/`
- `POST /api/v1/pharmacy/inventory/`
- `PATCH /api/v1/pharmacy/inventory/{medicine_id}/`
- `POST /api/v1/pharmacy/inventory/{medicine_id}/stock/`
- `GET /api/v1/pharmacy/reports/`

## Data Model Updates

### Patients (`hms_archive.patients`)
Added/updated:
- `status`: active | inactive | dead
- `general_data_complete: bool`
- `outstanding_debt: float`
- `status_updates[]`
- Tier 2 demographic fields made optional

### Visits (`hms_archive.visits`)
Added/updated:
- `visit_type`: standard | debt_payment
- `dispensed_by`, `dispensed_by_name`
- `checked_in_by`, `checked_in_by_name`
- `dispense_items[]`
- `medicines_total`
- `payment`
- `debt_snapshot`

### Active Sessions (`hms_active.active_sessions`)
Simplified to:
- `patient_id`, `patient_name`
- `checked_in_by`, `checked_in_by_name`, `checked_in_at`
- `status`: checked_in | dispensing | completed
- `dispense_items[]`
- `outstanding_debt_at_checkin`

### Medicines (`hms_archive.medicines`)
Verified active inventory fields:
- `name`, `category`, `unit`, `unit_price`, `stock_quantity`, `is_active`

## Payment Flow

### Methods
1. `cash`: full `total_due` must be cash
2. `online`: full `total_due` must be online
3. `debt`: full `total_due` moves to `new_debt`
4. `split`: any valid combination where `cash + online + new_debt == total_due`

### Debt Lifecycle
- Existing debt is loaded from `patient.outstanding_debt`.
- Checkout computes: `new_outstanding = debt_before - debt_cleared + new_debt`.
- Debt-only payment endpoint allows walk-in debt settlement without active session.
- Each checkout/debt-payment persists debt movement in visit `payment` and `debt_snapshot`.

### Atomic Checkout Transaction
`ArchiveService.close_visit` performs, inside one MongoDB transaction:
1. Read active session and patient debt state
2. Validate payment and stock
3. Insert archive visit
4. Update patient visits and debt
5. Deduct stock for dispensed items
6. Delete active session

## Changes From Previous Implementation

### Removed Endpoints
- Receptionist assignment pipeline endpoints (`visits`, assign counsellor, active visits)
- Consultant queue/session progression endpoints (queue/start/context/notes/assign-doctor/history)
- Legacy pharmacy dispense/close/history endpoints tied to doctor-stage flow

Reason: previous linear assignment pipeline and doctor-led prescription flow were deprecated.

### Modified Endpoints
- Patient registration changed to Tier 1 only contract
- Patient lookup now returns `status` for deceased-blocking UX
- Session check-in moved to explicit `/sessions/checkin/` flow with deceased/session-conflict checks

### New Endpoints
- Patient general data patch endpoint
- Counsellor follow-up list, status update, reports
- Receptionist reports endpoint
- New pharmacy session/dispense/checkout/debt/report endpoints
- Inventory patch and additive stock endpoints

### Schema Field Deltas
Added:
- `Patient.general_data_complete`
- `Patient.outstanding_debt`
- `Patient.status_updates[]`
- `Visit.visit_type`
- `Visit.dispense_items[]`
- `Visit.payment`
- `Visit.debt_snapshot`
- `ActiveSession.status` with simplified choices

Removed from active flow/schema usage:
- doctor assignment and doctor-stage pipeline fields from active session processing

## Frontend Integration Notes
- Added central API module: `lib/api-client.ts`
- Added frontend environment template: `.env.local.example` with `NEXT_PUBLIC_API_URL`
- Existing Next.js pages currently still rely heavily on demo store stubs and require systematic endpoint wiring across receptionist/counsellor/pharmacy pages.

## Seed Data
`seed_db` now seeds:
- role accounts for receptionist/consultant/doctor/pharmacy
- at least 2 medicines for 3 categories
- active patient with debt for debt flow
- deceased patient for check-in block testing
- incomplete general-data patient (`general_data_complete=false`) for profile completion flow
- idempotent create-if-missing behavior

## Validation Status
Environment in this workspace currently lacks Django runtime dependencies, so full runtime checks could not be completed here.

Performed:
- structural refactor of endpoint map and data models
- transaction flow implementation for checkout archive

Not executable in this environment:
- `python manage.py runserver`
- `python manage.py seed_db`

## What Remains To Be Done
1. Admin dashboard:
   - follow-up threshold configuration
   - staff/user management
2. Doctor module reactivation:
   - redesign dormant doctor endpoints against simplified active-session schema
   - reintroduce doctor frontend wiring only if product direction requires
3. Invoice/receipt generation:
   - printable and persisted billing artifacts
4. Exportable reports:
   - add CSV/PDF export endpoint layer over current aggregated structures
5. SQL migration for pharmacy inventory:
   - explicitly deferred; inventory remains in MongoDB in this implementation
6. Fingerprint hardware SDK integration:
   - replace placeholder hash-flow assumptions with production SDK handshake
7. Production hardening:
   - HTTPS termination, rate limiting, stricter env configs, secrets rotation
8. Frontend full wiring:
   - migrate demo-store-driven pages to real backend calls via central API client
