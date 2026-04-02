'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { store, generateId } from '@/lib/demo-store';
import { useAuth } from '@/lib/auth-context';
import type { Visit, Patient, CounsellorSession, DoctorConsultation, Medicine, Prescription, Frequency, VitalSigns } from '@/lib/types';
import { PatientCard } from '@/components/patient-card';
import { RiskBadge } from '@/components/status-badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Stethoscope,
  Pill,
  FileText,
  Heart,
  Plus,
  Trash2,
  Send,
  Loader2,
} from 'lucide-react';
import { navigate } from '@/lib/navigation';

interface PrescriptionItem {
  medicine_id: string;
  medicine_name: string;
  quantity: number;
  dosage: string;
  frequency: Frequency;
  duration_days: number;
  instructions: string;
}

export default function ConsultationPage({ params }: { params: Promise<{ visitId: string }> }) {
  const [visitId, setVisitId] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);
  const { user } = useAuth();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [session, setSession] = useState<CounsellorSession | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    diagnosis: '',
    treatment_plan: '',
    clinical_notes: '',
    next_visit_date: '',
  });

  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({
    blood_pressure: '',
    pulse: undefined,
    weight: undefined,
    temperature: undefined,
  });

  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState('');

  // Get params safely after mount
  useEffect(() => {
    setIsMounted(true);
    params.then((p) => setVisitId(p.visitId));
  }, [params]);

  useEffect(() => {
    if (!visitId) return;
    const visitData = store.getVisitById(visitId);
    if (visitData) {
      setVisit(visitData);
      const patientData = store.getPatientById(visitData.patient_id);
      if (patientData) {
        setPatient(patientData);
      }
      const sessionData = store.getSessionByVisit(visitId);
      if (sessionData) {
        setSession(sessionData);
      }

      // Mark consultation start
      store.updateVisit(visitId, {
        doctor_start_time: new Date().toISOString(),
        assigned_doctor_id: user?.id,
      });
    }

    // Load medicines
    setMedicines(store.getMedicines().filter((m) => m.is_active && m.stock_quantity > 0));
  }, [visitId, user]);

  const handleAddPrescription = () => {
    if (!selectedMedicine) {
      toast.error('Please select a medicine');
      return;
    }

    const medicine = medicines.find((m) => m.id === selectedMedicine);
    if (!medicine) return;

    // Check if already added
    if (prescriptions.some((p) => p.medicine_id === selectedMedicine)) {
      toast.error('Medicine already added to prescription');
      return;
    }

    setPrescriptions([
      ...prescriptions,
      {
        medicine_id: medicine.id,
        medicine_name: medicine.name,
        quantity: 10,
        dosage: medicine.unit === 'tablet' ? '1 tablet' : '5ml',
        frequency: 'twice_daily',
        duration_days: 7,
        instructions: '',
      },
    ]);

    setSelectedMedicine('');
  };

  const handleRemovePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const handlePrescriptionChange = (
    index: number,
    field: keyof PrescriptionItem,
    value: string | number
  ) => {
    const updated = [...prescriptions];
    updated[index] = { ...updated[index], [field]: value };
    setPrescriptions(updated);
  };

  const handleSubmit = async () => {
    if (!formData.diagnosis.trim()) {
      toast.error('Please enter a diagnosis');
      return;
    }

    if (!visit || !patient || !user) return;

    setIsSubmitting(true);

    // Create consultation record
    const consultation: DoctorConsultation = {
      id: generateId(),
      visit_id: visit.id,
      patient_id: patient.id,
      doctor_id: user.id,
      diagnosis: formData.diagnosis,
      treatment_plan: formData.treatment_plan || undefined,
      clinical_notes: formData.clinical_notes || undefined,
      vital_signs: vitalSigns.blood_pressure ? vitalSigns : undefined,
      next_visit_date: formData.next_visit_date || undefined,
      created_at: new Date().toISOString(),
    };

    store.addConsultation(consultation);

    // Create prescription records
    prescriptions.forEach((p) => {
      const prescription: Prescription = {
        id: generateId(),
        consultation_id: consultation.id,
        visit_id: visit.id,
        patient_id: patient.id,
        medicine_id: p.medicine_id,
        quantity: p.quantity,
        dosage: p.dosage,
        frequency: p.frequency,
        duration_days: p.duration_days,
        instructions: p.instructions || undefined,
        dispensed: false,
      };
      store.addPrescription(prescription);
    });

    // Update visit to move to pharmacy stage
    store.updateVisit(visit.id, {
      current_stage: 'pharmacy',
      doctor_end_time: new Date().toISOString(),
    });

    toast.success('Consultation completed! Patient moved to pharmacy.');
    window.location.href = '/doctor';
  };

  if (!visit || !patient) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const frequencyLabels: Record<Frequency, string> = {
    once_daily: 'Once Daily',
    twice_daily: 'Twice Daily',
    thrice_daily: 'Three Times Daily',
    as_needed: 'As Needed',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
<Button variant="ghost" size="icon" onClick={() => navigate('/doctor/queue')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Medical Consultation</h1>
          <p className="text-muted-foreground">Consultation with {patient.full_name}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Consultation Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vital Signs */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Vital Signs</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <Label htmlFor="bp">Blood Pressure</Label>
                  <Input
                    id="bp"
                    value={vitalSigns.blood_pressure}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, blood_pressure: e.target.value })
                    }
                    placeholder="120/80"
                  />
                </div>
                <div>
                  <Label htmlFor="pulse">Pulse (bpm)</Label>
                  <Input
                    id="pulse"
                    type="number"
                    value={vitalSigns.pulse || ''}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, pulse: parseInt(e.target.value) || undefined })
                    }
                    placeholder="72"
                  />
                </div>
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    value={vitalSigns.weight || ''}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, weight: parseFloat(e.target.value) || undefined })
                    }
                    placeholder="70"
                  />
                </div>
                <div>
                  <Label htmlFor="temp">Temperature (F)</Label>
                  <Input
                    id="temp"
                    type="number"
                    step="0.1"
                    value={vitalSigns.temperature || ''}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, temperature: parseFloat(e.target.value) || undefined })
                    }
                    placeholder="98.6"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Diagnosis & Treatment */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Diagnosis & Treatment</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="diagnosis">
                  Diagnosis <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="diagnosis"
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  placeholder="Enter diagnosis..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="treatment_plan">Treatment Plan</Label>
                <Textarea
                  id="treatment_plan"
                  value={formData.treatment_plan}
                  onChange={(e) => setFormData({ ...formData, treatment_plan: e.target.value })}
                  placeholder="Enter treatment plan..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="clinical_notes">Clinical Notes</Label>
                <Textarea
                  id="clinical_notes"
                  value={formData.clinical_notes}
                  onChange={(e) => setFormData({ ...formData, clinical_notes: e.target.value })}
                  placeholder="Additional clinical observations..."
                  rows={2}
                />
              </div>

              <div className="max-w-xs">
                <Label htmlFor="next_visit">Next Visit Date</Label>
                <Input
                  id="next_visit"
                  type="date"
                  value={formData.next_visit_date}
                  onChange={(e) => setFormData({ ...formData, next_visit_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </CardContent>
          </Card>

          {/* Prescription */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Prescription</CardTitle>
              </div>
              <CardDescription>Add medicines to the prescription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Medicine */}
              <div className="flex gap-2">
                <Select value={selectedMedicine} onValueChange={setSelectedMedicine}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select medicine to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {medicines.map((med) => (
                      <SelectItem key={med.id} value={med.id}>
                        {med.name} ({med.stock_quantity} in stock)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={handleAddPrescription}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              {/* Prescription Table */}
              {prescriptions.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Dosage</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prescriptions.map((p, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{p.medicine_name}</TableCell>
                          <TableCell>
                            <Input
                              value={p.dosage}
                              onChange={(e) =>
                                handlePrescriptionChange(index, 'dosage', e.target.value)
                              }
                              className="h-8 w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={p.frequency}
                              onValueChange={(v) =>
                                handlePrescriptionChange(index, 'frequency', v)
                              }
                            >
                              <SelectTrigger className="h-8 w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(frequencyLabels).map(([val, label]) => (
                                  <SelectItem key={val} value={val}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={p.duration_days}
                              onChange={(e) =>
                                handlePrescriptionChange(
                                  index,
                                  'duration_days',
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="h-8 w-16"
                              min={1}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={p.quantity}
                              onChange={(e) =>
                                handlePrescriptionChange(
                                  index,
                                  'quantity',
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="h-8 w-16"
                              min={1}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemovePrescription(index)}
                              className="h-8 w-8 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {prescriptions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No medicines added yet. Select a medicine above to add.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
<Button variant="outline" onClick={() => navigate('/doctor/queue')}>
                      Cancel
                    </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Complete & Send to Pharmacy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Patient Info */}
          <PatientCard patient={patient} showStage={false} />

          {/* Counsellor Session Notes */}
          {session && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Counsellor Notes</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Risk Level</span>
                  <RiskBadge level={session.risk_level} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mood Assessment</span>
                  <span className="font-medium">{session.mood_assessment}/10</span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground mb-1">Session Notes</p>
                  <p>{session.session_notes}</p>
                </div>
                {session.recommendations && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground mb-1">Recommendations</p>
                    <p className="text-primary">{session.recommendations}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Patient Medical Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Medical Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Addiction Type</span>
                <span className="capitalize font-medium">{patient.addiction_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{patient.addiction_duration || 'N/A'}</span>
              </div>
              {patient.allergies && (
                <div className="pt-2 border-t">
                  <span className="text-destructive font-medium">
                    Allergies: {patient.allergies}
                  </span>
                </div>
              )}
              {patient.medical_history && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground block mb-1">Medical History</span>
                  <span>{patient.medical_history}</span>
                </div>
              )}
              {patient.current_medications && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground block mb-1">Current Medications</span>
                  <span>{patient.current_medications}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
