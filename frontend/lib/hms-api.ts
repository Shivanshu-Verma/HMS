import { apiRequest } from "./api-client";
import type { PatientCategory } from "./types";
import type { MedicineUnit } from "./types";

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: "receptionist" | "consultant" | "doctor" | "pharmacy" | string;
  hospital_id?: string;
}

export interface LoginResponse {
  expires_in: number;
  user: AuthUser;
}

export interface SessionResponse {
  expires_in: number;
  user: AuthUser;
}

let sessionRequestPromise: Promise<SessionResponse> | null = null;

export interface PatientLookupResponse {
  patient_id: string;
  registration_number: string;
  file_number?: string;
  patient_category?: PatientCategory;
  full_name: string;
  phone_number: string;
  phone?: string;
  date_of_birth: string;
  sex: "male" | "female" | "other";
  gender?: "male" | "female" | "other";
  status: "active" | "inactive" | "dead";
  outstanding_debt: number;
  address_line1?: string | null;
  address?: string | null;
  relative_phone?: string | null;
  addiction_duration_text?: string | null;
  addiction_duration?: string | null;
  fingerprint_reenrollment_required?: boolean;
  [key: string]: unknown;
}

export interface PatientLookupListResponse {
  items: PatientLookupResponse[];
  total: number;
}

export interface FingerprintTemplateResponse {
  patient_id: string;
  fingerprint_template: string;
  fingerprint_enrolled_at?: string | null;
  fingerprint_template_key_version?: string | null;
}

type RegisterPatientTier1Payload = {
  patient_category?: PatientCategory;
  file_number?: string;
  full_name: string;
  phone_number: string;
  date_of_birth: string;
  sex: "male" | "female" | "other";
  fingerprint_template: string;
  aadhaar_number?: string;
  relative_phone?: string;
  address_line1?: string;
};

export interface CheckinResponse {
  session_id: string;
  patient_id: string;
  patient_name: string;
  checked_in_by_name: string;
  checked_in_at: string;
  status: "checked_in" | "dispensing" | "completed";
  outstanding_debt_at_checkin: number;
}

export interface FollowupItem {
  patient_id: string;
  full_name: string;
  phone_number: string;
  last_visit_date: string;
  days_since_last_visit: number;
  status: "active" | "inactive" | "dead";
}

export interface CounsellorQueueItem {
  session_id: string;
  patient_id: string;
  patient_name: string;
  checked_in_at: string;
  checked_in_by_name: string;
  outstanding_debt: number;
  session_status: string;
}

export interface CounsellorSessionDetailResponse {
  session_id: string;
  patient: {
    patient_id: string;
    registration_number: string;
    full_name: string;
    phone_number: string;
    date_of_birth: string;
    sex: "male" | "female" | "other";
    addiction_type?: string | null;
    addiction_duration_text?: string | null;
    allergies?: string | null;
    medical_history?: string | null;
  };
  checked_in_at?: string | null;
  session_status: string;
}

export interface CounsellorReportsResponse {
  daily: {
    date: string;
    total_followups: number;
  };
  monthly: {
    year: number;
    month: number;
    breakdown: Array<{ day: number; count: number }>;
    total: number;
  };
  yearly: {
    year: number;
    breakdown: Array<{ month: number; count: number }>;
    total: number;
  };
}

export interface CounsellorReportSessionItem {
  session_id: string;
  patient_id: string;
  patient_name: string;
  registration_number?: string | null;
  patient_category?: PatientCategory | null;
  checked_in_at?: string | null;
  completed_at?: string | null;
  session_status: string;
  session_notes?: string;
  mood_assessment?: number;
  risk_level?: "low" | "medium" | "high";
  recommendations?: string;
  follow_up_required?: boolean;
}

export interface CounsellorReportSessionsResponse {
  items: CounsellorReportSessionItem[];
  total: number;
}

export interface PharmacyQueueItem {
  session_id: string;
  patient_id: string;
  patient_name: string;
  checked_in_at: string;
  checked_in_by_name: string;
  outstanding_debt: number;
  session_status: string;
}

