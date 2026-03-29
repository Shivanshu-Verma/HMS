"use client";

import { useDemoStore } from "@/lib/demo-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { TrendingUp, Users, IndianRupee, Pill } from "lucide-react";

const COLORS = ["#0066CC", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export default function ReportsPage() {
  const { patients, visits, invoices, medicines } = useDemoStore();

  // Addiction type distribution
  const addictionStats = patients.reduce((acc, patient) => {
    acc[patient.addictionType] = (acc[patient.addictionType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const addictionData = Object.entries(addictionStats).map(([name, value]) => ({
    name,
    value,
  }));

  // Age distribution
  const ageGroups = patients.reduce((acc, patient) => {
    let group = "";
    if (patient.age < 20) group = "Under 20";
    else if (patient.age < 30) group = "20-29";
    else if (patient.age < 40) group = "30-39";
    else if (patient.age < 50) group = "40-49";
    else group = "50+";
    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const ageData = ["Under 20", "20-29", "30-39", "40-49", "50+"].map((group) => ({
    name: group,
    count: ageGroups[group] || 0,
  }));

  // Gender distribution
  const genderStats = patients.reduce((acc, patient) => {
    acc[patient.gender] = (acc[patient.gender] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const genderData = Object.entries(genderStats).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  // Weekly visits (mock data for demo)
  const weeklyVisits = [
    { day: "Mon", visits: Math.floor(Math.random() * 20) + 5 },
    { day: "Tue", visits: Math.floor(Math.random() * 20) + 5 },
    { day: "Wed", visits: Math.floor(Math.random() * 20) + 5 },
    { day: "Thu", visits: Math.floor(Math.random() * 20) + 5 },
    { day: "Fri", visits: Math.floor(Math.random() * 20) + 5 },
    { day: "Sat", visits: Math.floor(Math.random() * 15) + 3 },
    { day: "Sun", visits: Math.floor(Math.random() * 10) + 2 },
  ];

  // Revenue metrics
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const avgInvoice = invoices.length > 0 ? totalRevenue / invoices.length : 0;

  // Top medicines by usage
  const medicineUsage = invoices.reduce((acc, invoice) => {
    invoice.items.forEach((item) => {
      if (item.type === "medicine") {
        const med = medicines.find((m) => m.id === item.medicineId);
        if (med) {
          acc[med.name] = (acc[med.name] || 0) + item.quantity;
        }
      }
    });
    return acc;
  }, {} as Record<string, number>);

  const topMedicines = Object.entries(medicineUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Insights and statistics about your center
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Patients
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{patients.length}</div>
            <p className="text-xs text-muted-foreground">Registered patients</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Visits
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{visits.length}</div>
            <p className="text-xs text-muted-foreground">All time visits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₹{totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: ₹{avgInvoice.toFixed(0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Medicine Stock
            </CardTitle>
            <Pill className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{medicines.length}</div>
            <p className="text-xs text-muted-foreground">Different medicines</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Addiction Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Addiction Type Distribution</CardTitle>
            <CardDescription>Breakdown by addiction type</CardDescription>
          </CardHeader>
          <CardContent>
            {addictionData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={addictionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {addictionData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Age Distribution</CardTitle>
            <CardDescription>Patient age groups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0066CC" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Visits Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Visit Trend</CardTitle>
            <CardDescription>Visits per day of the week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyVisits}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="visits"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ fill: "#10B981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gender Distribution & Top Medicines */}
        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
            <CardDescription>Patient gender breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {genderData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      <Cell fill="#0066CC" />
                      <Cell fill="#EC4899" />
                      <Cell fill="#8B5CF6" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Medicines */}
      <Card>
        <CardHeader>
          <CardTitle>Top Dispensed Medicines</CardTitle>
          <CardDescription>Most frequently prescribed medicines</CardDescription>
        </CardHeader>
        <CardContent>
          {topMedicines.length > 0 ? (
            <div className="space-y-4">
              {topMedicines.map((med, index) => (
                <div key={med.name} className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{med.name}</p>
                  </div>
                  <Badge variant="secondary">{med.count} units</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No medicine data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
