# Fix Frontend Pages to Use Backend API Instead of Demo Store

## Problem

The `NEXT_PUBLIC_USE_DEMO_DATA=false` flag only controls the **login flow** (in `auth-context.tsx`). Once logged in, **all page-level data fetching** directly calls `store.getPatients()`, `store.getDashboardStats()`, etc. from `demo-store.ts` — completely bypassing the backend API.

This affects **19 files** across all 4 role dashboards: reception, counsellor, doctor, and pharmacy.

## User Review Required

> [!IMPORTANT]
> The backend currently lacks several endpoints that the frontend pages need. Specifically:
> - **No "list all patients" endpoint** — only lookup by ID/fingerprint/registration_number exists
> - **No "dashboard stats" endpoint** — no way to get counts of patients at each stage
> - **No "queue status" endpoint for reception** — the counsellor/pharmacy queues exist, but reception's queue view also calls demo store
>
> We have two options:
> 1. **Add the missing backend endpoints** (patients list, dashboard stats, queue status) AND fix all frontend pages — this is thorough but is a large change
> 2. **Fix only the pages that already have backend API counterparts** (counsellor queue, pharmacy queue/inventory, reports, checkin, register) and leave the rest for a future pass
>
> **Which approach should we take?**

## Current State Analysis

### Pages with `useDemoData` check (partially working)
These pages import `useDemoData` and have conditional logic, but still fall back to demo store:

| Page | Has API Branch? | Demo Store Fallback? |
|------|----------------|---------------------|
| `counsellor/queue/page.tsx` | ✅ Yes | ✅ Still falls back |
| `counsellor/page.tsx` (dashboard) | ✅ Yes | ✅ Still falls back |
| `counsellor/session/[visitId]` | ✅ Yes | ✅ Still falls back |
| `counsellor/reports/page.tsx` | ✅ Yes | ✅ Still falls back |
| `counsellor/patients/page.tsx` | ✅ Yes | ✅ Still falls back |
| `pharmacy/queue/page.tsx` | ✅ Yes | ✅ Still falls back |
| `pharmacy/inventory/page.tsx` | ✅ Yes | ✅ Still falls back |
| `pharmacy/dispense/[visitId]` | ✅ Yes | ✅ Still falls back |
| `reception/reports/page.tsx` | ✅ Yes | ✅ Still falls back |

### Pages with NO `useDemoData` check (always demo)
These pages unconditionally use `store.xxx()`:

| Page | Store Methods Used |
|------|-------------------|
| `reception/page.tsx` (dashboard) | `store.getDashboardStats()`, `store.getPatients()`, `store.getTodayVisits()`, `store.getVisitsByStage()`, `store.getPatientById()` |
| `reception/patients/page.tsx` | `store.getPatients()`, `store.getVisitsByPatient()`, `store.updatePatient()` |
| `reception/register/page.tsx` | `generateRegistrationNumber()` |
| `pharmacy/page.tsx` (dashboard) | `store.xxx()` |
| `pharmacy/invoices/page.tsx` | `store.xxx()` |
| `doctor/page.tsx` (dashboard) | `store.xxx()` |
| `doctor/queue/page.tsx` | `store.xxx()` |
| `doctor/history/page.tsx` | `store.xxx()` |
| `doctor/consultation/[visitId]` | `store.xxx()` |
| `counsellor/history/page.tsx` | `store.xxx()` |

### Backend API Endpoints Available

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/auth/login/` | POST | Login |
| `/api/v1/patients/register/` | POST | Register patient |
| `/api/v1/patients/lookup/` | GET | Lookup by reg_number / fingerprint |
| `/api/v1/patients/<id>/` | GET | Get single patient |
| `/api/v1/patients/<id>/general/` | PATCH | Update patient general data |
| `/api/v1/sessions/checkin/` | POST | Check in a patient |
| `/api/v1/counsellor/queue/` | GET | Counsellor queue |
| `/api/v1/counsellor/session/<id>/` | GET | Session detail |
| `/api/v1/counsellor/session/<id>/complete/` | POST | Complete session |
| `/api/v1/counsellor/followup/` | GET | Follow-up patients |
| `/api/v1/counsellor/patients/<id>/status/` | PATCH | Update patient status |
| `/api/v1/counsellor/reports/` | GET | Counsellor reports |
| `/api/v1/pharmacy/queue/` | GET | Pharmacy queue |
| `/api/v1/pharmacy/session/<id>/` | GET | Session detail |
| `/api/v1/pharmacy/session/<id>/dispense/` | POST | Dispense medicines |
| `/api/v1/pharmacy/session/<id>/checkout/` | POST | Checkout session |
| `/api/v1/pharmacy/inventory/` | GET/POST | Inventory list / add |
| `/api/v1/pharmacy/inventory/<id>/stock/` | POST | Add stock |
| `/api/v1/pharmacy/reports/` | GET | Pharmacy reports |
| `/api/v1/receptionist/reports/` | GET | Receptionist reports |

### Missing Backend Endpoints (needed for full fix)

| Missing Endpoint | Needed By |
|-----------------|-----------|
| `GET /api/v1/patients/` (list all) | `reception/patients/page.tsx` |
| `GET /api/v1/receptionist/dashboard/` (stats) | `reception/page.tsx` |
| `GET /api/v1/receptionist/queue/` (active sessions) | `reception/queue/page.tsx` |
| `GET /api/v1/doctor/queue/` | `doctor/queue/page.tsx` |
| `GET /api/v1/doctor/session/<id>/` | `doctor/consultation/[visitId]` |
| `GET /api/v1/doctor/session/<id>/complete/` | `doctor/consultation/[visitId]` |

## Open Questions

> [!IMPORTANT]
> 1. **Scope**: Should I do the full fix (add missing backend endpoints + update all frontend pages) or just the partial fix (update only pages that already have matching backend endpoints)?
> 2. **Doctor endpoints**: The doctor backend has views/urls but I haven't fully explored them yet. Should doctor pages also be fixed in this pass?
