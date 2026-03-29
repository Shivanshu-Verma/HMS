"use client";

import { useDemoStore } from "@/lib/demo-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  Stethoscope,
  Pill,
  TrendingUp,
  Calendar,
  Activity,
  AlertTriangle,
} from "lucide-react";

export default function AdminDashboard() {
  const { patients, visits, medicines, invoices, staff } = useDemoStore();

  const today = new Date().toISOString().split("T")[0];
  const todayVisits = visits.filter((v) => v.checkInTime.startsWith(today));
  const completedToday = todayVisits.filter((v) => v.status === "completed").length;
  const inProgressToday = todayVisits.filter((v) => v.status !== "completed").length;

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const todayRevenue = invoices
    .filter((inv) => inv.createdAt.startsWith(today))
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  const lowStockMedicines = medicines.filter((m) => m.stock <= m.reorderLevel);
  const expiringMedicines = medicines.filter((m) => {
    const expiryDate = new Date(m.expiryDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiryDate <= thirtyDaysFromNow;
  });

  const staffByRole = {
    reception: staff.filter((s) => s.role === "reception").length,
    counsellor: staff.filter((s) => s.role === "counsellor").length,
    doctor: staff.filter((s) => s.role === "doctor").length,
    pharmacist: staff.filter((s) => s.role === "pharmacist").length,
  };

  const statCards = [
    {
      title: "Total Patients",
      value: patients.length,
      description: "Registered patients",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Today's Visits",
      value: todayVisits.length,
      description: `${completedToday} completed, ${inProgressToday} in progress`,
      icon: Calendar,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Today's Revenue",
      value: `₹${todayRevenue.toLocaleString()}`,
      description: `Total: ₹${totalRevenue.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Active Staff",
      value: staff.length,
      description: "Total team members",
      icon: UserCheck,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your de-addiction center operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-full p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Alerts Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alerts & Notifications
            </CardTitle>
            <CardDescription>Items requiring attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lowStockMedicines.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-amber-800">Low Stock Alert</span>
                  <Badge variant="secondary" className="ml-auto">
                    {lowStockMedicines.length} items
                  </Badge>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-amber-700">
                  {lowStockMedicines.slice(0, 3).map((med) => (
                    <li key={med.id}>
                      {med.name} - {med.stock} units remaining
                    </li>
                  ))}
                  {lowStockMedicines.length > 3 && (
                    <li className="text-amber-600">
                      +{lowStockMedicines.length - 3} more items
                    </li>
                  )}
                </ul>
              </div>
            )}

            {expiringMedicines.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-800">Expiring Soon</span>
                  <Badge variant="destructive" className="ml-auto">
                    {expiringMedicines.length} items
                  </Badge>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-red-700">
                  {expiringMedicines.slice(0, 3).map((med) => (
                    <li key={med.id}>
                      {med.name} - Expires{" "}
                      {new Date(med.expiryDate).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {lowStockMedicines.length === 0 && expiringMedicines.length === 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-800">All Clear</span>
                </div>
                <p className="mt-1 text-sm text-green-700">
                  No critical alerts at this time.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Staff Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Staff Overview
            </CardTitle>
            <CardDescription>Team distribution by role</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-foreground">Reception</span>
                </div>
                <span className="font-medium text-foreground">{staffByRole.reception}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm text-foreground">Counsellors</span>
                </div>
                <span className="font-medium text-foreground">{staffByRole.counsellor}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-purple-500" />
                  <span className="text-sm text-foreground">Doctors</span>
                </div>
                <span className="font-medium text-foreground">{staffByRole.doctor}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <span className="text-sm text-foreground">Pharmacists</span>
                </div>
                <span className="font-medium text-foreground">{staffByRole.pharmacist}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Patients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Recent Patients
            </CardTitle>
            <CardDescription>Newly registered patients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patients.slice(0, 5).map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium text-foreground">{patient.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {patient.addictionType} | Age: {patient.age}
                    </p>
                  </div>
                  <Badge variant="outline">{patient.patientId}</Badge>
                </div>
              ))}
              {patients.length === 0 && (
                <p className="text-sm text-muted-foreground">No patients registered yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today's Flow */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Today&apos;s Patient Flow
            </CardTitle>
            <CardDescription>Current status of visits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Checked In</span>
                <Badge variant="secondary">
                  {todayVisits.filter((v) => v.status === "checked_in").length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">With Counsellor</span>
                <Badge variant="secondary">
                  {todayVisits.filter((v) => v.status === "with_counsellor").length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">With Doctor</span>
                <Badge variant="secondary">
                  {todayVisits.filter((v) => v.status === "with_doctor").length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">At Pharmacy</span>
                <Badge variant="secondary">
                  {todayVisits.filter((v) => v.status === "at_pharmacy").length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Completed</span>
                <Badge className="bg-green-100 text-green-800">
                  {completedToday}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
