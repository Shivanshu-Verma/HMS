'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { getPatientsList, type PatientLookupResponse } from '@/lib/hms-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Search,
  User,
  Phone,
  MapPin,
  Calendar,
  Edit,
  ArrowUpDown,
  FileText,
  Droplet,
  Users,
  Save,
  X,
  CreditCard,
  Fingerprint,
  Hash,
  Briefcase,
  GraduationCap,
  HeartPulse,
  Syringe,
  ArrowLeft,
  Clock,
  Stethoscope,
  Pill,
  MessageSquare,
  ChevronRight,
  Activity,
  Download,
  Filter,
  RotateCcw,
} from 'lucide-react';
import type { 
  Patient, 
  Visit,
  Gender, 
  AddictionType, 
  PatientStatus,
  EmploymentStatus,
  EducationLevel,
  MaritalStatus,
  LivingArrangement,
  SubstanceType,
} from '@/lib/types';
import {
  EMPLOYMENT_STATUS_LABELS,
  EDUCATION_LABELS,
  MARITAL_STATUS_LABELS,
  LIVING_ARRANGEMENT_LABELS,
  SUBSTANCE_TYPE_LABELS,
  BLOOD_GROUP_OPTIONS,
  RELIGION_OPTIONS,
  NATIONALITY_OPTIONS,
} from '@/lib/types';

