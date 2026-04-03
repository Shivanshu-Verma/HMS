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
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

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
  [key: string]: unknown;
}

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
  daily?: {
    total_followups?: number;
    total_checkins?: number;
  };
  monthly?: {
    total?: number;
    total_checkins?: number;
  };
  yearly?: {
    total?: number;
    total_checkins?: number;
  };
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
  });
}

export async function registerPatientTier1(
  token: string,
  payload: {
    patient_category?: PatientCategory;
    file_number?: string;
    full_name: string;
    phone_number: string;
    date_of_birth: string;
    sex: "male" | "female" | "other";
    fingerprint_hash: string;
    aadhaar_number?: string;
    relative_phone?: string;
    address_line1?: string;
  },
): Promise<PatientLookupResponse> {
  return apiRequest<PatientLookupResponse>("/api/v1/patients/register/", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function lookupPatient(
  token: string,
  query: { registration_number?: string; fingerprint_hash?: string },
): Promise<PatientLookupResponse> {
  const params = new URLSearchParams();
  if (query.registration_number)
    params.set("registration_number", query.registration_number);
  if (query.fingerprint_hash)
    params.set("fingerprint_hash", query.fingerprint_hash);
  return apiRequest<PatientLookupResponse>(
    `/api/v1/patients/lookup/?${params.toString()}`,
    {
      token,
    },
  );
}

export async function checkinPatient(
  token: string,
  patient_id: string,
): Promise<CheckinResponse> {
  return apiRequest<CheckinResponse>("/api/v1/sessions/checkin/", {
    method: "POST",
    token,
    body: { patient_id },
  });
}

export async function getCounsellorFollowup(
  token: string,
  page = 1,
  pageSize = 20,
): Promise<{
  items: FollowupItem[];
  pagination: { page: number; pageSize: number; total: number };
}> {
  return apiRequest(
    `/api/v1/counsellor/followup/?page=${page}&pageSize=${pageSize}`,
    { token },
  );
}

export async function getCounsellorQueue(token: string) {
  return apiRequest<{ items: CounsellorQueueItem[]; total: number }>(
    "/api/v1/counsellor/queue/",
    { token },
  );
}

export async function getCounsellorSessionDetail(
  token: string,
  sessionId: string,
) {
  return apiRequest<CounsellorSessionDetailResponse>(
    `/api/v1/counsellor/session/${sessionId}/`,
    { token },
  );
}

export async function completeCounsellorSession(
  token: string,
  sessionId: string,
  payload: {
    session_notes: string;
    mood_assessment?: number;
    risk_level: "low" | "medium" | "high";
    recommendations?: string;
    follow_up_required?: boolean;
  },
) {
  return apiRequest(`/api/v1/counsellor/session/${sessionId}/complete/`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function updatePatientStatus(
  token: string,
  patientId: string,
  status: "active" | "inactive" | "dead",
): Promise<{ patient_id: string; full_name: string; status: string }> {
  return apiRequest(`/api/v1/counsellor/patients/${patientId}/status/`, {
    method: "PATCH",
    token,
    body: { status },
  });
}

export async function getCounsellorReports(token: string) {
  return apiRequest<CounsellorReportsResponse>("/api/v1/counsellor/reports/", {
    token,
  });
}

export async function getCounsellorPatientsList(
  token: string,
  opts: { q?: string; page?: number; pageSize?: number } = {},
) {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 100));
  return apiRequest<{
    items: PatientLookupResponse[];
    pagination?: { page: number; pageSize: number; total: number };
  }>(`/api/v1/counsellor/patients/?${params.toString()}`, { token });
}

export async function getReceptionReports(token: string) {
  return apiRequest("/api/v1/receptionist/reports/", { token });
}

export async function getPharmacyQueue(token: string) {
  return apiRequest<{ items: PharmacyQueueItem[]; total: number }>(
    "/api/v1/pharmacy/queue/",
    { token },
  );
}

export async function getPharmacySessionDetail(
  token: string,
  sessionId: string,
) {
  return apiRequest<PharmacySessionDetailResponse>(
    `/api/v1/pharmacy/session/${sessionId}/`,
    { token },
  );
}

export async function submitPharmacyDispense(
  token: string,
  sessionId: string,
  payload: {
    items: Array<{ medicine_id: string; quantity: number; unit_price: number }>;
  },
) {
  return apiRequest<PharmacyDispenseResponse>(
    `/api/v1/pharmacy/session/${sessionId}/dispense/`,
    {
      method: "POST",
      token,
      body: payload,
    },
  );
}

export async function checkoutPharmacySession(
  token: string,
  sessionId: string,
  payment: {
    method: PharmacyPaymentMethod;
    cash_amount?: number;
    online_amount?: number;
    debt_cleared?: number;
    new_debt?: number;
  },
) {
  return apiRequest<PharmacyCheckoutResponse>(
    `/api/v1/pharmacy/session/${sessionId}/checkout/`,
    {
      method: "POST",
      token,
      body: { payment },
    },
  );
}

export async function getPharmacyReports(token: string) {
  return apiRequest("/api/v1/pharmacy/reports/", { token });
}

export async function getPharmacyInvoices(
  token: string,
  opts: { q?: string; page?: number; pageSize?: number } = {}
) {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  params.set('page', String(opts.page ?? 1));
  params.set('pageSize', String(opts.pageSize ?? 100));
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
      payment_status: 'pending' | 'paid' | 'partial';
      payment_method?: 'cash' | 'online' | 'split' | 'debt';
      patient: {
        id: string;
        full_name: string;
        registration_number: string;
      };
    }>;
    pagination: { page: number; pageSize: number; total: number; hasNextPage: boolean };
  }>(`/api/v1/pharmacy/invoices/?${params.toString()}`, { token });
}

