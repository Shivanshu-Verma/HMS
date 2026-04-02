'use client';

import { useEffect, useState } from 'react';
import { navigate } from '@/lib/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { store } from '@/lib/demo-store';
import type { Visit, Patient, CounsellorSession } from '@/lib/types';
import { RiskBadge } from '@/components/status-badge';
import {
  Users,
  Stethoscope,
  Clock,
  CheckCircle,
  ArrowRight,
  FileText,
  AlertTriangle,
  TrendingUp,
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
  const [queue, setQueue] = useState<VisitWithDetails[]>([]);
  const [todayConsultations, setTodayConsultations] = useState(0);
  const [highRiskCount, setHighRiskCount] = useState(0);

  useEffect(() => {
    // Get patients in doctor queue
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
    setHighRiskCount(doctorQueue.filter((v) => v.session?.risk_level === 'high').length);

    // Count today's consultations
    const today = new Date().toISOString().split('T')[0];
    const consultations = store
      .getConsultations()
      .filter((c) => c.created_at.startsWith(today)).length;
    setTodayConsultations(consultations);
  }, []);

  const handleStartConsultation = (visitId: string) => {
    window.location.href = `/doctor/consultation/${visitId}`;
  };

  const statCards = [
    {
      title: 'Waiting Patients',
      value: queue.length,
      icon: Users,
      gradient: 'from-amber-500 to-amber-600',
    },
    {
      title: 'High Risk',
      value: highRiskCount,
      icon: AlertTriangle,
      gradient: 'from-rose-500 to-rose-600',
    },
    {
      title: "Today's Consults",
      value: todayConsultations,
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-emerald-600',
      trend: '+8%',
    },
    {
      title: 'Longest Wait',
      value: queue.length > 0 ? getWaitTime(queue[0].counsellor_end_time) : '0m',
      icon: Clock,
      gradient: 'from-sky-500 to-sky-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Doctor Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage patient consultations and prescriptions</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
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
                <CardDescription>
                  Patients referred from counsellor (high risk prioritized)
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/doctor/queue')}>
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
                    onClick={() => handleStartConsultation(visit.id)}
                    className="flex items-center gap-3 p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
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
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No patients waiting</p>
                  <p className="text-sm text-muted-foreground mt-1">Patients will appear here after counselling</p>
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
              onClick={() => navigate('/doctor/queue')}
            >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
                  <Stethoscope className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">View Full Queue</p>
                  <p className="text-sm text-muted-foreground">
                    See all waiting patients with details
                  </p>
                </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 hover:bg-primary/5 hover:border-primary/30"
              onClick={() => navigate('/doctor/history')}
            >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mr-3">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Consultation History</p>
                  <p className="text-sm text-muted-foreground">
                    View past consultations and prescriptions
                  </p>
                </div>
            </Button>

            {queue.length > 0 && (
              <Button
                className="w-full justify-start h-auto py-4 shadow-md"
                onClick={() => handleStartConsultation(queue[0].id)}
              >
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mr-3">
                  <Users className="h-5 w-5" />
                </div>
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
