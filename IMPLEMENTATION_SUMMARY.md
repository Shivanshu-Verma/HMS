# HMS Implementation Summary

## Overview

Implemented a Django 4.2 + Django REST Framework backend using MongoEngine with a two-database design:

- `hms_archive` for long-lived records (patients, visits, staff, medicines, inventory ledger, refresh tokens)
- `hms_active` for in-progress workflow state (active sessions, locks, blacklist)

The Next.js frontend has been wired to the backend through a centralized API client using `NEXT_PUBLIC_API_URL`, JWT bearer auth, token refresh, and automatic logout-on-401 handling.

## Repository Structure

```text
hms_backend/
  .env.example                       # Backend environment variable template
  .gitignore                         # Python/Django ignore rules
  manage.py                          # Django entrypoint
  requirements.txt                   # Pinned backend dependencies
  config/
    settings.py                      # Django + DRF + MongoEngine config
    urls.py                          # Root API router under /api/v1/
    wsgi.py                          # WSGI app
  utils/
    db.py                            # MongoEngine dual-connection setup
    exceptions.py                    # Standardized error envelope handler
    fingerprint.py                   # SHA-256 fingerprint hashing helper
    pagination.py                    # Shared page/pageSize pagination helpers
    response.py                      # Standardized success/paginated responses
  apps/
    auth_app/
      serializers.py                 # Auth request validation
      permissions.py                 # JWT auth + role permissions
      urls.py                        # /auth/login, /auth/refresh, /auth/logout
      views.py                       # Login/refresh/logout handlers
      management/commands/seed_db.py # Idempotent seed command
    patients/
      models.py                      # Patient/Visit/Staff/Medicine/etc documents
      serializers.py                 # Patient and visit serializers
      urls.py                        # Patient/visit record endpoints
      views.py                       # Registration, lookup, history, detail
    receptionist/
      serializers.py                 # Check-in/assignment serializers
      urls.py                        # Visit create/active/assign-counsellor routes
      views.py                       # Check-in queue and counsellor reassignment
    consultant/
      serializers.py                 # Consultant payload validators
      urls.py                        # Consultant routes
      views.py                       # Queue/context/notes/assign/history
    doctor/
      serializers.py                 # Findings/prescription validators
      urls.py                        # Doctor routes + medicine search
      views.py                       # Queue/context/findings/prescriptions/history
    pharmacy/
      serializers.py                 # Dispense/stock/medicine validators
      urls.py                        # Pharmacy routes
      views.py                       # Queue/dispense/inventory/history/close
    sessions/
      models.py                      # Active session/lock/blacklist documents
      archive_service.py             # Atomic archive flow
      urls.py                        # Placeholder include (no standalone routes)

lib/
  api-client.ts                      # Frontend API client and endpoint wrappers
  auth-context.tsx                   # Frontend login/logout/token-backed auth state

app/
  reception/register/page.tsx        # Uses backend patient registration API
  pharmacy/inventory/page.tsx        # Uses backend inventory APIs

.env.local.example                   # Frontend env template
IMPLEMENTATION_SUMMARY.md            # This summary
```

## Backend — What Was Implemented

### Authentication

- `POST /api/v1/auth/login/`: verifies staff credentials and issues access/refresh tokens
- `POST /api/v1/auth/refresh/`: rotates refresh token and returns new token pair
- `POST /api/v1/auth/logout/`: blacklists access token and revokes refresh token

JWT payload fields include:

- `user_id`
- `role`
- `hospital_id`
- `jti`
- `exp`

Token lifetimes come from env:

- `JWT_ACCESS_TOKEN_LIFETIME_MINUTES`
- `JWT_REFRESH_TOKEN_LIFETIME_DAYS`

### Receptionist Module

- `POST /api/v1/patients`
- `GET /api/v1/patients/{patientId}`
- `GET /api/v1/patients/by-registration/{registrationNumber}`
- `POST /api/v1/patients/lookup-fingerprint`
- `POST /api/v1/visits`
- `PATCH /api/v1/visits/{activeSessionId}/assign-counsellor`
- `GET /api/v1/visits/active`

### Consultant Module

- `GET /api/v1/consultant/queue`
- `POST /api/v1/consultant/sessions/{activeSessionId}/start`
- `GET /api/v1/consultant/sessions/{activeSessionId}/context`
- `POST /api/v1/consultant/sessions/{activeSessionId}/notes`
- `PATCH /api/v1/consultant/sessions/{activeSessionId}/assign-doctor`
- `GET /api/v1/consultant/history`

### Doctor Module

- `GET /api/v1/doctor/queue`
- `POST /api/v1/doctor/consultations/{activeSessionId}/start`
- `GET /api/v1/doctor/consultations/{activeSessionId}/context`
- `POST /api/v1/doctor/consultations/{activeSessionId}/findings`
- `POST /api/v1/doctor/consultations/{activeSessionId}/prescriptions`
- `PATCH /api/v1/doctor/consultations/{activeSessionId}/assign-pharmacy`
- `GET /api/v1/medicines/search`
- `GET /api/v1/doctor/history`

### Pharmacy Module

- `GET /api/v1/pharmacy/queue`
- `GET /api/v1/pharmacy/dispense/{activeSessionId}`
- `POST /api/v1/pharmacy/dispense/{activeSessionId}/submit`
- `POST /api/v1/pharmacy/visits/{activeSessionId}/close`
- `GET /api/v1/pharmacy/inventory`
- `PATCH /api/v1/pharmacy/inventory/{medicineId}/stock`
- `POST /api/v1/pharmacy/inventory/add`
- `GET /api/v1/pharmacy/history`

### Patient Records