export type PharmacyPaymentMethod = "cash" | "online" | "split" | "debt";

export interface PharmacySessionDetailResponse {
  session_id: string;
  patient: {
    patient_id: string;
    full_name: string;
    phone_number: string;
    date_of_birth: string;
    sex: "male" | "female" | "other";
    registration_number: string;
  };
  outstanding_debt: number;
  dispense_items: Array<{
    medicine_id: string;
    medicine_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  session_status: string;
}

export interface PharmacyDispenseResponse {
  session_id: string;
  status: string;
  dispense_items: Array<{
    medicine_id: string;
    medicine_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  medicines_total: number;
}

export interface PharmacyCheckoutResponse {
  visit_id: string;
  patient_id: string;
  visit_date: string;
  dispense_items: Array<{
    medicine_id: string;
    medicine_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  medicines_total: number;
  payment: {
    method: PharmacyPaymentMethod;
    cash_amount: number;
    online_amount: number;
    new_debt: number;
    debt_cleared: number;
    total_charged: number;
  };
  debt_snapshot: {
    debt_before: number;
    debt_after: number;
  };
}

export interface PharmacyInventoryItemResponse {
  medicine_id: string;
  name: string;
  category: string;
  unit: MedicineUnit;
  unit_price: number;
  stock_quantity: number;
  description?: string;
  is_active: boolean;
}

export interface PharmacyMedicineSearchItem {
  medicine_id: string;
  name: string;
  category: string;
  unit_price: number;
  stock_quantity: number;
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/login/", {
    method: "POST",
    body: { email, password },
    retryOn401: false,
    suppressAuthRedirect: true,
  });
}

export async function getSession(): Promise<SessionResponse> {
  if (sessionRequestPromise) {
    return sessionRequestPromise;
  }

  sessionRequestPromise = apiRequest<SessionResponse>("/api/v1/auth/session/", {
    retryOn401: false,
    suppressAuthRedirect: true,
  }).finally(() => {
    sessionRequestPromise = null;
  });

  return sessionRequestPromise;
}

export async function logout(): Promise<{ logged_out: boolean }> {
  return apiRequest<{ logged_out: boolean }>("/api/v1/auth/logout/", {
    method: "POST",
    suppressAuthRedirect: true,
  });
}

export async function registerPatientTier1(
  payloadOrToken: RegisterPatientTier1Payload | string,
  maybePayload?: RegisterPatientTier1Payload,
): Promise<PatientLookupResponse> {
  const payload =
    typeof payloadOrToken === "string" ? maybePayload : payloadOrToken;
  return apiRequest<PatientLookupResponse>("/api/v1/patients/register/", {
    method: "POST",
    body: payload,
  });
}

export async function lookupPatient(
  queryOrToken: { q?: string; registration_number?: string } | string,
  maybeQuery?: { q?: string; registration_number?: string },
): Promise<PatientLookupListResponse> {
  const query =
    typeof queryOrToken === "string" ? (maybeQuery ?? {}) : queryOrToken;
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.registration_number)
    params.set("registration_number", query.registration_number);
  return apiRequest<PatientLookupListResponse>(
    `/api/v1/patients/lookup/?${params.toString()}`,
    {},
  );
}

export async function checkinPatient(
  patientIdOrToken: string,
  maybePatientId?: string,
): Promise<CheckinResponse> {
  const patient_id = maybePatientId ?? patientIdOrToken;
  return apiRequest<CheckinResponse>("/api/v1/sessions/checkin/", {
    method: "POST",
    body: { patient_id },
  });
}

export async function getPatientFingerprintTemplate(
  patientIdOrToken: string,
  maybePatientId?: string,
): Promise<FingerprintTemplateResponse> {
  const patientId = maybePatientId ?? patientIdOrToken;
  return apiRequest<FingerprintTemplateResponse>(
    `/api/v1/patients/${patientId}/fingerprint-template/`,
    {},
  );
}

