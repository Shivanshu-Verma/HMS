"use client";

import { useEffect, useState } from "react";
import { navigate } from "@/lib/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getPharmacyQueue, getPharmacyReports } from "@/lib/hms-api";
import type { Visit, Patient, Prescription, Medicine } from "@/lib/types";
import {
  Users,
  Pill,
  Package,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  FileText,
  Clock,
  TrendingUp,
  IndianRupee,
} from "lucide-react";

interface PrescriptionQueue {
  visit: Visit;
  patient: Patient;
  prescriptions: (Prescription & { medicine?: Medicine })[];
}

export default function PharmacyDashboard() {
  const { accessToken } = useAuth();
  const [queue, setQueue] = useState<PrescriptionQueue[]>([]);
  const [todayDispensed, setTodayDispensed] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);

  useEffect(() => {
    if (!accessToken) return;

    getPharmacyQueue(accessToken)
      .then((data) => {
        const mapped = data.items.map((item) => ({
          visit: {
            id: item.session_id,
            patient_id: item.patient_id,
            visit_date: item.checked_in_at,
            visit_number: 1,
            current_stage: "pharmacy" as const,
            status: "in_progress" as const,
          } as Visit,
          patient: {
            id: item.patient_id,
            full_name: item.patient_name,
            registration_number: "",
            phone: "",
            date_of_birth: "",
            gender: "male" as const,
            status: "active" as const,
          } as Patient,
          prescriptions: [],
        }));
        setQueue(mapped);
      })
      .catch(() => setQueue([]));

    getPharmacyReports(accessToken)
      .then((data) => {
        const revenue = Number(data?.daily?.total_revenue ?? 0);
        const dispensed = Number(data?.daily?.total_transactions ?? 0);
        setTodayRevenue(Number.isFinite(revenue) ? revenue : 0);
        setTodayDispensed(Number.isFinite(dispensed) ? dispensed : 0);
      })
      .catch(() => {
        setTodayRevenue(0);
        setTodayDispensed(0);
      });
  }, [accessToken]);

  const handleDispense = (visitId: string) => {
    window.location.href = `/pharmacy/dispense/${visitId}`;
  };

  const statCards = [
    {
      title: "Pending Dispense",
      value: queue.length,
      icon: Users,
      gradient: "from-amber-500 to-amber-600",
    },
    {
      title: "Dispensed Today",
      value: todayDispensed,
      icon: CheckCircle,
      gradient: "from-emerald-500 to-emerald-600",
      trend: "+15%",
    },
    {
      title: "Low Stock Items",
      value: lowStockCount,
      icon: AlertTriangle,
      gradient: "from-rose-500 to-rose-600",
    },
    {
      title: "Today's Revenue",
      value: `Rs. ${todayRevenue.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      gradient: "from-sky-500 to-sky-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Pharmacy Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage prescriptions and inventory
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow"
          >
            <div className={`h-1.5 bg-gradient-to-r ${stat.gradient}`} />
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.title}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} text-white`}
                >
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
        {/* Prescription Queue */}
        <Card className="border-0 shadow-md">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Prescription Queue</CardTitle>
                <CardDescription>
                  Patients waiting for medicine dispense
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/pharmacy/queue")}
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {queue.length > 0 ? (
                queue.slice(0, 5).map(({ visit, patient, prescriptions }) => (
                  <div
                    key={visit.id}
                    onClick={() => handleDispense(visit.id)}
                    className="flex items-center gap-3 p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {patient.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {patient.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {patient.registration_number} | {prescriptions.length}{" "}
                        medicines
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      <Pill className="h-3.5 w-3.5" />
                      {prescriptions.length}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Pill className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">
                    No pending prescriptions
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Prescriptions will appear here after doctor consultation
                  </p>
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
              onClick={() => navigate("/pharmacy/queue")}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
                <Pill className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium">Prescription Queue</p>
                <p className="text-sm text-muted-foreground">
                  View all pending prescriptions
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 hover:bg-primary/5 hover:border-primary/30"
              onClick={() => navigate("/pharmacy/inventory")}
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mr-3">
                <Package className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Manage Inventory</p>
                <p className="text-sm text-muted-foreground">
                  Stock levels and medicine management
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 hover:bg-primary/5 hover:border-primary/30"
              onClick={() => navigate("/pharmacy/invoices")}
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mr-3">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Invoice History</p>
                <p className="text-sm text-muted-foreground">
                  View past invoices and payments
                </p>
              </div>
            </Button>

            {queue.length > 0 && (
              <Button
                className="w-full justify-start h-auto py-4 shadow-md"
                onClick={() => handleDispense(queue[0].visit.id)}
              >
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mr-3">
                  <Pill className="h-5 w-5" />
                </div>
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
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/50 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <CardTitle className="text-base text-amber-800">
                Low Stock Alert
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-700">
                {lowStockCount} medicine{lowStockCount !== 1 ? "s" : ""} below
                reorder level. Please restock soon.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 hover:bg-amber-100"
                onClick={() => navigate("/pharmacy/inventory")}
              >
                View Inventory
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