export default function PatientDataPage() {
  const { accessToken } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterAddictionType, setFilterAddictionType] = useState<string>('all');
  const [filterDistrict, setFilterDistrict] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');

  const mapApiPatient = (p: PatientLookupResponse): Patient => ({
    id: p.patient_id,
    registration_number: p.registration_number,
    patient_category: (p.patient_category as any) || 'deaddiction',
    full_name: p.full_name,
    date_of_birth: p.date_of_birth,
    phone: p.phone_number || p.phone || '',
    gender: (p.sex || p.gender || 'male') as Gender,
    status: p.status as PatientStatus,
    address: (p.address_line1 || p.address || '') as string,
    city: '',
    state: '',
    pincode: '',
    addiction_type: ((p as any).addiction_type || 'other') as AddictionType,
    addiction_duration: (p as any).addiction_duration_text || (p as any).addiction_duration || '',
    first_visit_date: p.date_of_birth,
    emergency_contact_name: (p as any).emergency_contact_name || '',
    emergency_contact_phone: (p as any).emergency_contact_phone || '',
    emergency_contact_relation: (p as any).emergency_contact_relation || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    blood_group: (p as any).blood_group || '',
    email: (p as any).email || '',
    aadhaar_number: (p as any).aadhaar_number_last4 ? `XXXX XXXX ${(p as any).aadhaar_number_last4}` : '',
    relative_phone: (p as any).relative_phone || '',
    medical_history: (p as any).medical_history || '',
    allergies: (p as any).allergies || '',
    family_history: (p as any).family_history || '',
    current_medications: (p as any).current_medications || '',
    previous_treatments: (p as any).previous_treatments || '',
  });

  // Load patients
  useEffect(() => {
    if (!accessToken) return;
    getPatientsList(accessToken)
      .then((data) => setPatients(data.items.map(mapApiPatient)))
      .catch(() => setPatients([]));
  }, [accessToken]);

  // Load visits when patient is selected
  useEffect(() => {
    if (selectedPatient) {
      setPatientVisits([]);
    }
  }, [selectedPatient]);

  // Reset filters
  const resetFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterAddictionType('all');
    setFilterDistrict('all');
    setFilterState('all');
    setSearchQuery('');
  };

  // Get unique districts and states from patients for filter dropdowns
  const uniqueDistricts = useMemo(() => {
    const districts = new Set<string>();
    patients.forEach(p => {
      if (p.district) districts.add(p.district);
    });
    return Array.from(districts).sort();
  }, [patients]);

  const uniqueStates = useMemo(() => {
    const states = new Set<string>();
    patients.forEach(p => {
      if (p.state) states.add(p.state);
    });
    return Array.from(states).sort();
  }, [patients]);

  // Filter and sort patients
  const filteredPatients = useMemo(() => {
    let result = patients.filter((patient) => {
      // Search query filter
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || (
        patient.registration_number.toLowerCase().includes(query) ||
        patient.full_name.toLowerCase().includes(query) ||
        patient.phone.includes(query) ||
        (patient.aadhaar_number && patient.aadhaar_number.includes(query)) ||
        (patient.hdams_id && patient.hdams_id.toLowerCase().includes(query))
      );

      // Date range filter (registration date)
      let matchesDateRange = true;
      if (filterDateFrom || filterDateTo) {
        const regDate = patient.registration_date ? new Date(patient.registration_date) : null;
        if (regDate) {
          if (filterDateFrom && regDate < new Date(filterDateFrom)) matchesDateRange = false;
          if (filterDateTo && regDate > new Date(filterDateTo + 'T23:59:59')) matchesDateRange = false;
        } else {
          matchesDateRange = false;
        }
      }

      // Addiction type filter
      const matchesAddiction = filterAddictionType === 'all' || patient.addiction_type === filterAddictionType;

      // District filter
      const matchesDistrict = filterDistrict === 'all' || patient.district === filterDistrict;

      // State filter
      const matchesState = filterState === 'all' || patient.state === filterState;

      return matchesSearch && matchesDateRange && matchesAddiction && matchesDistrict && matchesState;
    });

    result.sort((a, b) => {
      const comparison = a.registration_number.localeCompare(b.registration_number);
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [patients, searchQuery, sortOrder, filterDateFrom, filterDateTo, filterAddictionType, filterDistrict, filterState]);

  // Export to Excel (CSV format that Excel can open)
  const exportToExcel = () => {
    if (filteredPatients.length === 0) {
      toast.error('No patients to export');
      return;
    }

    // Define CSV headers
    const headers = [
      'File Number',
      'HDAMS ID',
      'Full Name',
      'Aadhaar Number',
      'Date of Birth',
      'Age',
      'Gender',
      'Phone',
      'Relative Phone',
      'Address',
      'City',
      'District',
      'State',
      'Father Name',
      'Mother Name',
      'Spouse Name',
      'Blood Group',
      'Religion',
      'Nationality',
      'Education',
      'Occupation',
      'Employment Status',
      'Marital Status',
      'Monthly Income',
      'Living Arrangement',
      'Addiction Type',
      'Substances Used Currently',
      'Substances Ever Used',
      'Injection Use Ever',
      'Injection Use Currently',
      'Syringe Sharing',
      'STI/STD',
      'Jaundice',
      'HIV Screening',
      'HIV Result',
      'Co-morbid Medical Illness',
      'Co-morbid Physical Illness',
      'Previous Treatment',
      'Ever Hospitalized',
      'Status',
      'Registration Date',
    ];

    // Convert patients to CSV rows
    const rows = filteredPatients.map(patient => [
      patient.registration_number || '',
      patient.hdams_id || '',
      patient.full_name || '',
      patient.aadhaar_number || '',
      patient.date_of_birth || '',
      patient.date_of_birth ? getAge(patient.date_of_birth) : '',
      patient.gender || '',
      patient.phone || '',
      patient.relative_phone || '',
      patient.address || '',
      patient.city || '',
      patient.district || '',
      patient.state || '',
      patient.father_name || '',
      patient.mother_name || '',
      patient.spouse_name || '',
      patient.blood_group || '',
      patient.religion || '',
      patient.nationality || '',
      patient.education ? EDUCATION_LABELS[patient.education] : '',
      patient.occupation || '',
      patient.employment_status ? EMPLOYMENT_STATUS_LABELS[patient.employment_status] : '',
      patient.marital_status ? MARITAL_STATUS_LABELS[patient.marital_status] : '',
      patient.monthly_income || '',
      patient.living_arrangement ? LIVING_ARRANGEMENT_LABELS[patient.living_arrangement] : '',
      patient.addiction_type || '',
      patient.substance_used_currently?.map(s => SUBSTANCE_TYPE_LABELS[s]).join('; ') || '',
      patient.substance_ever_used?.map(s => SUBSTANCE_TYPE_LABELS[s]).join('; ') || '',
      patient.injection_use_ever ? 'Yes' : 'No',
      patient.injection_use_currently ? 'Yes' : 'No',
      patient.syringe_sharing ? 'Yes' : 'No',
      patient.sti_std || '',
      patient.jaundice || '',
      patient.hiv_screening ? 'Yes' : 'No',
      patient.hiv_result || '',
      patient.comorbid_medical_illness || '',
      patient.comorbid_medical_illness || '',
      patient.previous_treatments || '',
      patient.ever_hospitalized ? 'Yes' : 'No',
      patient.status || '',
      patient.registration_date ? formatDate(patient.registration_date) : '',
    ]);

    // Create CSV content
    const escapeCSV = (value: string | number) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const fileName = `patient_data_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredPatients.length} patients to ${fileName}`);
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveTab('profile');
  };

  const handleBackToList = () => {
    setSelectedPatient(null);
    setPatientVisits([]);
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatient({ ...patient });
    setIsEditOpen(true);
  };

  const handleSavePatient = () => {
    if (!editingPatient) return;
    // In API mode, update locally (backend PATCH could be added later)
    setPatients(prev => prev.map(p => p.id === editingPatient.id ? editingPatient : p));
    setSelectedPatient(editingPatient);
    toast.success('Patient data updated locally');
    setIsEditOpen(false);
    setEditingPatient(null);
  };

  const handleEditChange = (field: keyof Patient, value: any) => {
    if (editingPatient) {
      setEditingPatient({ ...editingPatient, [field]: value });
    }
  };

  const handleSubstanceToggle = (field: 'substance_used_currently' | 'substance_ever_used', substance: SubstanceType) => {
    if (!editingPatient) return;
    const current = editingPatient[field] || [];
    const updated = current.includes(substance)
      ? current.filter(s => s !== substance)
      : [...current, substance];
    handleEditChange(field, updated);
  };

  const getAge = (dob: string) => {
    if (!dob) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatAadhaar = (aadhaar: string | undefined) => {
    if (!aadhaar) return 'N/A';
    const digits = aadhaar.replace(/\D/g, '');
    if (digits.length !== 12) return aadhaar;
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'counsellor': return <MessageSquare className="h-4 w-4" />;
      case 'doctor': return <Stethoscope className="h-4 w-4" />;
      case 'pharmacy': return <Pill className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'counsellor': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'doctor': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'pharmacy': return 'bg-orange-100 text-orange-700 border-orange-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  // Section component for view
  const ViewSection = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-5 w-5 text-[#0d7377]" />
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-4 pl-7">
        {children}
      </div>
    </div>
  );

  // Field display component
  const ViewField = ({ label, value }: { label: string; value: string | number | undefined }) => (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || 'N/A'}</p>
    </div>
  );

  // If a patient is selected, show full profile
  if (selectedPatient) {
    return (
      <div className="space-y-6">
        {/* Back Button & Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackToList}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{selectedPatient.full_name}</h1>
            <p className="text-muted-foreground">
              File No: <span className="font-mono text-[#0d7377]">{selectedPatient.registration_number}</span>
              {selectedPatient.hdams_id && (
                <> | HDAMS: <span className="font-mono">{selectedPatient.hdams_id}</span></>
              )}
            </p>
          </div>
          <Button
            onClick={() => handleEditPatient(selectedPatient)}
            className="bg-gradient-to-r from-[#0d7377] to-[#14919b]"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        </div>

        {/* Patient Profile Card */}
        <Card className="border-[#0d7377]/20 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-[#0d7377] to-[#14919b]" />
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              {/* Photo */}
              <div className="flex-shrink-0">
                {selectedPatient.photo_url ? (
                  <Image
                    src={selectedPatient.photo_url}
                    alt={selectedPatient.full_name}
                    width={120}
                    height={120}
                    className="rounded-xl object-cover border-2 border-[#0d7377]/30"
                  />
                ) : (
                  <div className="w-[120px] h-[120px] rounded-xl bg-gradient-to-br from-[#0d7377]/10 to-[#14919b]/10 flex items-center justify-center border-2 border-[#0d7377]/30">
                    <User className="h-12 w-12 text-[#0d7377]" />
                  </div>
                )}
                {selectedPatient.fingerprint_template && (
                  <Badge variant="outline" className="mt-2 w-full justify-center bg-green-50 text-green-700 border-green-300">
                    <Fingerprint className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>

              {/* Quick Info */}
              <div className="flex-1 grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Aadhaar</p>
                  <p className="font-mono font-medium">{formatAadhaar(selectedPatient.aadhaar_number)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Age / Gender</p>
                  <p className="font-medium">{getAge(selectedPatient.date_of_birth)} yrs / {selectedPatient.gender?.charAt(0).toUpperCase()}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Mobile</p>
                  <p className="font-medium">{selectedPatient.phone}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Relative Mobile</p>
                  <p className="font-medium">{selectedPatient.relative_phone || 'N/A'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={selectedPatient.status === 'active' ? 'bg-green-100 text-green-700' : ''}>
                    {selectedPatient.status}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Visits</p>
                  <p className="font-medium text-[#0d7377]">{patientVisits.length}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Profile & Visit History */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Full Profile
            </TabsTrigger>
            <TabsTrigger value="visits" className="gap-2">
              <Activity className="h-4 w-4" />
              Visit History ({patientVisits.length})
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardContent className="pt-6">
                <ScrollArea className="h-[60vh] pr-4">
                  {/* Personal Information */}
                  <ViewSection title="Personal Information" icon={User}>
                    <ViewField label="Date of Birth" value={formatDate(selectedPatient.date_of_birth)} />
                    <ViewField label="Gender" value={selectedPatient.gender?.charAt(0).toUpperCase() + selectedPatient.gender?.slice(1)} />
                    <ViewField label="Blood Group" value={selectedPatient.blood_group} />
                    <ViewField label="Nationality" value={selectedPatient.nationality} />
                    <ViewField label="Religion" value={selectedPatient.religion} />
                    <ViewField label="Monthly Income" value={selectedPatient.monthly_income} />
                  </ViewSection>

                  <Separator className="my-4" />

                  {/* Family Information */}
                  <ViewSection title="Family Details" icon={Users}>
                    <ViewField label="Father's Name" value={selectedPatient.father_name} />
                    <ViewField label="Mother's Name" value={selectedPatient.mother_name} />
                    <ViewField label="Grandfather's Name" value={selectedPatient.grandfather_name} />
                    <ViewField label="Spouse Name" value={selectedPatient.spouse_name} />
                    <ViewField label="Marital Status" value={selectedPatient.marital_status ? MARITAL_STATUS_LABELS[selectedPatient.marital_status] : undefined} />
                    <ViewField label="Living Arrangement" value={selectedPatient.living_arrangement ? LIVING_ARRANGEMENT_LABELS[selectedPatient.living_arrangement] : undefined} />
                  </ViewSection>

                  <Separator className="my-4" />

                  {/* Contact Information */}
                  <ViewSection title="Contact Details" icon={Phone}>
                    <ViewField label="Emergency Contact" value={selectedPatient.emergency_contact_name} />
                    <ViewField label="Emergency Phone" value={selectedPatient.emergency_contact_phone} />
                    <ViewField label="Relation" value={selectedPatient.emergency_contact_relation} />
                  </ViewSection>

                  <Separator className="my-4" />

                  {/* Address */}
                  <ViewSection title="Address" icon={MapPin}>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Full Address</p>
                      <p className="font-medium">{selectedPatient.address}</p>
                    </div>
                    <ViewField label="Block/MC" value={selectedPatient.block_mc} />
                    <ViewField label="City" value={selectedPatient.city} />
                    <ViewField label="District" value={selectedPatient.district} />
                    <ViewField label="State" value={selectedPatient.state} />
                    <ViewField label="Pincode" value={selectedPatient.pincode} />
                  </ViewSection>

                  <Separator className="my-4" />

                  {/* Education & Employment */}
                  <ViewSection title="Education & Employment" icon={Briefcase}>
                    <ViewField label="Education" value={selectedPatient.education ? EDUCATION_LABELS[selectedPatient.education] : undefined} />
                    <ViewField label="Employment Status" value={selectedPatient.employment_status ? EMPLOYMENT_STATUS_LABELS[selectedPatient.employment_status] : undefined} />
                    <ViewField label="Occupation" value={selectedPatient.occupation} />
                  </ViewSection>

                  <Separator className="my-4" />

                  {/* Substance Use */}
                  <ViewSection title="Substance Use Details" icon={Syringe}>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Currently Using</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedPatient.substance_used_currently?.length ? (
                          selectedPatient.substance_used_currently.map(s => (
                            <Badge key={s} variant="destructive" className="text-xs">
                              {SUBSTANCE_TYPE_LABELS[s]}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">None specified</span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Ever Used</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedPatient.substance_ever_used?.length ? (
                          selectedPatient.substance_ever_used.map(s => (
                            <Badge key={s} variant="secondary" className="text-xs">
                              {SUBSTANCE_TYPE_LABELS[s]}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">None specified</span>
                        )}
                      </div>
                    </div>
                    <ViewField label="Injection Use (Ever)" value={selectedPatient.injection_use_ever ? 'Yes' : 'No'} />
                    <ViewField label="Injection Use (Currently)" value={selectedPatient.injection_use_currently ? 'Yes' : 'No'} />
                    <ViewField label="Route of Admission" value={selectedPatient.route_of_admission} />
                    <ViewField label="Syringe/Needle Sharing" value={selectedPatient.syringe_sharing ? 'Yes' : 'No'} />
                  </ViewSection>

                  <Separator className="my-4" />

                  {/* Medical History */}
                  <ViewSection title="Medical History" icon={HeartPulse}>
                    <ViewField label="STI/STD" value={selectedPatient.sti_std} />
                    <ViewField label="Jaundice" value={selectedPatient.jaundice ? 'Yes' : 'No'} />
                    <ViewField label="Sex with Sex Worker" value={selectedPatient.sex_with_sex_worker ? 'Yes' : 'No'} />
                    <ViewField label="HIV Screening" value={selectedPatient.hiv_screening ? 'Yes' : 'No'} />
                    {selectedPatient.hiv_screening && (
                      <ViewField label="HIV Result" value={selectedPatient.hiv_result} />
                    )}
                    <div className="col-span-2">
                      <ViewField label="Co-morbid Medical Illness" value={selectedPatient.comorbid_medical_illness} />
                    </div>
                    <div className="col-span-2">
                      <ViewField label="Co-morbid Psychiatric Illness" value={selectedPatient.comorbid_psychiatric_illness} />
                    </div>
                    <ViewField label="Previous Drug Treatment" value={selectedPatient.previous_drug_treatment} />
                    <ViewField label="Ever Hospitalized" value={selectedPatient.ever_hospitalized ? 'Yes' : 'No'} />
                    <div className="col-span-2">
                      <ViewField label="Allergies" value={selectedPatient.allergies} />
                    </div>
                  </ViewSection>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visit History Tab */}
          <TabsContent value="visits" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-[#0d7377]" />
                  Visit History
                </CardTitle>
                <CardDescription>
                  All visits and treatment records for this patient
                </CardDescription>
              </CardHeader>
              <CardContent>
                {patientVisits.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No visits recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {patientVisits.map((visit, index) => (
                      <Card 
                        key={visit.id} 
                        className={`border-l-4 ${
                          visit.status === 'completed' 
                            ? 'border-l-green-500 bg-green-50/50' 
                            : 'border-l-[#0d7377] bg-[#0d7377]/5'
                        }`}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-[#0d7377]/10 flex items-center justify-center font-semibold text-[#0d7377]">
                                {patientVisits.length - index}
                              </div>
                              <div>
                                <p className="font-medium">
                                  Visit on {formatDateTime(visit.checkin_time)}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className={getStageColor(visit.current_stage)}>
                                    {getStageIcon(visit.current_stage)}
                                    <span className="ml-1 capitalize">{visit.current_stage}</span>
                                  </Badge>
                                  <Badge variant={visit.status === 'completed' ? 'default' : 'secondary'}>
                                    {visit.status === 'completed' ? 'Completed' : 'In Progress'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            {visit.completed_time && (
                              <div className="text-right text-sm text-muted-foreground">
                                <p>Checked out</p>
                                <p className="font-medium">{formatDateTime(visit.completed_time)}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Patient Dialog - Same as before */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-[#0d7377]" />
                Edit Patient Data
              </DialogTitle>
              <DialogDescription>
                Update patient information. Fields from instant registration are highlighted.
              </DialogDescription>
            </DialogHeader>

            {editingPatient && (
              <Tabs defaultValue="personal" className="flex-1 overflow-hidden">
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="personal">Personal</TabsTrigger>
                  <TabsTrigger value="family">Family</TabsTrigger>
                  <TabsTrigger value="address">Address</TabsTrigger>
                  <TabsTrigger value="substance">Substance</TabsTrigger>
                  <TabsTrigger value="medical">Medical</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 h-[50vh] mt-4">
                  {/* Personal Tab */}
                  <TabsContent value="personal" className="space-y-4 pr-4">
                    <div className="p-4 rounded-lg border-2 border-[#0d7377]/30 bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
                      <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#0d7377]" />
                        Registration Details
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>File Number</Label>
                          <Input value={editingPatient.registration_number} onChange={(e) => handleEditChange('registration_number', e.target.value)} className="font-mono" />
                        </div>
                        <div>
                          <Label>HDAMS ID</Label>
                          <Input value={editingPatient.hdams_id || ''} onChange={(e) => handleEditChange('hdams_id', e.target.value)} className="font-mono" />
                        </div>
                        <div>
                          <Label>Full Name</Label>
                          <Input value={editingPatient.full_name} onChange={(e) => handleEditChange('full_name', e.target.value)} />
                        </div>
                        <div>
                          <Label>Aadhaar Number</Label>
                          <Input value={editingPatient.aadhaar_number || ''} onChange={(e) => handleEditChange('aadhaar_number', e.target.value)} className="font-mono" />
                        </div>
                        <div>
                          <Label>Date of Birth</Label>
                          <Input type="date" value={editingPatient.date_of_birth} onChange={(e) => handleEditChange('date_of_birth', e.target.value)} />
                        </div>
                        <div>
                          <Label>Mobile Number</Label>
                          <Input value={editingPatient.phone} onChange={(e) => handleEditChange('phone', e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Gender</Label>
                        <Select value={editingPatient.gender} onValueChange={(v) => handleEditChange('gender', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Blood Group</Label>
                        <Select value={editingPatient.blood_group || ''} onValueChange={(v) => handleEditChange('blood_group', v)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {BLOOD_GROUP_OPTIONS.map((bg) => (<SelectItem key={bg} value={bg}>{bg}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Nationality</Label>
                        <Select value={editingPatient.nationality || ''} onValueChange={(v) => handleEditChange('nationality', v)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {NATIONALITY_OPTIONS.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Religion</Label>
                        <Select value={editingPatient.religion || ''} onValueChange={(v) => handleEditChange('religion', v)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {RELIGION_OPTIONS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Education</Label>
                        <Select value={editingPatient.education || ''} onValueChange={(v) => handleEditChange('education', v)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(EDUCATION_LABELS).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Employment Status</Label>
                        <Select value={editingPatient.employment_status || ''} onValueChange={(v) => handleEditChange('employment_status', v)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Occupation</Label>
                        <Input value={editingPatient.occupation || ''} onChange={(e) => handleEditChange('occupation', e.target.value)} />
                      </div>
                      <div>
                        <Label>Monthly Income</Label>
                        <Input value={editingPatient.monthly_income || ''} onChange={(e) => handleEditChange('monthly_income', e.target.value)} />
                      </div>
                      <div>
                        <Label>Marital Status</Label>
                        <Select value={editingPatient.marital_status || ''} onValueChange={(v) => handleEditChange('marital_status', v)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(MARITAL_STATUS_LABELS).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Family Tab */}
                  <TabsContent value="family" className="space-y-4 pr-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Father&apos;s Name</Label><Input value={editingPatient.father_name || ''} onChange={(e) => handleEditChange('father_name', e.target.value)} /></div>
                      <div><Label>Mother&apos;s Name</Label><Input value={editingPatient.mother_name || ''} onChange={(e) => handleEditChange('mother_name', e.target.value)} /></div>
                      <div><Label>Grandfather&apos;s Name</Label><Input value={editingPatient.grandfather_name || ''} onChange={(e) => handleEditChange('grandfather_name', e.target.value)} /></div>
                      <div><Label>Spouse Name</Label><Input value={editingPatient.spouse_name || ''} onChange={(e) => handleEditChange('spouse_name', e.target.value)} /></div>
                      <div><Label>Relative Mobile</Label><Input value={editingPatient.relative_phone || ''} onChange={(e) => handleEditChange('relative_phone', e.target.value)} /></div>
                      <div>
                        <Label>Living Arrangement</Label>
                        <Select value={editingPatient.living_arrangement || ''} onValueChange={(v) => handleEditChange('living_arrangement', v)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(LIVING_ARRANGEMENT_LABELS).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Emergency Contact Name</Label><Input value={editingPatient.emergency_contact_name || ''} onChange={(e) => handleEditChange('emergency_contact_name', e.target.value)} /></div>
                      <div><Label>Emergency Contact Phone</Label><Input value={editingPatient.emergency_contact_phone || ''} onChange={(e) => handleEditChange('emergency_contact_phone', e.target.value)} /></div>
                      <div><Label>Relation</Label><Input value={editingPatient.emergency_contact_relation || ''} onChange={(e) => handleEditChange('emergency_contact_relation', e.target.value)} /></div>
                    </div>
                  </TabsContent>

                  {/* Address Tab */}
                  <TabsContent value="address" className="space-y-4 pr-4">
                    <div><Label>Full Address</Label><Textarea value={editingPatient.address || ''} onChange={(e) => handleEditChange('address', e.target.value)} rows={3} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Block/MC</Label><Input value={editingPatient.block_mc || ''} onChange={(e) => handleEditChange('block_mc', e.target.value)} /></div>
                      <div><Label>City</Label><Input value={editingPatient.city || ''} onChange={(e) => handleEditChange('city', e.target.value)} /></div>
                      <div><Label>District</Label><Input value={editingPatient.district || ''} onChange={(e) => handleEditChange('district', e.target.value)} /></div>
                      <div><Label>State</Label><Input value={editingPatient.state || ''} onChange={(e) => handleEditChange('state', e.target.value)} /></div>
                      <div><Label>Pincode</Label><Input value={editingPatient.pincode || ''} onChange={(e) => handleEditChange('pincode', e.target.value)} /></div>
                    </div>
                  </TabsContent>

                  {/* Substance Tab */}
                  <TabsContent value="substance" className="space-y-4 pr-4">
                    <div>
                      <Label className="mb-3 block">Substances Currently Using</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(SUBSTANCE_TYPE_LABELS).map(([key, label]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={`current-${key}`}
                              checked={editingPatient.substance_used_currently?.includes(key as SubstanceType) || false}
                              onCheckedChange={() => handleSubstanceToggle('substance_used_currently', key as SubstanceType)}
                            />
                            <label htmlFor={`current-${key}`} className="text-sm">{label}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <Label className="mb-3 block">Substances Ever Used</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(SUBSTANCE_TYPE_LABELS).map(([key, label]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={`ever-${key}`}
                              checked={editingPatient.substance_ever_used?.includes(key as SubstanceType) || false}
                              onCheckedChange={() => handleSubstanceToggle('substance_ever_used', key as SubstanceType)}
                            />
                            <label htmlFor={`ever-${key}`} className="text-sm">{label}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="inj-ever" checked={editingPatient.injection_use_ever || false} onCheckedChange={(c) => handleEditChange('injection_use_ever', c)} />
                        <label htmlFor="inj-ever">Injection Use (Ever)</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="inj-current" checked={editingPatient.injection_use_currently || false} onCheckedChange={(c) => handleEditChange('injection_use_currently', c)} />
                        <label htmlFor="inj-current">Injection Use (Currently)</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="syringe" checked={editingPatient.syringe_sharing || false} onCheckedChange={(c) => handleEditChange('syringe_sharing', c)} />
                        <label htmlFor="syringe">Syringe/Needle Sharing</label>
                      </div>
                      <div><Label>Route of Admission</Label><Input value={editingPatient.route_of_admission || ''} onChange={(e) => handleEditChange('route_of_admission', e.target.value)} /></div>
                    </div>
                  </TabsContent>

                  {/* Medical Tab */}
                  <TabsContent value="medical" className="space-y-4 pr-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>STI/STD</Label><Input value={editingPatient.sti_std || ''} onChange={(e) => handleEditChange('sti_std', e.target.value)} /></div>
                      <div className="flex items-center space-x-2 pt-6">
                        <Checkbox id="jaundice" checked={editingPatient.jaundice || false} onCheckedChange={(c) => handleEditChange('jaundice', c)} />
                        <label htmlFor="jaundice">Jaundice</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="sexworker" checked={editingPatient.sex_with_sex_worker || false} onCheckedChange={(c) => handleEditChange('sex_with_sex_worker', c)} />
                        <label htmlFor="sexworker">Sex with Sex Worker</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="hiv" checked={editingPatient.hiv_screening || false} onCheckedChange={(c) => handleEditChange('hiv_screening', c)} />
                        <label htmlFor="hiv">HIV Screening Done</label>
                      </div>
                      {editingPatient.hiv_screening && (
                        <div><Label>HIV Result</Label><Input value={editingPatient.hiv_result || ''} onChange={(e) => handleEditChange('hiv_result', e.target.value)} /></div>
                      )}
                    </div>
                    <Separator />
                    <div><Label>Co-morbid Medical Illness</Label><Textarea value={editingPatient.comorbid_medical_illness || ''} onChange={(e) => handleEditChange('comorbid_medical_illness', e.target.value)} rows={2} /></div>
                    <div><Label>Co-morbid Psychiatric Illness</Label><Textarea value={editingPatient.comorbid_psychiatric_illness || ''} onChange={(e) => handleEditChange('comorbid_psychiatric_illness', e.target.value)} rows={2} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Previous Drug Treatment</Label><Input value={editingPatient.previous_drug_treatment || ''} onChange={(e) => handleEditChange('previous_drug_treatment', e.target.value)} /></div>
                      <div className="flex items-center space-x-2 pt-6">
                        <Checkbox id="hospitalized" checked={editingPatient.ever_hospitalized || false} onCheckedChange={(c) => handleEditChange('ever_hospitalized', c)} />
                        <label htmlFor="hospitalized">Ever Hospitalized for Treatment</label>
                      </div>
                    </div>
                    <div><Label>Allergies</Label><Textarea value={editingPatient.allergies || ''} onChange={(e) => handleEditChange('allergies', e.target.value)} rows={2} /></div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            )}

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}><X className="h-4 w-4 mr-2" />Cancel</Button>
              <Button onClick={handleSavePatient} className="bg-gradient-to-r from-[#0d7377] to-[#14919b]"><Save className="h-4 w-4 mr-2" />Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Patient List View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#0d7377] to-[#14919b] bg-clip-text text-transparent">
            Patient Data
          </h1>
          <p className="text-muted-foreground">
            Click on any patient to view their complete profile and visit history
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {filteredPatients.length} Patients
        </Badge>
      </div>

      {/* Search and Filter */}
      <Card className="border-[#0d7377]/20">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by File No., HDAMS ID, Name, Phone, or Aadhaar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`gap-2 ${showFilters ? 'bg-[#0d7377]/10 border-[#0d7377]' : ''}`}
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="gap-2"
            >
              <ArrowUpDown className="h-4 w-4" />
              {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
            </Button>
            <Button
              onClick={exportToExcel}
              className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm text-muted-foreground">Filter Options</h4>
                <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 h-8">
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
              </div>
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <Label className="text-xs">District</Label>
                  <Select value={filterDistrict} onValueChange={setFilterDistrict}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {uniqueDistricts.map((district) => (
                        <SelectItem key={district} value={district}>{district}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">State</Label>
                  <Select value={filterState} onValueChange={setFilterState}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All States</SelectItem>
                      {uniqueStates.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Addiction Type</Label>
                  <Select value={filterAddictionType} onValueChange={setFilterAddictionType}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="alcohol">Alcohol</SelectItem>
                      <SelectItem value="opioid">Opioid</SelectItem>
                      <SelectItem value="cannabis">Cannabis</SelectItem>
                      <SelectItem value="stimulant">Stimulant</SelectItem>
                      <SelectItem value="sedative">Sedative</SelectItem>
                      <SelectItem value="multiple">Multiple</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Reg. Date From</Label>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Reg. Date To</Label>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Cards Grid */}
      <div className="grid gap-3">
        {filteredPatients.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No patients found</p>
            </CardContent>
          </Card>
        ) : (
          filteredPatients.map((patient) => (
            <Card
              key={patient.id}
              className="cursor-pointer hover:border-[#0d7377]/50 hover:shadow-md transition-all group"
              onClick={() => handleSelectPatient(patient)}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Photo */}
                  {patient.photo_url ? (
                    <Image
                      src={patient.photo_url}
                      alt={patient.full_name}
                      width={50}
                      height={50}
                      className="rounded-full object-cover border-2 border-[#0d7377]/20"
                    />
                  ) : (
                    <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-[#0d7377]/10 to-[#14919b]/10 flex items-center justify-center border-2 border-[#0d7377]/20">
                      <User className="h-6 w-6 text-[#0d7377]" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{patient.full_name}</span>
                      <Badge
                        variant={patient.status === 'active' ? 'default' : 'secondary'}
                        className={patient.status === 'active' ? 'bg-green-100 text-green-700' : ''}
                      >
                        {patient.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="font-mono text-[#0d7377]">{patient.registration_number}</span>
                      <span>{getAge(patient.date_of_birth)} yrs / {patient.gender?.charAt(0).toUpperCase()}</span>
                      <span>{patient.phone}</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-[#0d7377] transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
