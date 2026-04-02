'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { store } from '@/lib/demo-store';
import { getCounsellorFollowup, updatePatientStatus } from '@/lib/hms-api';
import { useAuth } from '@/lib/auth-context';
import { useDemoData } from '@/lib/runtime-mode';
import type { Patient, Visit, CounsellorSession } from '@/lib/types';
import {
  PATIENT_CATEGORY_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  EDUCATION_LABELS,
  MARITAL_STATUS_LABELS,
  LIVING_ARRANGEMENT_LABELS,
  SUBSTANCE_TYPE_LABELS,
  BLOOD_GROUP_OPTIONS,
} from '@/lib/types';
import type { SubstanceType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search,
  User,
  Phone,
  MapPin,
  Calendar,
  ArrowLeft,
  Clock,
  FileText,
  Brain,
  Heart,
  Syringe,
  HeartPulse,
  ChevronRight,
  Users,
  GraduationCap,
  Briefcase,
  Home,
  Edit,
  Save,
} from 'lucide-react';

interface SessionWithVisit extends CounsellorSession {
  visit?: Visit;
}

function getAge(dob: string): number {
  if (!dob) return 0;
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function InfoRow({ label, value }: { label: string; value?: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function CounsellorPatientsPage() {
  const { accessToken } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [patientSessions, setPatientSessions] = useState<SessionWithVisit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'psychiatric' | 'deaddiction'>('all');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [followupCount, setFollowupCount] = useState(0);

  useEffect(() => {
    setPatients(store.getPatients());
    if (!useDemoData && accessToken) {
      getCounsellorFollowup(accessToken, 1, 1)
        .then((res) => setFollowupCount(res.pagination.total))
        .catch(() => setFollowupCount(0));
    }
  }, [accessToken]);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        p.full_name.toLowerCase().includes(q) ||
        p.registration_number.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)) ||
        (p.hdams_id && p.hdams_id.toLowerCase().includes(q));
      const matchesCategory =
        filterCategory === 'all' || p.patient_category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [patients, searchQuery, filterCategory]);

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    const visits = store.getVisitsByPatient(patient.id).sort(
      (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
    );
    setPatientVisits(visits);

    const sessions = store
      .getSessions()
      .filter((s) => s.patient_id === patient.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPatientSessions(sessions);
  };

  const handleOpenEdit = () => {
    if (!selectedPatient) return;
    setEditingPatient({ ...selectedPatient });
    setIsEditOpen(true);
  };

  const handleEditChange = (field: keyof Patient, value: unknown) => {
    if (!editingPatient) return;
    setEditingPatient({ ...editingPatient, [field]: value });
  };

  const handleSubstanceToggle = (field: 'substance_used_currently' | 'substance_ever_used', key: SubstanceType) => {
    if (!editingPatient) return;
    const current = editingPatient[field] || [];
    const updated = current.includes(key)
      ? current.filter((s) => s !== key)
      : [...current, key];
    setEditingPatient({ ...editingPatient, [field]: updated });
  };

  const handleSaveEdit = async () => {
    if (!editingPatient) return;

    if (!useDemoData && accessToken && selectedPatient && editingPatient.status !== selectedPatient.status) {
      try {
        await updatePatientStatus(accessToken, editingPatient.id, editingPatient.status as 'active' | 'inactive' | 'dead');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update patient status');
        return;
      }
    }

    const updated = store.updatePatient(editingPatient.id, editingPatient);
    if (updated) {
      setSelectedPatient(editingPatient);
      setPatients(store.getPatients());
      setIsEditOpen(false);
      toast.success('Patient record updated successfully');
    }
  };

  // ── Patient List View ──────────────────────────────────────────────────────
  if (!selectedPatient) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Patient Data</h1>
          <p className="text-muted-foreground">View complete patient profiles and session history</p>
        </div>

        {/* Search & Filter */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, file no., HDAMS ID or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'psychiatric', 'deaddiction'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors border ${
                      filterCategory === cat
                        ? cat === 'psychiatric'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : cat === 'deaddiction'
                          ? 'bg-[#0d7377] text-white border-[#0d7377]'
                          : 'bg-foreground text-background border-foreground'
                        : 'bg-background text-muted-foreground border-border hover:border-foreground'
                    }`}
                  >
                    {cat === 'all' ? 'All' : PATIENT_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{patients.length}</p>
                <p className="text-xs text-muted-foreground">Total Patients</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {patients.filter((p) => p.patient_category === 'psychiatric').length}
                </p>
                <p className="text-xs text-muted-foreground">Psychiatric</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0d7377]/10">
                <Heart className="h-5 w-5 text-[#0d7377]" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {patients.filter((p) => p.patient_category === 'deaddiction').length}
                </p>
                <p className="text-xs text-muted-foreground">De-Addiction</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{followupCount}</p>
                <p className="text-xs text-muted-foreground">Overdue Follow-up</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Patient Cards */}
        <div className="grid gap-3">
          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => {
              const isPsychiatric = patient.patient_category === 'psychiatric';
              return (
                <button
                  key={patient.id}
                  onClick={() => handleSelectPatient(patient)}
                  className="w-full text-left"
                >
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary">
                              {patient.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          {/* Info */}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{patient.full_name}</p>
                              <Badge
                                variant="secondary"
                                className={`text-xs ${
                                  isPsychiatric
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-teal-100 text-teal-700'
                                }`}
                              >
                                {isPsychiatric ? (
                                  <Brain className="h-3 w-3 mr-1" />
                                ) : (
                                  <Heart className="h-3 w-3 mr-1" />
                                )}
                                {patient.patient_category
                                  ? PATIENT_CATEGORY_LABELS[patient.patient_category]
                                  : 'N/A'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                              <span>File: {patient.registration_number}</span>
                              {patient.hdams_id && <span>HDAMS: {patient.hdams_id}</span>}
                              {patient.date_of_birth && (
                                <span>{getAge(patient.date_of_birth)} yrs</span>
                              )}
                              {patient.gender && (
                                <span className="capitalize">{patient.gender}</span>
                              )}
                              {patient.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {patient.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No patients found</p>
                <p className="text-sm">Try adjusting your search or filter</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ── Patient Profile View ───────────────────────────────────────────────────
  const isPsychiatric = selectedPatient.patient_category === 'psychiatric';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedPatient(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to patients
        </button>
        <Button onClick={handleOpenEdit} className="gap-2">
          <Edit className="h-4 w-4" />
          Edit Patient
        </Button>
      </div>

      {/* Patient Header Card */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className={`h-1.5 ${isPsychiatric ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-gradient-to-r from-[#0d7377] to-[#14919b]'}`} />
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-xl ${isPsychiatric ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-[#0d7377] to-[#14919b]'}`}>
              {selectedPatient.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold">{selectedPatient.full_name}</h2>
                <Badge className={isPsychiatric ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}>
                  {isPsychiatric ? <Brain className="h-3 w-3 mr-1" /> : <Heart className="h-3 w-3 mr-1" />}
                  {selectedPatient.patient_category ? PATIENT_CATEGORY_LABELS[selectedPatient.patient_category] : 'N/A'}
                </Badge>
                <Badge variant={selectedPatient.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                  {selectedPatient.status || 'active'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                <span>File No: <strong className="text-foreground">{selectedPatient.registration_number}</strong></span>
                {selectedPatient.hdams_id && <span>HDAMS: <strong className="text-foreground">{selectedPatient.hdams_id}</strong></span>}
                {selectedPatient.date_of_birth && <span>Age: <strong className="text-foreground">{getAge(selectedPatient.date_of_birth)} yrs</strong></span>}
                {selectedPatient.gender && <span className="capitalize">Gender: <strong className="text-foreground capitalize">{selectedPatient.gender}</strong></span>}
                {selectedPatient.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <strong className="text-foreground">{selectedPatient.phone}</strong>
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Reg. Date</p>
              <p className="font-semibold text-foreground">{formatDate(selectedPatient.registration_date || selectedPatient.created_at)}</p>
              <p className="mt-2">Total Sessions</p>
              <p className="font-semibold text-foreground">{patientSessions.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Full Profile</TabsTrigger>
          <TabsTrigger value="sessions">Session History ({patientSessions.length})</TabsTrigger>
          <TabsTrigger value="visits">Visit History ({patientVisits.length})</TabsTrigger>
        </TabsList>

        {/* ── Full Profile ── */}
        <TabsContent value="profile" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Personal Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-0">
                <InfoRow label="Full Name" value={selectedPatient.full_name} />
                <InfoRow label="Date of Birth" value={selectedPatient.date_of_birth ? formatDate(selectedPatient.date_of_birth) : undefined} />
                <InfoRow label="Age" value={selectedPatient.date_of_birth ? `${getAge(selectedPatient.date_of_birth)} years` : undefined} />
                <InfoRow label="Gender" value={selectedPatient.gender} />
                <InfoRow label="Blood Group" value={selectedPatient.blood_group} />
                <InfoRow label="Aadhaar No." value={selectedPatient.aadhaar_number} />
                <InfoRow label="Nationality" value={selectedPatient.nationality} />
                <InfoRow label="Religion" value={selectedPatient.religion} />
              </CardContent>
            </Card>

            {/* Family Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Family Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-0">
                <InfoRow label="Father Name" value={selectedPatient.father_name} />
                <InfoRow label="Mother Name" value={selectedPatient.mother_name} />
                <InfoRow label="Grandfather" value={selectedPatient.grandfather_name} />
                <InfoRow label="Spouse Name" value={selectedPatient.spouse_name} />
                <InfoRow label="Marital Status" value={selectedPatient.marital_status ? MARITAL_STATUS_LABELS[selectedPatient.marital_status] : undefined} />
                <InfoRow label="Living Arrangement" value={selectedPatient.living_arrangement ? LIVING_ARRANGEMENT_LABELS[selectedPatient.living_arrangement] : undefined} />
                <InfoRow label="Monthly Income" value={selectedPatient.monthly_income} />
              </CardContent>
            </Card>

            {/* Contact & Address */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Address & Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-0">
                <InfoRow label="Phone" value={selectedPatient.phone} />
                <InfoRow label="Relative Phone" value={selectedPatient.relative_phone || selectedPatient.emergency_contact_phone} />
                <InfoRow label="Address" value={selectedPatient.address} />
                <InfoRow label="Block/MC" value={selectedPatient.block_mc} />
                <InfoRow label="City" value={selectedPatient.city} />
                <InfoRow label="District" value={selectedPatient.district} />
                <InfoRow label="State" value={selectedPatient.state} />
              </CardContent>
            </Card>

            {/* Education & Employment */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" /> Education & Employment
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-0">
                <InfoRow label="Education" value={selectedPatient.education ? EDUCATION_LABELS[selectedPatient.education] : undefined} />
                <InfoRow label="Occupation" value={selectedPatient.occupation} />
                <InfoRow label="Employment Status" value={selectedPatient.employment_status ? EMPLOYMENT_STATUS_LABELS[selectedPatient.employment_status] : undefined} />
              </CardContent>
            </Card>

            {/* Substance Use */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Syringe className="h-4 w-4 text-primary" /> Substance Use
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {selectedPatient.substance_used_currently && selectedPatient.substance_used_currently.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Currently Using</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPatient.substance_used_currently.map((s) => (
                        <Badge key={s} variant="destructive" className="text-xs">{SUBSTANCE_TYPE_LABELS[s]}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedPatient.substance_ever_used && selectedPatient.substance_ever_used.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ever Used</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPatient.substance_ever_used.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{SUBSTANCE_TYPE_LABELS[s]}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <InfoRow label="Injection (Ever)" value={selectedPatient.injection_use_ever ? 'Yes' : selectedPatient.injection_use_ever === false ? 'No' : undefined} />
                <InfoRow label="Injection (Current)" value={selectedPatient.injection_use_currently ? 'Yes' : selectedPatient.injection_use_currently === false ? 'No' : undefined} />
                <InfoRow label="Syringe Sharing" value={selectedPatient.syringe_sharing ? 'Yes' : selectedPatient.syringe_sharing === false ? 'No' : undefined} />
              </CardContent>
            </Card>

            {/* Medical History */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-primary" /> Medical History
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-0">
                <InfoRow label="STI/STD" value={selectedPatient.sti_std} />
                <InfoRow label="Jaundice" value={selectedPatient.jaundice ? 'Yes' : selectedPatient.jaundice === false ? 'No' : undefined} />
                <InfoRow label="HIV Screening" value={selectedPatient.hiv_screening ? 'Yes' : selectedPatient.hiv_screening === false ? 'No' : undefined} />
                {selectedPatient.hiv_screening && <InfoRow label="HIV Result" value={selectedPatient.hiv_result} />}
                <InfoRow label="Co-morbid Medical" value={selectedPatient.comorbid_medical_illness} />
                <InfoRow label="Co-morbid Psychiatric" value={selectedPatient.comorbid_psychiatric_illness} />
                <InfoRow label="Previous Treatment" value={selectedPatient.previous_drug_treatment || selectedPatient.previous_treatments} />
                <InfoRow label="Ever Hospitalized" value={selectedPatient.ever_hospitalized ? 'Yes' : selectedPatient.ever_hospitalized === false ? 'No' : undefined} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Session History ── */}
        <TabsContent value="sessions" className="space-y-4">
          {patientSessions.length > 0 ? (
            patientSessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">Counselling Session</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(session.created_at)}
                        {session.session_duration_minutes && (
                          <span className="ml-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.session_duration_minutes} min
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {session.mood_assessment !== undefined && (
                        <Badge variant="outline">Mood: {session.mood_assessment}/10</Badge>
                      )}
                      {session.risk_level && (
                        <Badge
                          className={
                            session.risk_level === 'high'
                              ? 'bg-red-100 text-red-700'
                              : session.risk_level === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }
                        >
                          {session.risk_level} risk
                        </Badge>
                      )}
                    </div>
                  </div>
                  {session.session_notes && (
                    <div className="p-3 rounded-lg bg-secondary/50 text-sm mb-2">
                      {session.session_notes}
                    </div>
                  )}
                  {session.recommendations && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Recommendations</p>
                      <p className="text-sm">{session.recommendations}</p>
                    </div>
                  )}
                  {session.follow_up_required && (
                    <p className="text-xs text-primary mt-2 font-medium">Follow-up required</p>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No sessions recorded</p>
                <p className="text-sm">Session history will appear here after counselling</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Visit History ── */}
        <TabsContent value="visits" className="space-y-3">
          {patientVisits.length > 0 ? (
            patientVisits.map((visit, index) => (
              <Card key={visit.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {patientVisits.length - index}
                      </div>
                      <div>
                        <p className="font-medium">{formatDate(visit.visit_date)}</p>
                        <p className="text-xs text-muted-foreground">
                          Stage: <span className="capitalize">{visit.current_stage}</span>
                          {visit.checkin_time && (
                            <span className="ml-2">
                              Check-in: {new Date(visit.checkin_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={visit.status === 'completed' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {visit.status?.replace('_', ' ') || 'In Progress'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No visit records</p>
                <p className="text-sm">Visit history will appear here after check-in</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Patient Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient Record</DialogTitle>
          </DialogHeader>
          {editingPatient && (
            <div className="space-y-6 py-2">
              {/* Personal */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Personal Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Full Name</Label><Input value={editingPatient.full_name} onChange={(e) => handleEditChange('full_name', e.target.value)} /></div>
                  <div><Label>Date of Birth</Label><Input type="date" value={editingPatient.date_of_birth || ''} onChange={(e) => handleEditChange('date_of_birth', e.target.value)} /></div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={editingPatient.gender || ''} onValueChange={(v) => handleEditChange('gender', v)}>
                      <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
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
                      <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                      <SelectContent>
                        {BLOOD_GROUP_OPTIONS.map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Phone</Label><Input value={editingPatient.phone || ''} onChange={(e) => handleEditChange('phone', e.target.value)} /></div>
                  <div><Label>Relative Phone</Label><Input value={editingPatient.relative_phone || ''} onChange={(e) => handleEditChange('relative_phone', e.target.value)} /></div>
                  <div><Label>Nationality</Label><Input value={editingPatient.nationality || ''} onChange={(e) => handleEditChange('nationality', e.target.value)} /></div>
                  <div><Label>Religion</Label><Input value={editingPatient.religion || ''} onChange={(e) => handleEditChange('religion', e.target.value)} /></div>
                  <div><Label>Occupation</Label><Input value={editingPatient.occupation || ''} onChange={(e) => handleEditChange('occupation', e.target.value)} /></div>
                  <div><Label>Monthly Income</Label><Input value={editingPatient.monthly_income || ''} onChange={(e) => handleEditChange('monthly_income', e.target.value)} /></div>
                  <div>
                    <Label>Education</Label>
                    <Select value={editingPatient.education || ''} onValueChange={(v) => handleEditChange('education', v)}>
                      <SelectTrigger><SelectValue placeholder="Select education" /></SelectTrigger>
                      <SelectContent>{Object.entries(EDUCATION_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Employment Status</Label>
                    <Select value={editingPatient.employment_status || ''} onValueChange={(v) => handleEditChange('employment_status', v)}>
                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>{Object.entries(EMPLOYMENT_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Marital Status</Label>
                    <Select value={editingPatient.marital_status || ''} onValueChange={(v) => handleEditChange('marital_status', v)}>
                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>{Object.entries(MARITAL_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Living Arrangement</Label>
                    <Select value={editingPatient.living_arrangement || ''} onValueChange={(v) => handleEditChange('living_arrangement', v)}>
                      <SelectTrigger><SelectValue placeholder="Select arrangement" /></SelectTrigger>
                      <SelectContent>{Object.entries(LIVING_ARRANGEMENT_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Family */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Family Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Father&apos;s Name</Label><Input value={editingPatient.father_name || ''} onChange={(e) => handleEditChange('father_name', e.target.value)} /></div>
                  <div><Label>Mother&apos;s Name</Label><Input value={editingPatient.mother_name || ''} onChange={(e) => handleEditChange('mother_name', e.target.value)} /></div>
                  <div><Label>Grandfather&apos;s Name</Label><Input value={editingPatient.grandfather_name || ''} onChange={(e) => handleEditChange('grandfather_name', e.target.value)} /></div>
                  <div><Label>Spouse Name</Label><Input value={editingPatient.spouse_name || ''} onChange={(e) => handleEditChange('spouse_name', e.target.value)} /></div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Address</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Full Address</Label><Textarea value={editingPatient.address || ''} onChange={(e) => handleEditChange('address', e.target.value)} rows={2} /></div>
                  <div><Label>Block / MC</Label><Input value={editingPatient.block_mc || ''} onChange={(e) => handleEditChange('block_mc', e.target.value)} /></div>
                  <div><Label>City</Label><Input value={editingPatient.city || ''} onChange={(e) => handleEditChange('city', e.target.value)} /></div>
                  <div><Label>District</Label><Input value={editingPatient.district || ''} onChange={(e) => handleEditChange('district', e.target.value)} /></div>
                  <div><Label>State</Label><Input value={editingPatient.state || ''} onChange={(e) => handleEditChange('state', e.target.value)} /></div>
                </div>
              </div>

              {/* Substance Use */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Substance Use</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 block">Currently Using</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(SUBSTANCE_TYPE_LABELS).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={editingPatient.substance_used_currently?.includes(key as SubstanceType) || false}
                            onCheckedChange={() => handleSubstanceToggle('substance_used_currently', key as SubstanceType)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Ever Used</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(SUBSTANCE_TYPE_LABELS).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={editingPatient.substance_ever_used?.includes(key as SubstanceType) || false}
                            onCheckedChange={() => handleSubstanceToggle('substance_ever_used', key as SubstanceType)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={editingPatient.injection_use_ever || false} onCheckedChange={(c) => handleEditChange('injection_use_ever', c)} />
                    Injection Use (Ever)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={editingPatient.injection_use_currently || false} onCheckedChange={(c) => handleEditChange('injection_use_currently', c)} />
                    Injection Use (Current)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={editingPatient.syringe_sharing || false} onCheckedChange={(c) => handleEditChange('syringe_sharing', c)} />
                    Syringe Sharing
                  </label>
                </div>
                <div className="mt-3">
                  <Label>Route of Admission</Label>
                  <Input value={editingPatient.route_of_admission || ''} onChange={(e) => handleEditChange('route_of_admission', e.target.value)} />
                </div>
              </div>

              {/* Medical History */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Medical History</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>STI / STD</Label><Input value={editingPatient.sti_std || ''} onChange={(e) => handleEditChange('sti_std', e.target.value)} /></div>
                  <div><Label>Co-morbid Medical Illness</Label><Input value={editingPatient.comorbid_medical_illness || ''} onChange={(e) => handleEditChange('comorbid_medical_illness', e.target.value)} /></div>
                  <div><Label>Co-morbid Psychiatric Illness</Label><Input value={editingPatient.comorbid_psychiatric_illness || ''} onChange={(e) => handleEditChange('comorbid_psychiatric_illness', e.target.value)} /></div>
                  <div><Label>Previous Treatment for Drug Abuse</Label><Input value={editingPatient.previous_drug_treatment || ''} onChange={(e) => handleEditChange('previous_drug_treatment', e.target.value)} /></div>
                  <div className="col-span-2 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={editingPatient.jaundice || false} onCheckedChange={(c) => handleEditChange('jaundice', c)} />
                      Jaundice
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={editingPatient.sex_with_sex_worker || false} onCheckedChange={(c) => handleEditChange('sex_with_sex_worker', c)} />
                      Sex with Sex Worker
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={editingPatient.hiv_screening || false} onCheckedChange={(c) => handleEditChange('hiv_screening', c)} />
                      HIV Screening Done
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={editingPatient.ever_hospitalized || false} onCheckedChange={(c) => handleEditChange('ever_hospitalized', c)} />
                      Ever Hospitalised
                    </label>
                  </div>
                  {editingPatient.hiv_screening && (
                    <div><Label>HIV Result</Label><Input value={editingPatient.hiv_result || ''} onChange={(e) => handleEditChange('hiv_result', e.target.value)} /></div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} className="gap-2">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
