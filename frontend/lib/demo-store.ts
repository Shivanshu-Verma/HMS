// Demo data store with localStorage persistence
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
} from './types';

// Generate unique IDs
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Generate registration number
export function generateRegistrationNumber(): string {
  const prefix = 'AGH';
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${year}${random}`;
}

// Generate invoice number
export function generateInvoiceNumber(): string {
  const prefix = 'INV';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${date}${random}`;
}

// Demo Users
export const demoUsers: User[] = [
  {
    id: 'user-admin',
    email: 'admin@deaddiction.com',
    full_name: 'Admin User',
    role: 'admin',
    phone: '9876543210',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'user-reception',
    email: 'reception@deaddiction.com',
    full_name: 'Priya Sharma',
    role: 'reception',
    phone: '9876543211',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'user-counsellor',
    email: 'counsellor@deaddiction.com',
    full_name: 'Dr. Meera Patel',
    role: 'counsellor',
    phone: '9876543212',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'user-doctor',
    email: 'doctor@deaddiction.com',
    full_name: 'Dr. Rajesh Kumar',
    role: 'doctor',
    phone: '9876543213',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'user-pharmacist',
    email: 'pharmacy@deaddiction.com',
    full_name: 'Amit Singh',
    role: 'pharmacist',
    phone: '9876543214',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// Demo Patients - Initial data
export const demoPatients: Patient[] = [
  {
    id: 'patient-1',
    registration_number: 'AGH240001',
    patient_category: 'deaddiction',
    full_name: 'Rahul Verma',
    date_of_birth: '1985-05-15',
    gender: 'male',
    blood_group: 'B+',
    phone: '9812345678',
    email: 'rahul.verma@email.com',
    address: '123, Sector 15',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110015',
    addiction_type: 'alcohol',
    addiction_duration: '5 years',
    registration_date: '2024-01-10',
    first_visit_date: '2024-01-10',
    emergency_contact_name: 'Sunita Verma',
    emergency_contact_phone: '9898765432',
    emergency_contact_relation: 'Wife',
    family_history: 'Father had alcohol dependency',
    medical_history: 'Mild hypertension',
    allergies: 'Penicillin',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'patient-2',
    registration_number: 'AGH240002',
    patient_category: 'deaddiction',
    full_name: 'Anita Gupta',
    date_of_birth: '1990-08-22',
    gender: 'female',
    blood_group: 'O+',
    phone: '9823456789',
    address: '45, MG Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    addiction_type: 'drugs',
    addiction_duration: '2 years',
    registration_date: '2024-02-15',
    first_visit_date: '2024-02-15',
    emergency_contact_name: 'Rajesh Gupta',
    emergency_contact_phone: '9876123456',
    emergency_contact_relation: 'Brother',
    medical_history: 'None',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'patient-3',
    registration_number: 'AGH240003',
    patient_category: 'psychiatric',
    full_name: 'Vijay Kumar',
    date_of_birth: '1978-12-03',
    gender: 'male',
    blood_group: 'A+',
    phone: '9834567890',
    address: '78, Lake View Colony',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    addiction_type: 'tobacco',
    addiction_duration: '15 years',
    registration_date: '2024-03-01',
    first_visit_date: '2024-03-01',
    emergency_contact_name: 'Lakshmi Kumar',
    emergency_contact_phone: '9865432109',
    emergency_contact_relation: 'Wife',
    medical_history: 'Chronic bronchitis',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Demo Visits
const today = new Date().toISOString().split('T')[0];
export const demoVisits: Visit[] = [
  {
    id: 'visit-1',
    patient_id: 'patient-1',
    visit_date: today,
    visit_number: 1,
    checkin_time: new Date(today + 'T09:30:00').toISOString(),
    current_stage: 'counsellor',
    status: 'in_progress',
    created_at: new Date().toISOString(),
  },
  {
    id: 'visit-2',
    patient_id: 'patient-2',
    visit_date: today,
    visit_number: 1,
    checkin_time: new Date(today + 'T10:15:00').toISOString(),
    current_stage: 'doctor',
    status: 'in_progress',
    created_at: new Date().toISOString(),
  },
];

// Demo Counsellor Sessions
export const demoSessions: CounsellorSession[] = [
  {
    id: 'session-1',
    visit_id: 'visit-1',
    patient_id: 'patient-1',
    counsellor_id: 'user-counsellor',
    session_notes: 'Initial follow-up counselling completed.',
    mood_assessment: 6,
    risk_level: 'medium',
    follow_up_required: true,
    session_duration_minutes: 25,
    created_at: new Date().toISOString(),
  },
];

// Demo Doctor Consultations
export const demoConsultations: DoctorConsultation[] = [];

// Demo Medicines
export const demoMedicines: Medicine[] = [
  {
    id: 'med-1',
    name: 'Naltrexone 50mg',
    generic_name: 'Naltrexone',
    category: 'Anti-addiction',
    dosage_form: 'tablet',
    strength: '50mg',
    manufacturer: 'Sun Pharma',
    unit_price: 25,
    stock_quantity: 500,
    reorder_level: 100,
    expiry_date: '2025-12-31',
    batch_number: 'NAL2024001',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-2',
    name: 'Disulfiram 250mg',
    generic_name: 'Disulfiram',
    category: 'Anti-addiction',
    dosage_form: 'tablet',
    strength: '250mg',
    manufacturer: 'Cipla',
    unit_price: 15,
    stock_quantity: 300,
    reorder_level: 50,
    expiry_date: '2025-10-31',
    batch_number: 'DIS2024001',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-3',
    name: 'Acamprosate 333mg',
    generic_name: 'Acamprosate',
    category: 'Anti-addiction',
    dosage_form: 'tablet',
    strength: '333mg',
    manufacturer: 'Dr Reddy',
    unit_price: 35,
    stock_quantity: 200,
    reorder_level: 40,
    expiry_date: '2025-08-31',
    batch_number: 'ACA2024001',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-4',
    name: 'Buprenorphine 2mg',
    generic_name: 'Buprenorphine',
    category: 'Opioid Agonist',
    dosage_form: 'sublingual',
    strength: '2mg',
    manufacturer: 'Lupin',
    unit_price: 45,
    stock_quantity: 150,
    reorder_level: 30,
    expiry_date: '2025-09-30',
    batch_number: 'BUP2024001',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-5',
    name: 'Nicotine Patch 21mg',
    generic_name: 'Nicotine',
    category: 'Nicotine Replacement',
    dosage_form: 'patch',
    strength: '21mg/24hr',
    manufacturer: 'GSK',
    unit_price: 120,
    stock_quantity: 80,
    reorder_level: 20,
    expiry_date: '2025-06-30',
    batch_number: 'NIC2024001',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-6',
    name: 'Diazepam 5mg',
    generic_name: 'Diazepam',
    category: 'Benzodiazepine',
    dosage_form: 'tablet',
    strength: '5mg',
    manufacturer: 'Abbott',
    unit_price: 8,
    stock_quantity: 45,
    reorder_level: 50,
    expiry_date: '2025-11-30',
    batch_number: 'DIA2024001',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-7',
    name: 'Chlordiazepoxide 10mg',
    generic_name: 'Chlordiazepoxide',
    category: 'Benzodiazepine',
    dosage_form: 'capsule',
    strength: '10mg',
    manufacturer: 'Torrent',
    unit_price: 12,
    stock_quantity: 250,
    reorder_level: 60,
    expiry_date: '2025-07-31',
    batch_number: 'CHL2024001',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-8',
    name: 'Thiamine 100mg',
    generic_name: 'Vitamin B1',
    category: 'Vitamin',
    dosage_form: 'tablet',
    strength: '100mg',
    manufacturer: 'Mankind',
    unit_price: 5,
    stock_quantity: 600,
    reorder_level: 100,
    expiry_date: '2026-01-31',
    batch_number: 'THI2024001',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// Demo Prescriptions
export const demoPrescriptions: Prescription[] = [];

// Demo Invoices
export const demoInvoices: Invoice[] = [];

// Demo Inventory Transactions
export const demoInventoryTransactions: InventoryTransaction[] = [];

const STORAGE_KEYS = {
  patients: 'aggarwal_hospital_patients',
  visits: 'aggarwal_hospital_visits',
  sessions: 'aggarwal_hospital_sessions',
  consultations: 'aggarwal_hospital_consultations',
  prescriptions: 'aggarwal_hospital_prescriptions',
  invoices: 'aggarwal_hospital_invoices',
  inventoryTransactions: 'aggarwal_hospital_inventory',
  medicines: 'aggarwal_hospital_medicines',
};

// Helper to safely access localStorage (only on client side)
function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading from localStorage:', e);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
}

// In-memory store class with localStorage persistence
class DemoStore {
  private users: User[] = [...demoUsers];
  private patients: Patient[] = [];
  private visits: Visit[] = [];
  private sessions: CounsellorSession[] = [];
  private consultations: DoctorConsultation[] = [];
  private medicines: Medicine[] = [];
  private prescriptions: Prescription[] = [];
  private invoices: Invoice[] = [];
  private inventoryTransactions: InventoryTransaction[] = [];
  private initialized = false;

  constructor() {
    // Initialize will be called on first access
  }

  private initialize() {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;
    
    this.patients = getFromStorage(STORAGE_KEYS.patients, [...demoPatients]);
    this.visits = getFromStorage(STORAGE_KEYS.visits, [...demoVisits]);
    this.sessions = getFromStorage(STORAGE_KEYS.sessions, [...demoSessions]);
    this.consultations = getFromStorage(STORAGE_KEYS.consultations, [...demoConsultations]);
    this.medicines = getFromStorage(STORAGE_KEYS.medicines, [...demoMedicines]);
    this.prescriptions = getFromStorage(STORAGE_KEYS.prescriptions, [...demoPrescriptions]);
    this.invoices = getFromStorage(STORAGE_KEYS.invoices, [...demoInvoices]);
    this.inventoryTransactions = getFromStorage(STORAGE_KEYS.inventoryTransactions, [...demoInventoryTransactions]);
    this.initialized = true;
  }

  // Users
  getUsers() { return this.users; }
  getUserById(id: string) { return this.users.find(u => u.id === id); }
  getUserByEmail(email: string) { return this.users.find(u => u.email === email); }
  addUser(user: User) { this.users.push(user); return user; }
  updateUser(id: string, data: Partial<User>) {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...data };
      return this.users[index];
    }
    return null;
  }
  deleteUser(id: string) {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }

  // Patients
  getPatients() { 
    this.initialize();
    return this.patients; 
  }
  getPatientById(id: string) { 
    this.initialize();
    return this.patients.find(p => p.id === id); 
  }
  getPatientByRegistration(regNo: string) { 
    this.initialize();
    return this.patients.find(p => p.registration_number === regNo); 
  }
  addPatient(patient: Patient) { 
    this.initialize();
    this.patients.push(patient); 
    saveToStorage(STORAGE_KEYS.patients, this.patients);
    return patient; 
  }
  updatePatient(id: string, data: Partial<Patient>) {
    this.initialize();
    const index = this.patients.findIndex(p => p.id === id);
    if (index !== -1) {
      this.patients[index] = { ...this.patients[index], ...data, updated_at: new Date().toISOString() };
      saveToStorage(STORAGE_KEYS.patients, this.patients);
      return this.patients[index];
    }
    return null;
  }
  deletePatient(id: string) {
    this.initialize();
    const index = this.patients.findIndex(p => p.id === id);
    if (index !== -1) {
      this.patients.splice(index, 1);
      saveToStorage(STORAGE_KEYS.patients, this.patients);
      return true;
    }
    return false;
  }

  // Visits
  getVisits() { 
    this.initialize();
    return this.visits; 
  }
  getVisitById(id: string) { 
    this.initialize();
    return this.visits.find(v => v.id === id); 
  }
  getVisitsByPatient(patientId: string) { 
    this.initialize();
    return this.visits.filter(v => v.patient_id === patientId); 
  }
  getVisitsByStage(stage: string) { 
    this.initialize();
    return this.visits.filter(v => v.current_stage === stage && v.status === 'in_progress'); 
  }
  getTodayVisits() {
    this.initialize();
    const today = new Date().toISOString().split('T')[0];
    return this.visits.filter(v => v.visit_date === today);
  }
  addVisit(visit: Visit) { 
    this.initialize();
    this.visits.push(visit); 
    saveToStorage(STORAGE_KEYS.visits, this.visits);
    return visit; 
  }
  updateVisit(id: string, data: Partial<Visit>) {
    this.initialize();
    const index = this.visits.findIndex(v => v.id === id);
    if (index !== -1) {
      this.visits[index] = { ...this.visits[index], ...data };
      saveToStorage(STORAGE_KEYS.visits, this.visits);
      return this.visits[index];
    }
    return null;
  }

  // Sessions
  getSessions() { 
    this.initialize();
    return this.sessions; 
  }
  getSessionByVisit(visitId: string) { 
    this.initialize();
    return this.sessions.find(s => s.visit_id === visitId); 
  }
  addSession(session: CounsellorSession) { 
    this.initialize();
    this.sessions.push(session); 
    saveToStorage(STORAGE_KEYS.sessions, this.sessions);
    return session; 
  }

  // Consultations
  getConsultations() { 
    this.initialize();
    return this.consultations; 
  }
  getConsultationByVisit(visitId: string) { 
    this.initialize();
    return this.consultations.find(c => c.visit_id === visitId); 
  }
  addConsultation(consultation: DoctorConsultation) { 
    this.initialize();
    this.consultations.push(consultation); 
    saveToStorage(STORAGE_KEYS.consultations, this.consultations);
    return consultation; 
  }

  // Medicines
  getMedicines() { 
    this.initialize();
    return this.medicines; 
  }
  getMedicineById(id: string) { 
    this.initialize();
    return this.medicines.find(m => m.id === id); 
  }
  getLowStockMedicines() { 
    this.initialize();
    return this.medicines.filter(m => m.stock_quantity <= m.reorder_level); 
  }
  addMedicine(medicine: Medicine) { 
    this.initialize();
    this.medicines.push(medicine); 
    saveToStorage(STORAGE_KEYS.medicines, this.medicines);
    return medicine; 
  }
  updateMedicine(id: string, data: Partial<Medicine>) {
    this.initialize();
    const index = this.medicines.findIndex(m => m.id === id);
    if (index !== -1) {
      this.medicines[index] = { ...this.medicines[index], ...data };
      saveToStorage(STORAGE_KEYS.medicines, this.medicines);
      return this.medicines[index];
    }
    return null;
  }

  // Prescriptions
  getPrescriptions() { 
    this.initialize();
    return this.prescriptions; 
  }
  getPrescriptionsByVisit(visitId: string) { 
    this.initialize();
    return this.prescriptions.filter(p => p.visit_id === visitId); 
  }
  getPendingPrescriptions() { 
    this.initialize();
    return this.prescriptions.filter(p => !p.dispensed); 
  }
  addPrescription(prescription: Prescription) { 
    this.initialize();
    this.prescriptions.push(prescription); 
    saveToStorage(STORAGE_KEYS.prescriptions, this.prescriptions);
    return prescription; 
  }
  updatePrescription(id: string, data: Partial<Prescription>) {
    this.initialize();
    const index = this.prescriptions.findIndex(p => p.id === id);
    if (index !== -1) {
      this.prescriptions[index] = { ...this.prescriptions[index], ...data };
      saveToStorage(STORAGE_KEYS.prescriptions, this.prescriptions);
      return this.prescriptions[index];
    }
    return null;
  }

  // Invoices
  getInvoices() { 
    this.initialize();
    return this.invoices; 
  }
  getInvoiceByVisit(visitId: string) { 
    this.initialize();
    return this.invoices.find(i => i.visit_id === visitId); 
  }
  addInvoice(invoice: Invoice) { 
    this.initialize();
    this.invoices.push(invoice); 
    saveToStorage(STORAGE_KEYS.invoices, this.invoices);
    return invoice; 
  }
  updateInvoice(id: string, data: Partial<Invoice>) {
    this.initialize();
    const index = this.invoices.findIndex(i => i.id === id);
    if (index !== -1) {
      this.invoices[index] = { ...this.invoices[index], ...data };
      saveToStorage(STORAGE_KEYS.invoices, this.invoices);
      return this.invoices[index];
    }
    return null;
  }

  // Inventory
  getInventoryTransactions() { 
    this.initialize();
    return this.inventoryTransactions; 
  }
  addInventoryTransaction(transaction: InventoryTransaction) {
    this.initialize();
    this.inventoryTransactions.push(transaction);
    saveToStorage(STORAGE_KEYS.inventoryTransactions, this.inventoryTransactions);
    // Update medicine stock
    const medicine = this.getMedicineById(transaction.medicine_id);
    if (medicine) {
      const newQty = transaction.transaction_type === 'in' 
        ? medicine.stock_quantity + transaction.quantity
        : medicine.stock_quantity - transaction.quantity;
      this.updateMedicine(medicine.id, { stock_quantity: Math.max(0, newQty) });
    }
    return transaction;
  }

  // Dashboard stats
  getDashboardStats() {
    this.initialize();
    const today = new Date().toISOString().split('T')[0];
    const todayVisits = this.visits.filter(v => v.visit_date === today);
    
    return {
      totalPatients: this.patients.length,
      todayVisits: todayVisits.length,
      pendingCounsellor: this.visits.filter(v => v.current_stage === 'counsellor' && v.status === 'in_progress').length,
      pendingDoctor: this.visits.filter(v => v.current_stage === 'doctor' && v.status === 'in_progress').length,
      pendingPharmacy: this.visits.filter(v => v.current_stage === 'pharmacy' && v.status === 'in_progress').length,
      completedToday: todayVisits.filter(v => v.status === 'completed').length,
      lowStockMedicines: this.getLowStockMedicines().length,
      revenue: this.invoices.filter(i => i.invoice_date === today).reduce((sum, i) => sum + i.grand_total, 0),
    };
  }

  // Clear all data and reset to demo
  resetToDemo() {
    if (typeof window === 'undefined') return;
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    this.initialized = false;
    this.initialize();
  }
}

// Export singleton instance
const store = new DemoStore();
export { store };

// Hook for using the store
export function useDemoStore() {
  return store;
}
