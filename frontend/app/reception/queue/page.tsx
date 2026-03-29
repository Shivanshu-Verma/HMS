'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { visitsApi } from '@/lib/api-client';
import type { Visit, Patient } from '@/lib/types';
import { StageStatus } from '@/components/status-badge';
import { Users, Clock, CheckCircle } from 'lucide-react';

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

export default function QueueStatusPage() {
  const [visits, setVisits] = useState<VisitWithPatient[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await visitsApi.getActive();
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
          setVisits(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch queue:', err);
      }
    };
    fetchData();
  }, []);

  const queueGroups = {
    counsellor: visits.filter((v) => v.current_stage === 'counsellor' && v.status === 'in_progress'),
    doctor: visits.filter((v) => v.current_stage === 'doctor' && v.status === 'in_progress'),
    pharmacy: visits.filter((v) => v.current_stage === 'pharmacy' && v.status === 'in_progress'),
    completed: visits.filter((v) => v.status === 'completed'),
  };

  const QueueList = ({ items }: { items: VisitWithPatient[] }) => (
    <div className="space-y-3">
      {items.length > 0 ? (
        items.map((visit) => (
          <div
            key={visit.id}
            className="flex items-center justify-between p-4 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {visit.patient.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </span>
              </div>
              <div>
                <p className="font-medium">{visit.patient.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {visit.patient.registration_number} | Visit #{visit.visit_number}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {getWaitTime(visit.checkin_time)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Check-in:{' '}
                  {visit.checkin_time
                    ? new Date(visit.checkin_time).toLocaleTimeString()
                    : 'N/A'}
                </p>
              </div>
              <StageStatus stage={visit.current_stage} />
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No patients in this queue</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Queue Status</h1>
        <p className="text-muted-foreground">Monitor patient flow across all stages</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queueGroups.counsellor.length}</p>
                <p className="text-sm text-muted-foreground">At Counsellor</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queueGroups.doctor.length}</p>
                <p className="text-sm text-muted-foreground">At Doctor</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queueGroups.pharmacy.length}</p>
                <p className="text-sm text-muted-foreground">At Pharmacy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queueGroups.completed.length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Queue</CardTitle>
          <CardDescription>View patients at each stage of the process</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="counsellor">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="counsellor">
                Counsellor ({queueGroups.counsellor.length})
              </TabsTrigger>
              <TabsTrigger value="doctor">
                Doctor ({queueGroups.doctor.length})
              </TabsTrigger>
              <TabsTrigger value="pharmacy">
                Pharmacy ({queueGroups.pharmacy.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({queueGroups.completed.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="counsellor" className="mt-4">
              <QueueList items={queueGroups.counsellor} />
            </TabsContent>

            <TabsContent value="doctor" className="mt-4">
              <QueueList items={queueGroups.doctor} />
            </TabsContent>

            <TabsContent value="pharmacy" className="mt-4">
              <QueueList items={queueGroups.pharmacy} />
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
              <QueueList items={queueGroups.completed} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
