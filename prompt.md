# HMS Backend Implementation Prompt

## Context

You are a senior full-stack engineer implementing the backend for a **Hospital Management System (HMS)**. You have access to the entire codebase which contains:

1. A **Next.js frontend** — already built and functional with mock/static data
2. A **backend architecture plan document** — the output of a previous planning pass (look for it in the repo; it contains the complete ER diagram, all collection schemas, all API endpoint specifications with request/response shapes, DB query strategies, and index definitions)
3. **Sample data file(s)** — giving you real examples of the data this system handles

Your job is to implement the **complete Django + MongoDB backend** and **wire it to the Next.js frontend**, following every specification in the architecture plan document exactly.

---

## Absolute Constraints — Read Before Writing a Single Line

### What You Will Implement
- Django REST Framework backend with djongo or mongoengine for MongoDB
- Two MongoDB databases: `hms_archive` (permanent data) and `hms_active` (in-progress sessions)
- All collections, schemas, and indexes as defined in the architecture plan
- All API endpoints as defined in the architecture plan
- JWT authentication with role-based access control
- Full integration with the Next.js frontend (update all API base URLs, request/response mapping, auth headers)

### What You Will NOT Implement
- Redis, Memcached, or any caching layer
- Celery, task queues, or background workers
- Email / SMS notifications
- Admin panel or any admin role functionality
- Invoice generation (pharmacy module)
- Reporting or analytics
- Multi-tenancy or multi-hospital support
- Patient-facing features
- Appointment scheduling or billing
- Docker, Kubernetes, or any containerisation
- CI/CD pipelines
- Rate limiting or any production infrastructure concerns
- Frontend UI changes — only wire the frontend to the backend, never modify UI logic, layouts, or components

> These are explicitly out of scope. Do not stub them, do not leave TODOs for them, do not create placeholder files for them. Simply do not implement them.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend framework | Django 4.x + Django REST Framework |
| MongoDB ODM | **mongoengine** (preferred over djongo for flexibility with two databases) |
| Authentication | `djangorestframework-simplejwt` |
| Password hashing | Django's built-in `make_password` / `check_password` |
| Fingerprint storage | SHA-256 hash (hashlib — stdlib, no extra dependency) |
| CORS | `django-cors-headers` |
| Environment config | `python-decouple` (reads from `.env`) |
| Python version | 3.11+ |

> Use **mongoengine** as the ODM. Do not use Django's ORM or djongo. MongoEngine connects directly to MongoDB Atlas via a connection URI and gives full control over multi-database routing.

---

## Project Structure

Implement the Django project with this exact directory layout:

```
hms_backend/
├── manage.py
├── requirements.txt
├── .env.example                  # Template — all env vars with placeholder values, never real secrets
├── .gitignore
│
├── config/                       # Django project config (replaces default myproject/ folder)
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
│
├── apps/
│   ├── __init__.py
│   │
│   ├── auth_app/                 # Authentication — login, token refresh, logout
│   │   ├── __init__.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── permissions.py        # Custom DRF permission classes for each role
│   │
│   ├── patients/                 # Patient registration, lookup, history
│   │   ├── __init__.py
│   │   ├── models.py             # MongoEngine document definitions
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   │
│   ├── receptionist/             # Receptionist-specific endpoints
│   │   ├── __init__.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   │
│   ├── consultant/               # Consultant queue and session endpoints
│   │   ├── __init__.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   │
│   ├── doctor/                   # Doctor queue, examination, prescription endpoints
│   │   ├── __init__.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   │
│   ├── pharmacy/                 # Pharmacy queue, dispense, inventory endpoints
│   │   ├── __init__.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   │
│   └── sessions/                 # Active session lifecycle — creation, transitions, archive close
│       ├── __init__.py
│       ├── models.py             # Active session MongoEngine document
│       ├── views.py
│       ├── serializers.py
│       ├── urls.py
│       └── archive_service.py    # The atomic archive-write + session-cleanup service
│
└── utils/
    ├── __init__.py
    ├── db.py                     # MongoEngine multi-database connection setup
    ├── pagination.py             # Shared paginator (page + pageSize + total + hasNextPage)
    ├── fingerprint.py            # SHA-256 hashing utility for fingerprint templates
    └── exceptions.py             # Custom DRF exception handler — consistent error response shape
```