export async function getCounsellorFollowup(
  pageOrToken: number | string = 1,
  maybePage = 1,
  maybePageSize = 20,
): Promise<{
  items: FollowupItem[];
  pagination: { page: number; pageSize: number; total: number };
}> {
  const page = typeof pageOrToken === "string" ? maybePage : pageOrToken;
  const pageSize = typeof pageOrToken === "string" ? maybePageSize : maybePage;
  return apiRequest(
    `/api/v1/counsellor/followup/?page=${page}&pageSize=${pageSize}`,
    {},
  );
}

export async function getCounsellorQueue(_token?: string) {
  return apiRequest<{ items: CounsellorQueueItem[]; total: number }>(
    "/api/v1/counsellor/queue/",
    {},
  );
}

export async function getCounsellorSessionDetail(
  sessionIdOrToken: string,
  maybeSessionId?: string,
) {
  const sessionId = maybeSessionId ?? sessionIdOrToken;
  return apiRequest<CounsellorSessionDetailResponse>(
    `/api/v1/counsellor/session/${sessionId}/`,
    {},
  );
}

export async function completeCounsellorSession(
  sessionIdOrToken: string,
  payloadOrSessionId:
    | {
        session_notes: string;
        mood_assessment?: number;
        risk_level: "low" | "medium" | "high";
        recommendations?: string;
        follow_up_required?: boolean;
      }
    | string,
  maybePayload?: {
    session_notes: string;
    mood_assessment?: number;
    risk_level: "low" | "medium" | "high";
    recommendations?: string;
    follow_up_required?: boolean;
  },
) {
  const sessionId =
    typeof payloadOrSessionId === "string"
      ? payloadOrSessionId
      : sessionIdOrToken;
  const payload =
    typeof payloadOrSessionId === "string" ? maybePayload : payloadOrSessionId;
  return apiRequest(`/api/v1/counsellor/session/${sessionId}/complete/`, {
    method: "POST",
    body: payload,
  });
}

export async function updatePatientStatus(
  patientIdOrToken: string,
  statusOrPatientId: "active" | "inactive" | "dead" | string,
  maybeStatus?: "active" | "inactive" | "dead",
): Promise<{ patient_id: string; full_name: string; status: string }> {
  const patientId = maybeStatus ? statusOrPatientId : patientIdOrToken;
  const status =
    maybeStatus ?? (statusOrPatientId as "active" | "inactive" | "dead");
  return apiRequest(`/api/v1/counsellor/patients/${patientId}/status/`, {
    method: "PATCH",
    body: { status },
  });
}

export async function getCounsellorReports(_token?: string) {
  return apiRequest<CounsellorReportsResponse>(
    "/api/v1/counsellor/reports/",
    {},
  );
}

export async function getCounsellorReportSessions(_token?: string) {
  return apiRequest<CounsellorReportSessionsResponse>(
    "/api/v1/counsellor/reports/sessions/",
    {},
  );
}

export async function getCounsellorPatientsList(
  optsOrToken: { q?: string; page?: number; pageSize?: number } | string = {},
  maybeOpts: { q?: string; page?: number; pageSize?: number } = {},
) {
  const opts = typeof optsOrToken === "string" ? maybeOpts : optsOrToken;
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 100));
  return apiRequest<{
    items: PatientLookupResponse[];
    pagination?: { page: number; pageSize: number; total: number };
  }>(`/api/v1/counsellor/patients/?${params.toString()}`, {});
}

export async function getReceptionReports(_token?: string) {
  return apiRequest("/api/v1/receptionist/reports/", {});
}

export async function getPharmacyQueue(_token?: string) {
  return apiRequest<{ items: PharmacyQueueItem[]; total: number }>(
    "/api/v1/pharmacy/queue/",
    {},
  );
}

export async function getPharmacySessionDetail(
  sessionIdOrToken: string,
  maybeSessionId?: string,
) {
  const sessionId = maybeSessionId ?? sessionIdOrToken;
  return apiRequest<PharmacySessionDetailResponse>(
    `/api/v1/pharmacy/session/${sessionId}/`,
    {},
  );
}

