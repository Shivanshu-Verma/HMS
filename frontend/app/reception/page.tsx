'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { visitsApi } from '@/lib/api-client';
import type { DashboardStats } from '@/lib/types';
import {
  Fingerprint,
  UserPlus,
  Users,
  ClipboardList,
  ArrowRight,
  Stethoscope,
  Pill,
  CheckCircle,
} from 'lucide-react';

export default function ReceptionDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await visitsApi.getActive();
        if (result.success && result.data) {
          const items = result.data.items || [];
          const counsellor = items.filter((v: any) => v.current_stage === 'counsellor' && v.status === 'in_progress');
          const doctor = items.filter((v: any) => v.current_stage === 'doctor' && v.status === 'in_progress');
          const pharmacy = items.filter((v: any) => v.current_stage === 'pharmacy' && v.status === 'in_progress');
          const completed = items.filter((v: any) => v.status === 'completed');

          setStats({
            totalPatients: items.length,
            todayVisits: items.length,
            pendingCounsellor: counsellor.length,
            pendingDoctor: doctor.length,
            pendingPharmacy: pharmacy.length,
            completedToday: completed.length,
            lowStockMedicines: 0,
            revenue: 0,
          });
          setRecentVisits(items.slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      }
    };
    fetchData();
  }, []);

  const quickActions = [
    {
      title: 'Patient Check-in',
      description: 'Scan fingerprint to check in a patient',
      href: '/reception/checkin',
      icon: Fingerprint,
      color: 'bg-primary/10 text-primary',
    },
    {
      title: 'Register New Patient',
      description: 'Add a new patient to the system',
      href: '/reception/register',
      icon: UserPlus,
      color: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: 'View Queue Status',
      description: 'See all patients in the workflow',
      href: '/reception/queue',
      icon: ClipboardList,
      color: 'bg-amber-100 text-amber-700',
    },
  ];

  const statCards = stats ? [
    {
      title: 'Total Patients',
      value: stats.totalPatients,
      icon: Users,
      color: 'text-primary',
    },
    {
      title: "Today's Visits",
      value: stats.todayVisits,
      icon: ClipboardList,
      color: 'text-sky-600',
    },
    {
      title: 'At Counsellor',
      value: stats.pendingCounsellor,
      icon: Users,
      color: 'text-amber-600',
    },
    {
      title: 'At Doctor',
      value: stats.pendingDoctor,
      icon: Stethoscope,
      color: 'text-indigo-600',
    },
    {
      title: 'At Pharmacy',
      value: stats.pendingPharmacy,
      icon: Pill,
      color: 'text-rose-600',
    },
    {
      title: 'Completed Today',
      value: stats.completedToday,
      icon: CheckCircle,
      color: 'text-emerald-600',
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reception Dashboard</h1>
        <p className="text-muted-foreground">Manage patient check-ins and registrations</p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        {quickActions.map((action) => (
          <Card key={action.href} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-base mb-1">{action.title}</CardTitle>
              <CardDescription className="mb-4">{action.description}</CardDescription>
              <Button asChild variant="ghost" className="p-0 h-auto">
                <Link href={action.href} className="flex items-center gap-1 text-primary">
                  Go to {action.title.toLowerCase()}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Today&apos;s Overview</h2>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity - Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Check-ins</CardTitle>
          <CardDescription>Patients checked in today</CardDescription>
        </CardHeader>
        <CardContent>
          {recentVisits.length > 0 ? (
            <div className="space-y-3">
              {recentVisits.map((visit: any) => (
                <div
                  key={visit.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{visit.patient?.full_name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      {visit.patient?.registration_number || ''} - Checked in at{' '}
                      {visit.checkin_time
                        ? new Date(visit.checkin_time).toLocaleTimeString()
                        : 'N/A'}
                    </p>
                  </div>
                  <span className="text-sm px-2 py-1 rounded-full bg-secondary capitalize">
                    {visit.current_stage}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No check-ins yet today
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
