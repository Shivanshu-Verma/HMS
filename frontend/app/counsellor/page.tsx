'use client';

import { useEffect, useState } from 'react';
import { navigate } from '@/lib/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { store } from '@/lib/demo-store';
import { getCounsellorQueue } from '@/lib/hms-api';
import { useAuth } from '@/lib/auth-context';
import { useDemoData } from '@/lib/runtime-mode';
import type { Visit, Patient } from '@/lib/types';
import { PatientQueueItem } from '@/components/patient-card';
import {
  Users,
  ClipboardList,
  Clock,
  CheckCircle,
  ArrowRight,
  FileText,
  TrendingUp,
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
  const { accessToken } = useAuth();
  const [queue, setQueue] = useState<VisitWithPatient[]>([]);
  const [todayCompleted, setTodayCompleted] = useState(0);

  const loadDemoQueue = () => {
    const counsellorQueue = store
      .getVisitsByStage('counsellor')
      .map((visit) => ({
        ...visit,
        patient: store.getPatientById(visit.patient_id)!,
      }))
      .filter((v) => v.patient)
      .sort((a, b) => {
        const timeA = a.checkin_time ? new Date(a.checkin_time).getTime() : 0;
        const timeB = b.checkin_time ? new Date(b.checkin_time).getTime() : 0;
        return timeA - timeB;
      });

    setQueue(counsellorQueue);

    const today = new Date().toISOString().split('T')[0];
    const completed = store
      .getSessions()
      .filter((s) => s.created_at.startsWith(today)).length;
    setTodayCompleted(completed);
  };

  useEffect(() => {
    if (useDemoData || !accessToken) {
      loadDemoQueue();
      return;
    }

    getCounsellorQueue(accessToken)
      .then((res) => {
        const mapped = res.items.map((item, index) => ({
          id: item.session_id,
          patient_id: item.patient_id,
          visit_date: item.checked_in_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          visit_number: index + 1,
          current_stage: 'counsellor' as const,
          checkin_time: item.checked_in_at,
          status: 'in_progress' as const,
          patient: {
            id: item.patient_id,
            registration_number: item.session_id,
            patient_category: 'deaddiction' as const,
            full_name: item.patient_name,
            date_of_birth: '',
            gender: 'other' as const,
            phone: '',
            address: '',
            city: '',
            state: '',
            pincode: '',
            addiction_type: 'other' as const,
            first_visit_date: item.checked_in_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            emergency_contact_name: '',
            emergency_contact_phone: '',
            emergency_contact_relation: '',
            status: 'active' as const,
            created_at: item.checked_in_at || new Date().toISOString(),
            updated_at: item.checked_in_at || new Date().toISOString(),
          },
        }));
        setQueue(mapped);
      })
      .catch(() => loadDemoQueue());

    setTodayCompleted(0);
  }, [accessToken]);

  const handleStartSession = (visitId: string) => {
    window.location.href = `/counsellor/session/${visitId}`;
  };

  const statCards = [
    {
      title: 'Waiting Patients',
      value: queue.length,
      icon: Users,
      gradient: 'from-amber-500 to-amber-600',
    },
    {
      title: 'Sessions Today',
      value: todayCompleted,
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-emerald-600',
      trend: '+12%',
    },
    {
      title: 'Longest Wait',
      value: queue.length > 0 ? getWaitTime(queue[0].checkin_time) : '0m',
      icon: Clock,
      gradient: 'from-sky-500 to-sky-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Counsellor Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage patient counselling sessions</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title} className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
            <div className={`h-1.5 bg-gradient-to-r ${stat.gradient}`} />
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.title}</p>
                </div>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} text-white`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </div>
              {stat.trend && (
                <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600">
                  <TrendingUp className="h-3 w-3" />
                  {stat.trend} from last week
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Patient Queue */}
        <Card className="border-0 shadow-md">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Patient Queue</CardTitle>
                <CardDescription>Patients waiting for counselling</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/counsellor/queue')}>
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {queue.length > 0 ? (
                queue.slice(0, 5).map((visit) => (
                  <div
                    key={visit.id}
                    onClick={() => handleStartSession(visit.id)}
                    className="p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <PatientQueueItem
                      patient={visit.patient}
                      visit={visit}
                      waitTime={getWaitTime(visit.checkin_time)}
                      onClick={() => handleStartSession(visit.id)}
                    />
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No patients waiting</p>
                  <p className="text-sm text-muted-foreground mt-1">Patients will appear here after check-in</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-0 shadow-md">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and navigation</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 hover:bg-primary/5 hover:border-primary/30"
              onClick={() => navigate('/counsellor/queue')}
            >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">View Full Queue</p>
                  <p className="text-sm text-muted-foreground">
                    See all waiting patients
                  </p>
                </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 hover:bg-primary/5 hover:border-primary/30"
              onClick={() => navigate('/counsellor/history')}
            >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mr-3">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Session History</p>
                  <p className="text-sm text-muted-foreground">
                    View past counselling records
                  </p>
                </div>
            </Button>

            {queue.length > 0 && (
              <Button
                className="w-full justify-start h-auto py-4 shadow-md"
                onClick={() => handleStartSession(queue[0].id)}
              >
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mr-3">
                  <Users className="h-5 w-5" />
                </div>
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