export async function submitPharmacyDispense(
  sessionIdOrToken: string,
  payloadOrSessionId:
    | {
        items: Array<{
          medicine_id: string;
          quantity: number;
          unit_price: number;
        }>;
      }
    | string,
  maybePayload?: {
    items: Array<{ medicine_id: string; quantity: number; unit_price: number }>;
  },
) {
  const sessionId =
    typeof payloadOrSessionId === "string"
      ? payloadOrSessionId
      : sessionIdOrToken;
  const payload =
    typeof payloadOrSessionId === "string" ? maybePayload : payloadOrSessionId;
  return apiRequest<PharmacyDispenseResponse>(
    `/api/v1/pharmacy/session/${sessionId}/dispense/`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function checkoutPharmacySession(
  sessionIdOrToken: string,
  paymentOrSessionId:
    | {
        method: PharmacyPaymentMethod;
        cash_amount?: number;
        online_amount?: number;
        debt_cleared?: number;
        new_debt?: number;
      }
    | string,
  maybePayment?: {
    method: PharmacyPaymentMethod;
    cash_amount?: number;
    online_amount?: number;
    debt_cleared?: number;
    new_debt?: number;
  },
) {
  const sessionId =
    typeof paymentOrSessionId === "string"
      ? paymentOrSessionId
      : sessionIdOrToken;
  const payment =
    typeof paymentOrSessionId === "string" ? maybePayment : paymentOrSessionId;
  return apiRequest<PharmacyCheckoutResponse>(
    `/api/v1/pharmacy/session/${sessionId}/checkout/`,
    {
      method: "POST",
      body: { payment },
    },
  );
}

export interface PharmacyReportsResponse {
  daily: {
    date: string;
    total_transactions: number;
    total_revenue: number;
    cash_collected: number;
    online_collected: number;
    debt_added: number;
    debt_cleared: number;
  };
  monthly: {
    year: number;
    month: number;
    breakdown: Array<{
      day: number;
      total_transactions: number;
      total_revenue: number;
    }>;
    total_transactions: number;
    total_revenue: number;
  };
  yearly: {
    year: number;
    breakdown: Array<{
      month: number;
      total_transactions: number;
      total_revenue: number;
    }>;
    total_transactions: number;
    total_revenue: number;
  };
}

export async function getPharmacyReports(_token?: string) {
  return apiRequest<PharmacyReportsResponse>("/api/v1/pharmacy/reports/", {});
}

export async function getPharmacyInvoices(
  optsOrToken: { q?: string; page?: number; pageSize?: number } | string = {},
) {
  const opts = typeof optsOrToken === "string" ? {} : optsOrToken;
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 100));
  return apiRequest<{
    items: Array<{
      id: string;
      invoice_number: string;
      invoice_date: string;
      consultation_fee: number;
      medicine_total: number;
      discount: number;
      tax: number;
      grand_total: number;
      payment_status: "pending" | "paid" | "partial";
      payment_method?: "cash" | "online" | "split" | "debt";
      patient: {
        id: string;
        full_name: string;
        registration_number: string;
      };
    }>;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      hasNextPage: boolean;
    };
  }>(`/api/v1/pharmacy/invoices/?${params.toString()}`, {});
}

export async function searchPharmacyMedicines(
  optsOrToken: { q?: string; page?: number; pageSize?: number } | string = {},
  maybeOpts: { q?: string; page?: number; pageSize?: number } = {},
) {
  const opts = typeof optsOrToken === "string" ? maybeOpts : optsOrToken;
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 100));
  return apiRequest<{
    items: PharmacyMedicineSearchItem[];
    pagination: { page: number; pageSize: number; total: number };
  }>(`/api/v1/pharmacy/medicines/search/?${params.toString()}`, {});
}