export async function searchPharmacyMedicines(
  token: string,
  opts: { q?: string; page?: number; pageSize?: number } = {},
) {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 100));
  return apiRequest<{
    items: PharmacyMedicineSearchItem[];
    pagination: { page: number; pageSize: number; total: number };
  }>(`/api/v1/pharmacy/medicines/search/?${params.toString()}`, { token });
}

export async function getInventory(
  token: string,
  opts: {
    q?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.category) params.set("category", opts.category);
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 20));
  return apiRequest<{
    items: PharmacyInventoryItemResponse[];
    pagination: { page: number; pageSize: number; total: number };
  }>(`/api/v1/pharmacy/inventory/?${params.toString()}`, { token });
}

export async function addMedicine(
  token: string,
  payload: {
    name: string;
    category: string;
    unit: MedicineUnit;
    unit_price: number;
    stock_quantity: number;
    description?: string;
  },
) {
  return apiRequest("/api/v1/pharmacy/inventory/", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function addMedicineStock(
  token: string,
  medicineId: string,
  quantity_to_add: number,
) {
  return apiRequest(`/api/v1/pharmacy/inventory/${medicineId}/stock/`, {
    method: "POST",
    token,
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
  token: string,
): Promise<DashboardStatsResponse> {
  const raw = await apiRequest<Partial<DashboardStatsResponse>>(
    "/api/v1/receptionist/dashboard/",
    { token },
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

export async function getQueueStatus(token: string) {
  return apiRequest<{ items: QueueItem[]; total: number }>(
    "/api/v1/receptionist/queue/",
    { token },
  );
}

// ── Reception: Patient list (paginated, searchable) ──
export async function getPatientsList(
  token: string,
  opts: { q?: string; page?: number; pageSize?: number } = {},
) {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 100));
  return apiRequest<{
    items: PatientLookupResponse[];
    pagination?: { page: number; pageSize: number; total: number };
  }>(`/api/v1/receptionist/patients/?${params.toString()}`, { token });
}

// ── Patient visit history ──
export async function getPatientVisits(token: string, patientId: string) {
  return apiRequest<{
    items: Array<{
      id: string;
      visit_uid: string;
      visit_date: string;
      visit_type: string;
      medicines_total: number;
    }>;
  }>(`/api/v1/patients/${patientId}/visits/`, { token });
}