---

## Implementation Rules

These rules apply to every file you write. They are not suggestions.

### 1. Clean Code

- **One responsibility per class and function.** A view handles HTTP. A serializer handles shape. A service handles business logic. A model handles schema. Never mix these.
- **No logic in views beyond:** parse request → call service/queryset → serialize → return response.
- **No raw MongoDB queries in views.** All DB access goes through MongoEngine document methods or dedicated service functions.
- **Functions longer than 40 lines should be broken into smaller named helpers.** Name helpers after what they do, not how they do it (`get_active_session_for_patient`, not `do_thing`).
- **No magic numbers or strings.** All role names, status values, and database names go in a `constants.py` at the app level or in `config/settings.py`.

### 2. Comments

Every file must have a **module-level docstring** that states what the module is for in 1–3 sentences.

Every class must have a **class-level docstring** stating what it represents.

Every function/method must have a **docstring** that states:
- What it does (1 sentence)
- Parameters (name + type + purpose)
- Return value (type + what it represents)
- Any exceptions it raises

Use inline comments (`#`) sparingly — only to explain *why* something is done a non-obvious way, never to explain *what* the code obviously does.

Example of correct commenting style:
```python
class ArchiveService:
    """
    Handles the atomic commit of a completed patient visit from hms_active to hms_archive.
    This is the only place that writes to hms_archive during a live session.
    """

    @staticmethod
    def close_visit(session_id: str) -> dict:
        """
        Atomically writes the completed session to hms_archive and removes it from hms_active.

        Fetches the active session, constructs the Visit archive document, performs
        a MongoDB transaction to write Visit + update Patient.visits reference + delete
        the active session. Returns the archived visit document as a dict.

        Args:
            session_id (str): The ObjectId string of the active session document.

        Returns:
            dict: The serialised archived Visit document.

        Raises:
            ActiveSession.DoesNotExist: If no session with the given ID exists.
            ArchiveWriteError: If the MongoDB transaction fails.
        """
```

### 3. Naming Conventions

- Files: `snake_case`
- Classes: `PascalCase`
- Functions and variables: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- MongoEngine document classes: `PascalCase` ending in `Document` is acceptable but not required — match the collection name semantically (e.g. `Patient`, `Visit`, `ActiveSession`, `Medicine`)
- URL route names: `<app>:<action>` format (e.g. `consultant:queue-list`, `pharmacy:dispense`)

### 4. Serializers

- Every serializer must explicitly declare all fields — never use `fields = '__all__'`
- Serializers for list endpoints must exclude heavy nested fields (use a separate `SummarySerializer` vs `DetailSerializer` for the same model)
- Serializers must validate all input data — do not trust the frontend to send clean data
- Use `SerializerMethodField` for computed fields (e.g. `patient_name`, `visit_count`)

### 5. Error Handling

- All views must be wrapped in `try/except` — never let an unhandled exception return a 500 to the frontend
- Use the custom exception handler in `utils/exceptions.py` — all error responses must follow this shape:
  ```json
  {
    "success": false,
    "error": {
      "code": "PATIENT_NOT_FOUND",
      "message": "No patient found with the provided ID.",
      "field": null
    }
  }
  ```
