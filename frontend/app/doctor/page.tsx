'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { doctorApi } from '@/lib/api-client';
import type { Visit, Patient, CounsellorSession } from '@/lib/types';
import { PatientQueueItem } from '@/components/patient-card';
import { RiskBadge } from '@/components/status-badge';
import {
  Users,
  Stethoscope,
  Clock,
  CheckCircle,
  ArrowRight,
  FileText,
  AlertTriangle,
} from 'lucide-react';

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

export default function DoctorDashboard() {
  const router = useRouter();
  const [queue, setQueue] = useState<VisitWithDetails[]>([]);
  const [todayConsultations, setTodayConsultations] = useState(0);
  const [highRiskCount, setHighRiskCount] = useState(0);

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
            patient: v.patient || { id: v.patient_id, full_name: 'Unknown', registration_number: '', phone: '', gender: '', date_of_birth: '' },
            session: v.counsellor_stage ? {
              risk_level: v.counsellor_stage.risk_level,
              session_notes: v.counsellor_stage.session_notes,
              mood_assessment: v.counsellor_stage.mood_assessment,
            } : undefined,
          }));
          setQueue(mapped);
          setHighRiskCount(mapped.filter((v: any) => v.session?.risk_level === 'high').length);
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
        <h1 className="text-2xl font-bold text-foreground">Doctor Dashboard</h1>
        <p className="text-muted-foreground">Manage patient consultations and prescriptions</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
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
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{highRiskCount}</p>
                <p className="text-sm text-muted-foreground">High Risk</p>
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
                <p className="text-2xl font-bold">{todayConsultations}</p>
                <p className="text-sm text-muted-foreground">Today&apos;s Consults</p>
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
                  {queue.length > 0 ? getWaitTime(queue[0].counsellor_end_time) : '0m'}
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
                <CardDescription>
                  Patients referred from counsellor (high risk prioritized)
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/doctor/queue">
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
                  <div
                    key={visit.id}
                    onClick={() => handleStartConsultation(visit.id)}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {visit.patient.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {visit.patient.full_name}
                        </p>
                        {visit.session && (
                          <RiskBadge level={visit.session.risk_level} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {visit.patient.registration_number}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Wait time</p>
                      <p className="text-sm font-medium">
                        {getWaitTime(visit.counsellor_end_time)}
                      </p>
                    </div>
                  </div>
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
              <Link href="/doctor/queue">
                <Stethoscope className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">View Full Queue</p>
                  <p className="text-sm text-muted-foreground">
                    See all waiting patients with details
                  </p>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full justify-start h-auto py-4"
            >
              <Link href="/doctor/history">
                <FileText className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Consultation History</p>
                  <p className="text-sm text-muted-foreground">
                    View past consultations and prescriptions
                  </p>
                </div>
              </Link>
            </Button>

            {queue.length > 0 && (
              <Button
                className="w-full justify-start h-auto py-4"
                onClick={() => handleStartConsultation(queue[0].id)}
              >
                <Users className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Start Next Consultation</p>
                  <p className="text-sm text-primary-foreground/80">
                    {queue[0].patient.full_name}
                    {queue[0].session?.risk_level === 'high' && ' (High Risk)'}
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
