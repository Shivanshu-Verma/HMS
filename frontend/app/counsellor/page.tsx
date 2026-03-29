'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { consultantApi } from '@/lib/api-client';
import type { Visit, Patient } from '@/lib/types';
import { PatientQueueItem } from '@/components/patient-card';
import { useRouter } from 'next/navigation';
import {
  Users,
  ClipboardList,
  Clock,
  CheckCircle,
  ArrowRight,
  FileText,
} from 'lucide-react';

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

export default function CounsellorDashboard() {
  const router = useRouter();
  const [queue, setQueue] = useState<VisitWithPatient[]>([]);
  const [todayCompleted, setTodayCompleted] = useState(0);

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
        <h1 className="text-2xl font-bold text-foreground">Counsellor Dashboard</h1>
        <p className="text-muted-foreground">Manage patient counselling sessions</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queue.length}</p>
                <p className="text-sm text-muted-foreground">Waiting Patients</p>
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
                <p className="text-2xl font-bold">{todayCompleted}</p>
                <p className="text-sm text-muted-foreground">Sessions Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {queue.length > 0 ? getWaitTime(queue[0].checkin_time) : '0m'}
                </p>
                <p className="text-sm text-muted-foreground">Longest Wait</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Patient Queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Patient Queue</CardTitle>
                <CardDescription>Patients waiting for counselling</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/counsellor/queue">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {queue.length > 0 ? (
                queue.slice(0, 5).map((visit) => (
                  <PatientQueueItem
                    key={visit.id}
                    patient={visit.patient}
                    visit={visit}
                    waitTime={getWaitTime(visit.checkin_time)}
                    onClick={() => handleStartSession(visit.id)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No patients waiting</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and navigation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              asChild
              variant="outline"
              className="w-full justify-start h-auto py-4"
            >
              <Link href="/counsellor/queue">
                <ClipboardList className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">View Full Queue</p>
                  <p className="text-sm text-muted-foreground">
                    See all waiting patients
                  </p>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full justify-start h-auto py-4"
            >
              <Link href="/counsellor/history">
                <FileText className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Session History</p>
                  <p className="text-sm text-muted-foreground">
                    View past counselling records
                  </p>
                </div>
              </Link>
            </Button>

            {queue.length > 0 && (
              <Button
                className="w-full justify-start h-auto py-4"
                onClick={() => handleStartSession(queue[0].id)}
              >
                <Users className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Start Next Session</p>
                  <p className="text-sm text-primary-foreground/80">
                    {queue[0].patient.full_name}
                  </p>
                </div>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