- All success responses must follow this shape:
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": { "page": 1, "pageSize": 20, "total": 143, "hasNextPage": true }
  }
  ```
  (`meta` is only present on paginated list endpoints)

### 6. Authentication and Permissions

- All endpoints (except login) require a valid JWT in the `Authorization: Bearer <token>` header
- Implement custom DRF permission classes in `apps/auth_app/permissions.py`:
  - `IsReceptionist`
  - `IsConsultant`
  - `IsDoctor`
  - `IsPharmacy`
  - `IsAnyStaff` (any of the above)
- Every view class must declare its `permission_classes` explicitly — never rely on global defaults for role checking
- Extract `user_id` and `role` from the JWT payload in every view that needs them — do not re-fetch the staff document from the DB just to check the role (it's already in the token)

### 7. Multi-Database Setup

- MongoEngine must be configured to connect to **both** `hms_archive` and `hms_active` simultaneously
- Each Document class must declare which database alias it uses via MongoEngine's `meta = {'db_alias': '...'}` 
- Connection aliases: `'archive'` → `hms_archive`, `'active'` → `hms_active`
- Both connection URIs must come from environment variables
- Connection setup must happen in `utils/db.py` and be called from `config/settings.py`

### 8. Environment Variables

All configuration that changes between environments must be in `.env`. Never hardcode any of the following:
- MongoDB URIs
- JWT secret key
- Django `SECRET_KEY`
- Allowed hosts
- Debug flag
- CORS allowed origins

Provide `.env.example` with every variable listed, each with a comment describing what it is and where to get it. Example:

```env
# Django secret key — generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
DJANGO_SECRET_KEY=your-secret-key-here

# Set to False in production
DJANGO_DEBUG=True

# MongoDB Atlas connection URIs — get from Atlas > Connect > Drivers
MONGODB_ARCHIVE_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/hms_archive?retryWrites=true&w=majority
MONGODB_ACTIVE_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/hms_active?retryWrites=true&w=majority

# Comma-separated list of allowed CORS origins (Next.js dev server)
CORS_ALLOWED_ORIGINS=http://localhost:3000

# JWT settings
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
```

### 9. Database Indexes

Every MongoEngine Document class must define its indexes in the `meta` dict. Implement every index specified in the architecture plan document. Do not skip any.

Example:
```python
class Patient(Document):
    meta = {
        'db_alias': 'archive',
        'collection': 'patients',
        'indexes': [
            {'fields': ['patient_id'], 'unique': True},
            {'fields': ['fingerprint_hash'], 'unique': True, 'sparse': True},
            {'fields': ['phone_number']},
        ]
    }
```

### 10. The Archive Service

`apps/sessions/archive_service.py` is the most critical file in the project. It must:

- Use a **MongoDB transaction** (via MongoEngine's session/transaction support with `mongoengine.connection.get_connection()` and pymongo's `start_session()`)
- Within the transaction, in a single atomic operation:
  1. Construct the complete `Visit` document from the active session
  2. Insert the `Visit` document into `hms_archive.visits`
  3. Push the new `visit_id` reference onto the `Patient.visits` array in `hms_archive.patients`
  4. Delete the active session document from `hms_active.active_sessions`
- If any step fails, the transaction rolls back — nothing is written and nothing is deleted
- After successful archive, return the serialised Visit document
- Log the outcome (use Python's `logging` module — not print)

---

## Frontend Integration

After the backend is complete, update the Next.js frontend to connect to it. Follow these rules:

### What You May Change in the Frontend
- API base URL configuration (typically in an `.env.local` file or a central `api.js` / `apiClient.js` module)
- Any existing fetch/axios/SWR/React Query calls — update URLs, add auth headers, map response shapes
- Token storage and retrieval (localStorage or httpOnly cookie — use localStorage for simplicity since this is not in a production hardening phase)
- Any hardcoded mock data that should now come from the API

### What You Must NOT Change in the Frontend
- Any `.tsx` / `.jsx` component UI structure
- Tailwind classes or CSS
- Page routing or navigation logic
- Component props or state management patterns

### Integration Approach

1. **Locate or create an API client module** in the Next.js project (e.g. `lib/apiClient.js` or `services/api.js`). This module must:
   - Set the base URL from `NEXT_PUBLIC_API_URL` environment variable
   - Attach `Authorization: Bearer <token>` to every authenticated request automatically (via interceptor or wrapper)
   - Handle 401 responses by clearing the token and redirecting to login
   - Export typed fetch functions for every endpoint group

2. **Replace mock data** in each page/component with real API calls. For each page:
   - Identify what data it currently uses (props, useState initial values, hardcoded arrays)
   - Replace with the appropriate API call
   - Handle loading states if the frontend already has them — do not add new loading UI

3. **Implement auth flow**:
   - On login form submit → call `POST /api/v1/auth/login/` → store `access` and `refresh` tokens in localStorage → store `role` in localStorage or context
   - On app load → check for token → if expired, use refresh token → if refresh fails, redirect to login
   - Add `NEXT_PUBLIC_API_URL=http://localhost:8000` to the frontend's `.env.local.example`

