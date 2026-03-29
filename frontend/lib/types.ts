// User roles
export type UserRole =
  | "admin"
  | "reception"
  | "counsellor"
  | "doctor"
  | "pharmacist";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

// Patient types
export type Gender = "male" | "female" | "other";
export type AddictionType =
  | "alcohol"
  | "drugs"
  | "tobacco"
  | "gambling"
  | "other";
export type PatientStatus = "active" | "discharged" | "follow_up";

export interface Patient {
  id: string;
  registration_number: string;
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  blood_group?: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  photo_url?: string;
  aadhaar_number?: string;
  addiction_type: AddictionType;
  addiction_duration?: string;
  first_visit_date: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  family_history?: string;
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
  previous_treatments?: string;
  fingerprint_template?: string;
  status: PatientStatus;
  created_at: string;
  updated_at: string;
}

// Visit types
export type VisitStage =
  | "checkin"
  | "counsellor"
  | "doctor"
  | "pharmacy"
  | "completed";
export type VisitStatus = "in_progress" | "completed" | "cancelled";

export interface Visit {
  id: string;
  patient_id: string;
  patient?: Patient;
  visit_date: string;
  visit_number: number;
  current_stage: VisitStage;
  checkin_time?: string;
  counsellor_start_time?: string;
  counsellor_end_time?: string;
  doctor_start_time?: string;
  doctor_end_time?: string;
  pharmacy_time?: string;
  completed_time?: string;
  assigned_counsellor_id?: string;
  assigned_doctor_id?: string;
  pharmacist_id?: string;
  status: VisitStatus;
}

// Counsellor session
export type RiskLevel = "low" | "medium" | "high";

export interface CounsellorSession {
  id: string;
  visit_id: string;
  patient_id: string;
  counsellor_id: string;
  session_notes: string;
  mood_assessment?: number; // 1-10 scale
  risk_level: RiskLevel;
  recommendations?: string;
  follow_up_required: boolean;
  session_duration_minutes?: number;
  created_at: string;
}

// Doctor consultation
export interface VitalSigns {
  blood_pressure?: string;
  pulse?: number;
  weight?: number;
  temperature?: number;
}

export interface DoctorConsultation {
  id: string;
  visit_id: string;
  patient_id: string;
  doctor_id: string;
  diagnosis?: string;
  treatment_plan?: string;
  clinical_notes?: string;
  vital_signs?: VitalSigns;
  next_visit_date?: string;
  created_at: string;
}

// Medicine and Prescription
export type MedicineUnit =
  | "tablet"
  | "capsule"
  | "ml"
  | "mg"
  | "syrup"
  | "injection";
export type Frequency =
  | "once_daily"
  | "twice_daily"
  | "thrice_daily"
  | "as_needed";

export interface Medicine {
  id: string;
  name: string;
  generic_name?: string;
  category?: string;
  manufacturer?: string;
  unit: MedicineUnit;
  price_per_unit: number;
  stock_quantity: number;
  reorder_level: number;
  expiry_date?: string;
  is_active: boolean;
  created_at: string;
}

export interface Prescription {
  id: string;
  consultation_id: string;
  visit_id: string;
  patient_id: string;
  medicine_id: string;
  medicine?: Medicine;
  quantity: number;
  dosage: string;
  frequency: Frequency;
  duration_days: number;
  instructions?: string;
  dispensed: boolean;
  dispensed_at?: string;
}

// Invoice
export type PaymentStatus = "pending" | "paid" | "partial";
export type PaymentMethod = "cash" | "card" | "upi" | "insurance";

export interface Invoice {
  id: string;
  visit_id: string;
  patient_id: string;
  invoice_number: string;
  invoice_date: string;
  consultation_fee: number;
  medicine_total: number;
  discount: number;
  tax: number;
  grand_total: number;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  notes?: string;
  created_at: string;
}

// Inventory transaction
export type TransactionType = "in" | "out";

export interface InventoryTransaction {
  id: string;
  medicine_id: string;
  transaction_type: TransactionType;
  quantity: number;
  reference_id?: string;
  performed_by: string;
  notes?: string;
  created_at: string;
}

// Dashboard stats
export interface DashboardStats {
  totalPatients: number;
  todayVisits: number;
  pendingCounsellor: number;
  pendingDoctor: number;
  pendingPharmacy: number;
  completedToday: number;
  lowStockMedicines: number;
  revenue: number;
}
