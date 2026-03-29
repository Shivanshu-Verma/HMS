'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { doctorApi } from '@/lib/api-client';
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
  const router = useRouter();
  const [queue, setQueue] = useState<VisitWithDetails[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await doctorApi.getQueue();
        if (result.success && result.data?.items) {
          const mapped = result.data.items.map((v: any) => ({
            id: v.id,
            patient_id: v.patient_id,
            visit_date: v.visit_date?.split('T')[0] || '',
            visit_number: v.visit_number,
            current_stage: v.current_stage,
            checkin_time: v.checkin_time,
            counsellor_end_time: v.counsellor_end_time,
            status: v.status,
            patient: v.patient || { id: v.patient_id, full_name: 'Unknown', registration_number: '', phone: '', gender: '', date_of_birth: '', addiction_type: '' },
            session: v.counsellor_stage ? {
              risk_level: v.counsellor_stage.risk_level,
              session_notes: v.counsellor_stage.session_notes,
              mood_assessment: v.counsellor_stage.mood_assessment,
              recommendations: v.counsellor_stage.recommendations,
            } : undefined,
          }));
          setQueue(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch queue:', err);
      }
    };
    fetchData();
  }, []);

  const handleStartConsultation = (visitId: string) => {
    router.push(`/doctor/consultation/${visitId}`);
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
