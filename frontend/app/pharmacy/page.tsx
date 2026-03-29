'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pharmacyApi } from '@/lib/api-client';
import type { Visit, Patient, Prescription, Medicine } from '@/lib/types';
import {
  Users,
  Pill,
  Package,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  FileText,
} from 'lucide-react';

interface PrescriptionQueue {
  visit: Visit;
  patient: Patient;
  prescriptions: (Prescription & { medicine?: Medicine })[];
}

export default function PharmacyDashboard() {
  const router = useRouter();
  const [queue, setQueue] = useState<PrescriptionQueue[]>([]);
  const [todayDispensed, setTodayDispensed] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await pharmacyApi.getQueue();
        if (result.success && result.data?.items) {
          const mapped = result.data.items.map((v: any) => ({
            visit: {
              id: v.id,
              patient_id: v.patient_id,
              visit_date: v.visit_date?.split('T')[0] || '',
              visit_number: v.visit_number,
              current_stage: v.current_stage,
              checkin_time: v.checkin_time,
              status: v.status,
            },
            patient: v.patient || { id: v.patient_id, full_name: 'Unknown', registration_number: '' },
            prescriptions: (v.doctor_stage?.prescriptions || []).map((p: any) => ({
              id: p.id,
              medicine_id: p.medicine_id,
              dosage: p.dosage,
              frequency: p.frequency,
              duration_days: p.duration_days,
              quantity: p.quantity,
              medicine: { name: p.medicine_name, unit: p.medicine_unit },
            })),
          }));
          setQueue(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch queue:', err);
      }
    };
    fetchData();
  }, []);

  const handleDispense = (visitId: string) => {
    router.push(`/pharmacy/dispense/${visitId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pharmacy Dashboard</h1>
        <p className="text-muted-foreground">Manage prescriptions and inventory</p>
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
                <p className="text-sm text-muted-foreground">Pending Dispense</p>
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
                <p className="text-2xl font-bold">{todayDispensed}</p>
                <p className="text-sm text-muted-foreground">Dispensed Today</p>
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
                <p className="text-2xl font-bold">{lowStockCount}</p>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Rs. {todayRevenue.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Today&apos;s Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Prescription Queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Prescription Queue</CardTitle>
                <CardDescription>Patients waiting for medicine dispense</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/pharmacy/queue">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {queue.length > 0 ? (
                queue.slice(0, 5).map(({ visit, patient, prescriptions }) => (
                  <div
                    key={visit.id}
                    onClick={() => handleDispense(visit.id)}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {patient.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{patient.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {patient.registration_number} | {prescriptions.length} medicines
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Pill className="h-4 w-4" />
                      {prescriptions.length}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No pending prescriptions</p>
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
              <Link href="/pharmacy/queue">
                <Pill className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Prescription Queue</p>
                  <p className="text-sm text-muted-foreground">
                    View all pending prescriptions
                  </p>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full justify-start h-auto py-4"
            >
              <Link href="/pharmacy/inventory">
                <Package className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Manage Inventory</p>
                  <p className="text-sm text-muted-foreground">
                    Stock levels and medicine management
                  </p>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full justify-start h-auto py-4"
            >
              <Link href="/pharmacy/invoices">
                <FileText className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Invoice History</p>
                  <p className="text-sm text-muted-foreground">
                    View past invoices and payments
                  </p>
                </div>
              </Link>
            </Button>

            {queue.length > 0 && (
              <Button
                className="w-full justify-start h-auto py-4"
                onClick={() => handleDispense(queue[0].visit.id)}
              >
                <Pill className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Dispense Next</p>
                  <p className="text-sm text-primary-foreground/80">
                    {queue[0].patient.full_name}
                  </p>
                </div>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base text-amber-800">Low Stock Alert</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-700">
                {lowStockCount} medicine{lowStockCount !== 1 ? 's' : ''} below reorder level
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/pharmacy/inventory">View Inventory</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