export async function getInventory(
  optsOrToken:
    | {
        q?: string;
        category?: string;
        page?: number;
        pageSize?: number;
      }
    | string = {},
  maybeOpts: {
    q?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const opts = typeof optsOrToken === "string" ? maybeOpts : optsOrToken;
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.category) params.set("category", opts.category);
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 20));
  return apiRequest<{
    items: PharmacyInventoryItemResponse[];
    pagination: { page: number; pageSize: number; total: number };
  }>(`/api/v1/pharmacy/inventory/?${params.toString()}`, {});
}

export async function addMedicine(
  payloadOrToken:
    | {
        name: string;
        category: string;
        unit: MedicineUnit;
        unit_price: number;
        stock_quantity: number;
        description?: string;
      }
    | string,
  maybePayload?: {
    name: string;
    category: string;
    unit: MedicineUnit;
    unit_price: number;
    stock_quantity: number;
    description?: string;
  },
) {
  const payload =
    typeof payloadOrToken === "string" ? maybePayload : payloadOrToken;
  return apiRequest("/api/v1/pharmacy/inventory/", {
    method: "POST",
    body: payload,
  });
}

export async function addMedicineStock(
  medicineIdOrToken: string,
  quantityOrMedicineId: number | string,
  maybeQuantity?: number,
) {
  const medicineId =
    typeof quantityOrMedicineId === "string"
      ? quantityOrMedicineId
      : medicineIdOrToken;
  const quantity_to_add =
    typeof quantityOrMedicineId === "string"
      ? maybeQuantity
      : quantityOrMedicineId;
  return apiRequest(`/api/v1/pharmacy/inventory/${medicineId}/stock/`, {
    method: "POST",
    body: { quantity_to_add },
  });
}

// ── Reception: Dashboard stats ──
export interface DashboardStatsResponse {
  totalPatients: number;
  todayVisits: number;
  pendingCounsellor: number;
  pendingDoctor: number;
  pendingPharmacy: number;
  completedToday: number;
  lowStockMedicines: number;
  revenue: number;
}

export async function getDashboardStats(
  _token?: string,
): Promise<DashboardStatsResponse> {
  const raw = await apiRequest<Partial<DashboardStatsResponse>>(
    "/api/v1/receptionist/dashboard/",
    {},
  );
  return {
    totalPatients: raw.totalPatients ?? 0,
    todayVisits: raw.todayVisits ?? 0,
    pendingCounsellor: raw.pendingCounsellor ?? 0,
    pendingDoctor: raw.pendingDoctor ?? 0,
    pendingPharmacy: raw.pendingPharmacy ?? 0,
    completedToday: raw.completedToday ?? 0,
    lowStockMedicines: raw.lowStockMedicines ?? 0,
    revenue: raw.revenue ?? 0,
  };
}

// ── Reception: Queue (active sessions) ──
export interface QueueItem {
  session_id: string;
  patient_id: string;
  patient_name: string;
  checked_in_at: string;
  checked_in_by_name: string;
  status: string;
  current_stage: string;
  outstanding_debt: number;
}

export async function getQueueStatus(_token?: string) {
  return apiRequest<{ items: QueueItem[]; total: number }>(
    "/api/v1/receptionist/queue/",
    {},
  );
}

// ── Reception: Patient list (paginated, searchable) ──
export async function getPatientsList(
  optsOrToken: { q?: string; page?: number; pageSize?: number } | string = {},
  maybeOpts: { q?: string; page?: number; pageSize?: number } = {},
) {
  const opts = typeof optsOrToken === "string" ? maybeOpts : optsOrToken;
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 100));
  return apiRequest<{
    items: PatientLookupResponse[];
    pagination?: { page: number; pageSize: number; total: number };
  }>(`/api/v1/receptionist/patients/?${params.toString()}`, {});
}

// ── Patient visit history ──
export async function getPatientVisits(
  patientIdOrToken: string,
  maybePatientId?: string,
) {
  const patientId = maybePatientId ?? patientIdOrToken;
  return apiRequest<{
    items: Array<{
      id: string;
      visit_uid: string;
      visit_date: string;
      visit_type: string;
      medicines_total: number;
    }>;
  }>(`/api/v1/patients/${patientId}/visits/`, {});
}
