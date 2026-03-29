'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { consultantApi } from '@/lib/api-client';
import type { Visit, Patient } from '@/lib/types';
import { PatientCard } from '@/components/patient-card';
import { Users, Play } from 'lucide-react';

interface VisitWithPatient extends Visit {
  patient: Patient;
}

function getWaitTime(checkinTime?: string): string {
  if (!checkinTime) return 'N/A';
  const diff = Date.now() - new Date(checkinTime).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function CounsellorQueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<VisitWithPatient[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await consultantApi.getQueue();
        if (result.success && result.data?.items) {
          const mapped = result.data.items.map((v: any) => ({
            id: v.id,
            patient_id: v.patient_id,
            visit_date: v.visit_date?.split('T')[0] || '',
            visit_number: v.visit_number,
            current_stage: v.current_stage,
            checkin_time: v.checkin_time,
            status: v.status,
            patient: v.patient || { id: v.patient_id, full_name: 'Unknown', registration_number: '', phone: '', gender: '', date_of_birth: '' },
          }));
          setQueue(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch queue:', err);
      }
    };
    fetchData();
  }, []);

  const handleStartSession = (visitId: string) => {
    router.push(`/counsellor/session/${visitId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Patient Queue</h1>
        <p className="text-muted-foreground">
          {queue.length} patient{queue.length !== 1 ? 's' : ''} waiting for counselling
        </p>
      </div>

      {/* Queue List */}
      <div className="space-y-4">
        {queue.length > 0 ? (
          queue.map((visit, index) => (
            <Card key={visit.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <PatientCard
                        patient={visit.patient}
                        visit={visit}
                        showStage={false}
                        waitTime={getWaitTime(visit.checkin_time)}
                      />
                    </div>
                  </div>
                  <Button onClick={() => handleStartSession(visit.id)}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Session
                  </Button>
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
                <p className="text-sm">Patients will appear here after check-in</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
