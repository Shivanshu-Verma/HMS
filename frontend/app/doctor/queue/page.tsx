'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { store } from '@/lib/demo-store';
import type { Visit, Patient, CounsellorSession } from '@/lib/types';
import { PatientCard } from '@/components/patient-card';
import { RiskBadge } from '@/components/status-badge';
import { Users, Play, MessageSquare } from 'lucide-react';

interface VisitWithDetails extends Visit {
  patient: Patient;
  session?: CounsellorSession;
}

function getWaitTime(time?: string): string {
  if (!time) return 'N/A';
  const diff = Date.now() - new Date(time).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function DoctorQueuePage() {
  const [queue, setQueue] = useState<VisitWithDetails[]>([]);

  useEffect(() => {
    const doctorQueue = store
      .getVisitsByStage('doctor')
      .map((visit) => {
        const patient = store.getPatientById(visit.patient_id);
        const session = store.getSessionByVisit(visit.id);
        return {
          ...visit,
          patient: patient!,
          session,
        };
      })
      .filter((v) => v.patient)
      .sort((a, b) => {
        // Prioritize high-risk patients
        if (a.session?.risk_level === 'high' && b.session?.risk_level !== 'high') return -1;
        if (b.session?.risk_level === 'high' && a.session?.risk_level !== 'high') return 1;
        
        const timeA = a.counsellor_end_time ? new Date(a.counsellor_end_time).getTime() : 0;
        const timeB = b.counsellor_end_time ? new Date(b.counsellor_end_time).getTime() : 0;
        return timeA - timeB;
      });

    setQueue(doctorQueue);
  }, []);

  const handleStartConsultation = (visitId: string) => {
    window.location.href = `/doctor/consultation/${visitId}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Patient Queue</h1>
        <p className="text-muted-foreground">
          {queue.length} patient{queue.length !== 1 ? 's' : ''} waiting for consultation
        </p>
      </div>

      {/* Queue List */}
      <div className="space-y-4">
        {queue.length > 0 ? (
          queue.map((visit, index) => (
            <Card key={visit.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {index + 1}
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{visit.patient.full_name}</h3>
                          {visit.session && (
                            <RiskBadge level={visit.session.risk_level} />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {visit.patient.registration_number} | 
                          {visit.patient.addiction_type} | 
                          Wait: {getWaitTime(visit.counsellor_end_time)}
                        </p>
                      </div>
                      <Button onClick={() => handleStartConsultation(visit.id)}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Consultation
                      </Button>
                    </div>

                    {/* Counsellor Notes Preview */}
                    {visit.session && (
                      <div className="p-3 rounded-lg bg-secondary/50">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Counsellor Notes</span>
                          <span className="text-xs text-muted-foreground">
                            Mood: {visit.session.mood_assessment}/10
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {visit.session.session_notes}
                        </p>
                        {visit.session.recommendations && (
                          <p className="text-sm text-primary mt-2">
                            Recommendation: {visit.session.recommendations}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No patients in queue</p>
                <p className="text-sm">Patients will appear after counselling session</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