- `GET /api/v1/patients/{patientId}/summary`
- `GET /api/v1/patients/{patientId}/history`
- `GET /api/v1/visits/{visitId}/detail`

### Archive Service

`apps/sessions/archive_service.py` performs archival from active to archive storage. The close flow:

1. Reads active session
2. Builds archived visit payload
3. Writes archive visit document
4. Updates patient visit references/counters
5. Removes active session and related lock state

On failure, the service raises an error and returns standardized failure responses from the view layer.

## Database

### hms_archive Collections

- `patients`: patient master record and profile snapshots, with identity/fingerprint/search indexes
- `visits`: immutable completed visit history with embedded stage snapshots and history indexes
- `staff`: role-based staff identity and auth profile
- `medicines`: medicine catalog + stock state
- `inventory_transactions`: immutable stock movement ledger
- `auth_refresh_tokens`: refresh-token store with revocation and TTL expiry

### hms_active Collections

- `active_sessions`: single in-progress workflow object
- `active_locks`: race-condition lock documents
- `auth_blacklist`: access-token blacklist with TTL

## Frontend Integration

### API Client

- Location: `lib/api-client.ts`
- Auth headers: bearer token from localStorage auto-attached to authenticated requests
- 401 handling: auto-attempt refresh; on failure clears auth and redirects to `/login`

### Pages Updated

- `app/login/page.tsx`: uses backend login
- `app/reception/page.tsx`: uses active visits endpoint for dashboard data
- `app/reception/register/page.tsx`: replaced demo patient creation with `POST /api/v1/patients`
- `app/reception/checkin/page.tsx`: uses search/fingerprint lookup + visit creation APIs
- `app/reception/queue/page.tsx`: uses active visits API
- `app/counsellor/page.tsx`: uses consultant queue API
- `app/counsellor/queue/page.tsx`: uses consultant queue API
- `app/counsellor/session/[visitId]/page.tsx`: uses consultant start/context/notes/assign APIs
- `app/counsellor/history/page.tsx`: uses consultant history API
- `app/doctor/page.tsx`: uses doctor queue API
- `app/doctor/queue/page.tsx`: uses doctor queue API
- `app/doctor/consultation/[visitId]/page.tsx`: uses doctor start/context/findings/prescription/assign APIs
- `app/doctor/history/page.tsx`: uses doctor history API
- `app/pharmacy/page.tsx`: uses pharmacy queue API
- `app/pharmacy/queue/page.tsx`: uses pharmacy queue API
- `app/pharmacy/dispense/[visitId]/page.tsx`: uses dispense and close-visit APIs
- `app/pharmacy/inventory/page.tsx`: replaced demo inventory mutations with inventory APIs

### Environment Variables Added

- Frontend:
  - `NEXT_PUBLIC_API_URL`: backend base URL for Next.js client requests
- Backend (template in `.env.example`):
  - `DJANGO_SECRET_KEY`
  - `DJANGO_DEBUG`
  - `DJANGO_ALLOWED_HOSTS`
  - `MONGODB_ARCHIVE_URI`
  - `MONGODB_ACTIVE_URI`
  - `MONGODB_ARCHIVE_DB`
  - `MONGODB_ACTIVE_DB`
  - `CORS_ALLOWED_ORIGINS`
  - `JWT_SECRET_KEY`
  - `JWT_ACCESS_TOKEN_LIFETIME_MINUTES`
  - `JWT_REFRESH_TOKEN_LIFETIME_DAYS`
  - `DEFAULT_HOSPITAL_ID`

## How to Run Locally

### Prerequisites

- Python 3.11+
- Node.js 20+
- MongoDB Atlas cluster (or local replica set) with `hms_archive` and `hms_active`

### Backend Setup

```bash
cd hms_backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — add your MongoDB URIs and generate a Django SECRET_KEY
python manage.py seed_db
python manage.py runserver
```

### Frontend Setup

```bash
cd .
cp .env.local.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

### Seed Accounts

| Role         | Username / Email     | Password      |
| ------------ | -------------------- | ------------- |
| Receptionist | reception@hms.local  | reception123  |
| Consultant   | counsellor@hms.local | counsellor123 |
| Doctor       | doctor@hms.local     | doctor123     |
| Pharmacy     | pharmacy@hms.local   | pharmacy123   |

## What Remains To Be Done

- Admin role and admin panel:
  - Out of scope by product constraints.
  - Would require dedicated staff role, guarded endpoints, and admin UI pages.
- Invoice generation (pharmacy):
  - Out of scope by product constraints.
  - Current invoice UI pages may remain demo-backed until invoice domain is specified.
- Fingerprint hardware SDK integration:
  - Current implementation hashes captured template strings.
  - Full RD/SDK integration requires vendor device SDK and secure capture middleware.
- Production hardening:
  - HTTPS termination, stricter CORS/hosts, secrets vaulting, structured observability, and rate limiting are not implemented.
- Caching layer:
  - Explicitly out of scope.
- Endpoint parity checks:
  - API is substantially implemented; verify strict request/response parity against architecture spec before production.
- Frontend demo remnants:
  - `app/pharmacy/invoices/page.tsx` remains demo-backed (invoice domain out of scope).
  - `app/admin/*` remains demo-backed (admin scope out of scope).
- Atlas index operations:
  - Models define indexes, but production Atlas environments may still require controlled index rollout strategy.

## Known Limitations

- Backend runtime validation (`python manage.py check`, `runserver`, `seed_db`) requires installing backend Python dependencies in a local virtual environment.
- Some route details intentionally differ from the architecture document (`/visits/{id}/detail`, `/pharmacy/dispense/{id}/submit`) based on implemented code paths.
- Cross-role relationship authorization checks should be further hardened and centralized for strict policy enforcement under all edge cases.
