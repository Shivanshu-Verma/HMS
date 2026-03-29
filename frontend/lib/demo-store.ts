// Demo data store - Replace with Supabase when connected
import { useState } from "react";
import type {
  User,
  Patient,
  Visit,
  CounsellorSession,
  DoctorConsultation,
  Medicine,
  Prescription,
  Invoice,
  InventoryTransaction,
} from "./types";

// Generate unique IDs
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Generate registration number
export function generateRegistrationNumber(): string {
  const prefix = "DAC";
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${prefix}${year}${random}`;
}

// Generate invoice number
export function generateInvoiceNumber(): string {
  const prefix = "INV";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}${date}${random}`;
}

// Demo Users
export const demoUsers: User[] = [
  {
    id: "user-admin",
    email: "admin@deaddiction.com",
    full_name: "Admin User",
    role: "admin",
    phone: "9876543210",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "user-reception",
    email: "reception@deaddiction.com",
    full_name: "Priya Sharma",
    role: "reception",
    phone: "9876543211",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "user-counsellor",
    email: "counsellor@deaddiction.com",
    full_name: "Dr. Meera Patel",
    role: "counsellor",
    phone: "9876543212",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "user-doctor",
    email: "doctor@deaddiction.com",
    full_name: "Dr. Rajesh Kumar",
    role: "doctor",
    phone: "9876543213",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "user-pharmacist",
    email: "pharmacy@deaddiction.com",
    full_name: "Amit Singh",
    role: "pharmacist",
    phone: "9876543214",
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// Demo Patients
export const demoPatients: Patient[] = [
  {
    id: "patient-1",
    registration_number: "DAC240001",
    full_name: "Rahul Verma",
    date_of_birth: "1985-05-15",
    gender: "male",
    blood_group: "B+",
    phone: "9812345678",
    email: "rahul.verma@email.com",
    address: "123, Sector 15",
    city: "Delhi",
    state: "Delhi",
    pincode: "110015",
    addiction_type: "alcohol",
    addiction_duration: "5 years",
    first_visit_date: "2024-01-10",
    emergency_contact_name: "Sunita Verma",
    emergency_contact_phone: "9898765432",
    emergency_contact_relation: "Wife",
    family_history: "Father had alcohol dependency",
    medical_history: "Mild hypertension",
    allergies: "Penicillin",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "patient-2",
    registration_number: "DAC240002",
    full_name: "Anita Gupta",
    date_of_birth: "1990-08-22",
    gender: "female",
    blood_group: "O+",
    phone: "9823456789",
    address: "45, MG Road",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    addiction_type: "drugs",
    addiction_duration: "2 years",
    first_visit_date: "2024-02-15",
    emergency_contact_name: "Rajesh Gupta",
    emergency_contact_phone: "9876123456",
    emergency_contact_relation: "Brother",
    medical_history: "None",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "patient-3",
    registration_number: "DAC240003",
    full_name: "Vijay Kumar",
    date_of_birth: "1978-12-03",
    gender: "male",
    blood_group: "A+",
    phone: "9834567890",
    address: "78, Lake View Colony",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560001",
    addiction_type: "tobacco",
    addiction_duration: "15 years",
    first_visit_date: "2024-03-01",
    emergency_contact_name: "Lakshmi Kumar",
    emergency_contact_phone: "9854321098",
    emergency_contact_relation: "Wife",
    allergies: "None",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Demo Medicines
export const demoMedicines: Medicine[] = [
  {
    id: "med-1",
    name: "Disulfiram 250mg",
    generic_name: "Disulfiram",
    category: "Anti-addiction",
    manufacturer: "Sun Pharma",
    unit: "tablet",
    price_per_unit: 8.5,
    stock_quantity: 500,
    reorder_level: 100,
    expiry_date: "2026-12-31",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "med-2",
    name: "Naltrexone 50mg",
    generic_name: "Naltrexone",
    category: "Anti-addiction",
    manufacturer: "Cipla",
    unit: "tablet",
    price_per_unit: 25.0,
    stock_quantity: 200,
    reorder_level: 50,
    expiry_date: "2026-06-30",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "med-3",
    name: "Acamprosate 333mg",
    generic_name: "Acamprosate",
    category: "Anti-addiction",
    manufacturer: "Dr. Reddy",
    unit: "tablet",
    price_per_unit: 15.0,
    stock_quantity: 300,
    reorder_level: 75,
    expiry_date: "2026-09-30",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "med-4",
    name: "Bupropion 150mg",
    generic_name: "Bupropion",
    category: "Antidepressant",
    manufacturer: "Lupin",
    unit: "tablet",
    price_per_unit: 12.0,
    stock_quantity: 400,
    reorder_level: 100,
    expiry_date: "2026-08-31",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "med-5",
    name: "Varenicline 1mg",
    generic_name: "Varenicline",
    category: "Smoking Cessation",
    manufacturer: "Pfizer",
    unit: "tablet",
    price_per_unit: 45.0,
    stock_quantity: 150,
    reorder_level: 30,
    expiry_date: "2026-05-31",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "med-6",
    name: "Diazepam 5mg",
    generic_name: "Diazepam",
    category: "Anxiolytic",
    manufacturer: "Ranbaxy",
    unit: "tablet",
    price_per_unit: 5.0,
    stock_quantity: 80,
    reorder_level: 100,
    expiry_date: "2025-12-31",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "med-7",
    name: "Thiamine 100mg",
    generic_name: "Vitamin B1",
    category: "Vitamin",
    manufacturer: "Abbott",
    unit: "tablet",
    price_per_unit: 2.0,
    stock_quantity: 1000,
    reorder_level: 200,
    expiry_date: "2027-03-31",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "med-8",
    name: "Multivitamin Syrup",
    generic_name: "Multivitamin",
    category: "Vitamin",
    manufacturer: "Himalaya",
    unit: "syrup",
    price_per_unit: 85.0,
    stock_quantity: 50,
    reorder_level: 20,
    expiry_date: "2026-04-30",
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// Demo Visits (some in progress at different stages)
export const demoVisits: Visit[] = [
  {
    id: "visit-1",
    patient_id: "patient-1",
    visit_date: new Date().toISOString().split("T")[0],
    visit_number: 5,
    current_stage: "counsellor",
    checkin_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    status: "in_progress",
  },
  {
    id: "visit-2",
    patient_id: "patient-2",
    visit_date: new Date().toISOString().split("T")[0],
    visit_number: 3,
    current_stage: "doctor",
    checkin_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    counsellor_start_time: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    counsellor_end_time: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    assigned_counsellor_id: "user-counsellor",
    status: "in_progress",
  },
  {
    id: "visit-3",
    patient_id: "patient-3",
    visit_date: new Date().toISOString().split("T")[0],
    visit_number: 1,
    current_stage: "pharmacy",
    checkin_time: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 1.5 hours ago
    counsellor_start_time: new Date(Date.now() - 80 * 60 * 1000).toISOString(),
    counsellor_end_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    doctor_start_time: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    doctor_end_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    assigned_counsellor_id: "user-counsellor",
    assigned_doctor_id: "user-doctor",
    status: "in_progress",
  },
];

// Demo Sessions
export const demoSessions: CounsellorSession[] = [
  {
    id: "session-1",
    visit_id: "visit-2",
    patient_id: "patient-2",
    counsellor_id: "user-counsellor",
    session_notes:
      "Patient shows improvement in managing cravings. Continues to attend support group meetings.",
    mood_assessment: 7,
    risk_level: "low",
    recommendations:
      "Continue current treatment plan. Encourage family involvement.",
    follow_up_required: true,
    session_duration_minutes: 25,
    created_at: new Date().toISOString(),
  },
  {
    id: "session-2",
    visit_id: "visit-3",
    patient_id: "patient-3",
    counsellor_id: "user-counsellor",
    session_notes:
      "First visit. Patient motivated to quit tobacco. Has tried multiple times before without success.",
    mood_assessment: 5,
    risk_level: "medium",
    recommendations:
      "Start nicotine replacement therapy. Weekly counselling sessions recommended.",
    follow_up_required: true,
    session_duration_minutes: 20,
    created_at: new Date().toISOString(),
  },
];

// Demo Consultations
export const demoConsultations: DoctorConsultation[] = [
  {
    id: "consultation-1",
    visit_id: "visit-3",
    patient_id: "patient-3",
    doctor_id: "user-doctor",
    diagnosis: "Nicotine dependence, moderate severity",
    treatment_plan: "Varenicline therapy for 12 weeks. Behavioral counselling.",
    clinical_notes:
      "Patient in good general health. Ready to start medication-assisted treatment.",
    vital_signs: {
      blood_pressure: "130/85",
      pulse: 78,
      weight: 72,
      temperature: 98.4,
    },
    next_visit_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    created_at: new Date().toISOString(),
  },
];

// Demo Prescriptions
export const demoPrescriptions: Prescription[] = [
  {
    id: "prescription-1",
    consultation_id: "consultation-1",
    visit_id: "visit-3",
    patient_id: "patient-3",
    medicine_id: "med-5",
    quantity: 28,
    dosage: "1mg",
    frequency: "twice_daily",
    duration_days: 14,
    instructions: "Take after meals. Do not smoke while on this medication.",
    dispensed: false,
  },
  {
    id: "prescription-2",
    consultation_id: "consultation-1",
    visit_id: "visit-3",
    patient_id: "patient-3",
    medicine_id: "med-7",
    quantity: 30,
    dosage: "100mg",
    frequency: "once_daily",
    duration_days: 30,
    instructions: "Take with breakfast.",
    dispensed: false,
  },
];

// Demo Invoices
export const demoInvoices: Invoice[] = [];

// Demo Inventory Transactions
export const demoInventoryTransactions: InventoryTransaction[] = [];

// In-memory store class for demo mode
class DemoStore {
  private users: User[] = [...demoUsers];
  private patients: Patient[] = [...demoPatients];
  private visits: Visit[] = [...demoVisits];
  private sessions: CounsellorSession[] = [...demoSessions];
  private consultations: DoctorConsultation[] = [...demoConsultations];
  private medicines: Medicine[] = [...demoMedicines];
  private prescriptions: Prescription[] = [...demoPrescriptions];
  private invoices: Invoice[] = [...demoInvoices];
  private inventoryTransactions: InventoryTransaction[] = [
    ...demoInventoryTransactions,
  ];

  // Users
  getUsers() {
    return this.users;
  }
  getUserById(id: string) {
    return this.users.find((u) => u.id === id);
  }
  getUserByEmail(email: string) {
    return this.users.find((u) => u.email === email);
  }
  addUser(user: User) {
    this.users.push(user);
    return user;
  }
  updateUser(id: string, data: Partial<User>) {
    const index = this.users.findIndex((u) => u.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...data };
      return this.users[index];
    }
    return null;
  }

  // Patients
  getPatients() {
    return this.patients;
  }
  getPatientById(id: string) {
    return this.patients.find((p) => p.id === id);
  }
  getPatientByRegistration(regNo: string) {
    return this.patients.find((p) => p.registration_number === regNo);
  }
  addPatient(patient: Patient) {
    this.patients.push(patient);
    return patient;
  }
  updatePatient(id: string, data: Partial<Patient>) {
    const index = this.patients.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.patients[index] = {
        ...this.patients[index],
        ...data,
        updated_at: new Date().toISOString(),
      };
      return this.patients[index];
    }
    return null;
  }

  // Visits
  getVisits() {
    return this.visits;
  }
  getVisitById(id: string) {
    return this.visits.find((v) => v.id === id);
  }
  getVisitsByPatient(patientId: string) {
    return this.visits.filter((v) => v.patient_id === patientId);
  }
  getVisitsByStage(stage: string) {
    return this.visits.filter(
      (v) => v.current_stage === stage && v.status === "in_progress",
    );
  }
  getTodayVisits() {
    const today = new Date().toISOString().split("T")[0];
    return this.visits.filter((v) => v.visit_date === today);
  }
  addVisit(visit: Visit) {
    this.visits.push(visit);
    return visit;
  }
  updateVisit(id: string, data: Partial<Visit>) {
    const index = this.visits.findIndex((v) => v.id === id);
    if (index !== -1) {
      this.visits[index] = { ...this.visits[index], ...data };
      return this.visits[index];
    }
    return null;
  }

  // Sessions
  getSessions() {
    return this.sessions;
  }
  getSessionByVisit(visitId: string) {
    return this.sessions.find((s) => s.visit_id === visitId);
  }
  addSession(session: CounsellorSession) {
    this.sessions.push(session);
    return session;
  }

  // Consultations
  getConsultations() {
    return this.consultations;
  }
  getConsultationByVisit(visitId: string) {
    return this.consultations.find((c) => c.visit_id === visitId);
  }
  addConsultation(consultation: DoctorConsultation) {
    this.consultations.push(consultation);
    return consultation;
  }

  // Medicines
  getMedicines() {
    return this.medicines;
  }
  getMedicineById(id: string) {
    return this.medicines.find((m) => m.id === id);
  }
  getLowStockMedicines() {
    return this.medicines.filter((m) => m.stock_quantity <= m.reorder_level);
  }
  addMedicine(medicine: Medicine) {
    this.medicines.push(medicine);
    return medicine;
  }
  updateMedicine(id: string, data: Partial<Medicine>) {
    const index = this.medicines.findIndex((m) => m.id === id);
    if (index !== -1) {
      this.medicines[index] = { ...this.medicines[index], ...data };
      return this.medicines[index];
    }
    return null;
  }

  // Prescriptions
  getPrescriptions() {
    return this.prescriptions;
  }
  getPrescriptionsByVisit(visitId: string) {
    return this.prescriptions.filter((p) => p.visit_id === visitId);
  }
  getPendingPrescriptions() {
    return this.prescriptions.filter((p) => !p.dispensed);
  }
  addPrescription(prescription: Prescription) {
    this.prescriptions.push(prescription);
    return prescription;
  }
  updatePrescription(id: string, data: Partial<Prescription>) {
    const index = this.prescriptions.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.prescriptions[index] = { ...this.prescriptions[index], ...data };
      return this.prescriptions[index];
    }
    return null;
  }

  // Invoices
  getInvoices() {
    return this.invoices;
  }
  getInvoiceByVisit(visitId: string) {
    return this.invoices.find((i) => i.visit_id === visitId);
  }
  addInvoice(invoice: Invoice) {
    this.invoices.push(invoice);
    return invoice;
  }
  updateInvoice(id: string, data: Partial<Invoice>) {
    const index = this.invoices.findIndex((i) => i.id === id);
    if (index !== -1) {
      this.invoices[index] = { ...this.invoices[index], ...data };
      return this.invoices[index];
    }
    return null;
  }

  // Inventory
  getInventoryTransactions() {
    return this.inventoryTransactions;
  }
  addInventoryTransaction(transaction: InventoryTransaction) {
    this.inventoryTransactions.push(transaction);
    // Update medicine stock
    const medicine = this.getMedicineById(transaction.medicine_id);
    if (medicine) {
      const newQty =
        transaction.transaction_type === "in"
          ? medicine.stock_quantity + transaction.quantity
          : medicine.stock_quantity - transaction.quantity;
      this.updateMedicine(medicine.id, { stock_quantity: Math.max(0, newQty) });
    }
    return transaction;
  }

  // Dashboard stats
  getDashboardStats() {
    const today = new Date().toISOString().split("T")[0];
    const todayVisits = this.visits.filter((v) => v.visit_date === today);

    return {
      totalPatients: this.patients.length,
      todayVisits: todayVisits.length,
      pendingCounsellor: this.visits.filter(
        (v) => v.current_stage === "counsellor" && v.status === "in_progress",
      ).length,
      pendingDoctor: this.visits.filter(
        (v) => v.current_stage === "doctor" && v.status === "in_progress",
      ).length,
      pendingPharmacy: this.visits.filter(
        (v) => v.current_stage === "pharmacy" && v.status === "in_progress",
      ).length,
      completedToday: todayVisits.filter((v) => v.status === "completed")
        .length,
      lowStockMedicines: this.getLowStockMedicines().length,
      revenue: this.invoices
        .filter((i) => i.invoice_date === today)
        .reduce((sum, i) => sum + i.grand_total, 0),
    };
  }
}

// Export singleton instance
export const store = new DemoStore();

/**
 * Compatibility hook used by admin demo pages.
 * Keeps old store structure intact and only adapts field names expected by legacy UI.
 */
export function useDemoStore() {
  const [, setVersion] = useState(0);

  const users = store.getUsers();
  const patients = store.getPatients().map((p) => ({
    ...p,
    name: p.full_name,
    patientId: p.registration_number,
    age: p.date_of_birth
      ? Math.max(
          0,
          new Date().getFullYear() - new Date(p.date_of_birth).getFullYear(),
        )
      : 0,
    bloodGroup: p.blood_group,
    addictionType: p.addiction_type,
    emergencyContact: p.emergency_contact_name,
    emergencyPhone: p.emergency_contact_phone,
    registeredAt: p.created_at,
  }));

  const visits = store.getVisits().map((v) => ({
    ...v,
    patientId: v.patient_id,
    currentStage: v.current_stage,
    checkInTime: v.checkin_time,
  }));

  const medicines = store.getMedicines().map((m) => ({
    ...m,
    stock: m.stock_quantity,
    reorderLevel: m.reorder_level,
    expiryDate: m.expiry_date,
  }));

  const invoices = store.getInvoices().map((i) => ({
    ...i,
    totalAmount: i.grand_total,
    createdAt: i.created_at,
  }));

  const staff = users.map((u) => ({
    id: u.id,
    name: u.full_name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    createdAt: u.created_at,
  }));

  const addStaff = (payload: {
    name: string;
    email: string;
    phone?: string;
    role: User["role"];
  }) => {
    store.addUser({
      id: generateId(),
      email: payload.email,
      full_name: payload.name,
      role: payload.role,
      phone: payload.phone,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    setVersion((v: number) => v + 1);
  };

  return { patients, visits, medicines, invoices, staff, addStaff };
}