---

## Seed Data Script

Create a management command at `apps/auth_app/management/commands/seed_db.py` that:

- Creates one staff account for each role: receptionist, consultant, doctor, pharmacy
- Creates 5–10 sample medicines in `hms_archive.medicines`
- Creates 2–3 sample patients in `hms_archive.patients`
- Is **idempotent** — running it twice does not create duplicates (check before inserting)
- Prints the credentials of every created account clearly so the developer can log in immediately

The seed command is run with:
```bash
python manage.py seed_db
```

---

## Requirements File

`requirements.txt` must pin exact versions. Include at minimum:

```
Django==4.2.x
djangorestframework==3.14.x
djangorestframework-simplejwt==5.3.x
mongoengine==0.27.x
pymongo==4.6.x
django-cors-headers==4.3.x
python-decouple==3.8
```

Fill in exact patch versions by checking the latest stable releases at time of implementation.

---

## What to Do, Step by Step

Work through the implementation in this exact order. Complete each step fully before moving to the next.

### Step 1 — Read Everything First
1. Read the architecture plan document in full
2. Read every file in the Next.js frontend
3. Read all sample data files
4. Build a mental model of every API call the frontend makes and what data shape it expects

### Step 2 — Project Scaffold
1. Create the `hms_backend/` directory with the structure defined above
2. Set up `config/settings.py` with mongoengine multi-database config, JWT config, CORS config, installed apps
3. Create `.env.example` with all variables
4. Create `requirements.txt`
5. Create `utils/db.py` with connection registration
6. Create `utils/exceptions.py` with the custom exception handler
7. Create `utils/pagination.py` with the shared paginator
8. Create `utils/fingerprint.py` with the SHA-256 hashing function
9. Wire `config/urls.py` to include all app URL configs

### Step 3 — MongoEngine Models
For each app, implement the Document classes in `models.py` with:
- All fields from the architecture plan
- Correct types (StringField, ObjectIdField, DateTimeField, ListField, EmbeddedDocumentField, etc.)
- `meta` dict with `db_alias`, `collection`, and all `indexes`
- Class-level docstrings
- No logic in models — pure schema definition

Order: `patients` → `sessions` → `receptionist` → `consultant` → `doctor` → `pharmacy`

### Step 4 — Auth App
1. Implement the `Staff` document (in `patients/models.py` or its own model file — whichever the architecture plan specifies)
2. Implement `POST /api/v1/auth/login/` — verify credentials, return JWT pair with `user_id`, `role`, `hospital_id` in payload
3. Implement `POST /api/v1/auth/token/refresh/`
4. Implement `POST /api/v1/auth/logout/` (token blacklist)
5. Implement all permission classes (`IsReceptionist`, `IsConsultant`, `IsDoctor`, `IsPharmacy`, `IsAnyStaff`)

### Step 5 — Core Endpoints (one app at a time)
Implement all views, serializers, and URL routes for each app in this order:
1. `patients` (shared patient lookup and history endpoints)
2. `receptionist`
3. `consultant`
4. `doctor`
5. `pharmacy`

For each endpoint:
- Implement the view
- Implement the serializer(s)
- Register the URL
- Verify the request/response shape matches the architecture plan exactly

### Step 6 — Archive Service
Implement `apps/sessions/archive_service.py` with the atomic transaction as specified above. This is implemented last because it depends on all models being finalised.

### Step 7 — Seed Command
Implement `apps/auth_app/management/commands/seed_db.py`

### Step 8 — Frontend Integration
1. Locate the Next.js project in the repository
2. Create or update the API client module
3. Add `.env.local.example` to the Next.js project root
4. Update every page/component that uses mock data to use real API calls
5. Implement the auth flow (login → token storage → protected routes)
6. Verify every frontend route connects to a real backend endpoint

