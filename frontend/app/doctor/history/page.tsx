'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { store } from '@/lib/demo-store';
import type { DoctorConsultation, Patient, Prescription } from '@/lib/types';
import { Search, FileText, Calendar, Pill } from 'lucide-react';

interface ConsultationWithDetails extends DoctorConsultation {
  patient: Patient;
  prescriptions: Prescription[];
}

export default function DoctorHistoryPage() {
  const [consultations, setConsultations] = useState<ConsultationWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const allConsultations = store
      .getConsultations()
      .map((consultation) => ({
        ...consultation,
        patient: store.getPatientById(consultation.patient_id)!,
        prescriptions: store.getPrescriptionsByVisit(consultation.visit_id).map((p) => ({
          ...p,
          medicine: store.getMedicineById(p.medicine_id),
        })),
      }))
      .filter((c) => c.patient)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setConsultations(allConsultations);
  }, []);

  const filteredConsultations = consultations.filter((consultation) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      consultation.patient.full_name.toLowerCase().includes(query) ||
      consultation.patient.registration_number.toLowerCase().includes(query) ||
      consultation.diagnosis?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Consultation History</h1>
        <p className="text-muted-foreground">View past consultations and prescriptions</p>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient name, ID, or diagnosis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Consultations List */}
      <div className="space-y-4">
        {filteredConsultations.length > 0 ? (
          filteredConsultations.map((consultation) => (
            <Card key={consultation.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {consultation.patient.full_name}
                    </CardTitle>
                    <CardDescription>
                      {consultation.patient.registration_number}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(consultation.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Diagnosis */}
                  <div>
                    <p className="text-sm font-medium mb-1">Diagnosis</p>
                    <p className="text-sm text-muted-foreground">{consultation.diagnosis}</p>
                  </div>

                  {/* Treatment Plan */}
                  {consultation.treatment_plan && (
                    <div>
                      <p className="text-sm font-medium mb-1">Treatment Plan</p>
                      <p className="text-sm text-muted-foreground">
                        {consultation.treatment_plan}
                      </p>
                    </div>
                  )}

                  {/* Vital Signs */}
                  {consultation.vital_signs && (
                    <div className="flex flex-wrap gap-4 text-sm">
                      {consultation.vital_signs.blood_pressure && (
                        <span>BP: {consultation.vital_signs.blood_pressure}</span>
                      )}
                      {consultation.vital_signs.pulse && (
                        <span>Pulse: {consultation.vital_signs.pulse} bpm</span>
                      )}
                      {consultation.vital_signs.weight && (
                        <span>Weight: {consultation.vital_signs.weight} kg</span>
                      )}
                    </div>
                  )}

                  {/* Prescriptions */}
                  {consultation.prescriptions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Pill className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">Prescriptions</p>
                      </div>
                      <div className="grid gap-2">
                        {consultation.prescriptions.map((p) => (
                          <div
                            key={p.id}
                            className="text-sm p-2 rounded bg-secondary/50"
                          >
                            <span className="font-medium">
                              {p.medicine?.name || 'Unknown Medicine'}
                            </span>
                            <span className="text-muted-foreground">
                              {' '}- {p.dosage}, {p.frequency.replace('_', ' ')}, {p.duration_days} days
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next Visit */}
                  {consultation.next_visit_date && (
                    <p className="text-sm text-primary">
                      Next visit: {new Date(consultation.next_visit_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No consultations found</p>
                <p className="text-sm">
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Consultations will appear here after completion'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