### Step 9 — Final Summary Document
After all implementation is complete, create a file at the root of the repository called `IMPLEMENTATION_SUMMARY.md` (see the required format below).

---

## Final Summary Document Format

The file `IMPLEMENTATION_SUMMARY.md` must be written at the root of the repository after implementation is complete. It must contain every section below, fully filled in — no placeholders.

```markdown
# HMS Implementation Summary

## Overview
Brief description of what was built, the tech stack, and the two-database architecture.

## Repository Structure
A tree of every new file created or modified, with a one-line description of each.

## Backend — What Was Implemented

### Authentication
- List every auth endpoint with its method + path
- JWT payload structure
- Token lifetime values (from env)

### Receptionist Module
- List every endpoint (method + path + one-line description)

### Consultant Module
- List every endpoint

### Doctor Module
- List every endpoint

### Pharmacy Module
- List every endpoint

### Patient Records
- List every endpoint

### Archive Service
- Description of the transaction flow
- What is written to hms_archive when a visit closes
- What happens on transaction failure

## Database

### hms_archive Collections
For each collection: name, purpose, index count, and a one-line field summary.

### hms_active Collections
For each collection: name, purpose, TTL setting if any.

## Frontend Integration

### API Client
- Location of the API client module
- How auth headers are attached
- How 401s are handled

### Pages Updated
For each Next.js page that was updated:
- Page path
- What mock data was replaced
- Which API endpoint(s) it now calls

### Environment Variables Added
List every new env var added to the frontend, with a description.

## How to Run Locally

### Prerequisites
Exact list: Python version, Node version, MongoDB Atlas account requirements.

### Backend Setup
Step-by-step commands — copy-pasteable, zero ambiguity:
```bash
cd hms_backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — add your MongoDB Atlas URIs and generate a Django SECRET_KEY
python manage.py seed_db
python manage.py runserver
```

### Frontend Setup
```bash
cd <frontend-directory>
cp .env.local.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

### Seed Accounts
Table of every seeded account:
| Role | Username / Email | Password |
|---|---|---|
| Receptionist | ... | ... |
| Consultant | ... | ... |
| Doctor | ... | ... |
| Pharmacy | ... | ... |

## What Remains To Be Done

Be specific and honest. For each item:
- What it is
- Why it was not implemented (out of scope / not yet specified / depends on external decision)
- What would be needed to implement it

Minimum items to list:
- Admin role and panel
- Invoice generation (pharmacy)
- Actual fingerprint hardware SDK integration (currently hash-only)
- Production hardening (HTTPS, rate limiting, env-specific settings)
- Caching layer
- Any endpoints from the architecture plan that were not fully implemented (list them if any)
- Any frontend pages that still use mock data (list them if any)
- Index creation on Atlas (note that MongoEngine auto-creates indexes on `ensure_indexes()` but production Atlas clusters may require manual index creation via Atlas UI or a migration script)

## Known Limitations

Any technical debt, shortcuts taken, or assumptions made during implementation that a future developer should be aware of.
```

---

## Quality Bar

Before you consider the implementation complete, verify:

- [ ] `python manage.py runserver` starts without errors
- [ ] `python manage.py seed_db` runs without errors and prints credentials
- [ ] Every endpoint in the architecture plan has a corresponding URL route
- [ ] Every URL route has a corresponding view
- [ ] Every view has a corresponding serializer
- [ ] No view contains raw pymongo queries
- [ ] No hardcoded credentials, URIs, or secret keys anywhere in committed code
- [ ] `.env.example` contains every environment variable the project needs
- [ ] Every MongoEngine Document has its `meta` dict with `db_alias`, `collection`, and `indexes`
- [ ] Every function has a docstring
- [ ] Every module has a module-level docstring
- [ ] The frontend's API client module exists and attaches auth headers
- [ ] `IMPLEMENTATION_SUMMARY.md` exists at the repo root and all sections are complete
- [ ] The "What Remains To Be Done" section is honest and complete

Do not mark the task as done until every checkbox above is verified.
```