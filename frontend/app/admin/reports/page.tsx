"use client";

import { useState, useMemo } from "react";
import { store } from "@/lib/demo-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";
import {
  Users,
  TrendingUp,
  IndianRupee,
  Pill,
  Calendar,
  FileDown,
  Brain,
  Heart,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
} from "lucide-react";
import type { Patient, Visit, PatientCategory } from "@/lib/types";

const COLORS = {
  psychiatric: "#8B5CF6",
  deaddiction: "#0EA5E9",
  primary: "#0066CC",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
};

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [categoryFilter, setCategoryFilter] = useState<PatientCategory | "all">("all");

  const patients = store.getPatients();
  const visits = store.getVisits();
  const invoices = store.getInvoices();
  const medicines = store.getMedicines();
  const users = store.getUsers();

  const today = new Date().toISOString().split("T")[0];

  // Filter patients by category
  const filteredPatients = useMemo(() => {
    if (categoryFilter === "all") return patients;
    return patients.filter(p => p.patient_category === categoryFilter);
  }, [patients, categoryFilter]);

  // Category statistics
  const categoryStats = useMemo(() => {
    const psychiatric = patients.filter(p => p.patient_category === "psychiatric").length;
    const deaddiction = patients.filter(p => p.patient_category === "deaddiction").length;
    const unassigned = patients.filter(p => !p.patient_category).length;
    return { psychiatric, deaddiction, unassigned, total: patients.length };
  }, [patients]);

  // Today's statistics
  const todayStats = useMemo(() => {
    const todayVisits = visits.filter(v => v.visit_date === today);
    const todayPatients = patients.filter(p => 
      p.created_at && p.created_at.startsWith(today)
    );
    const todayPsychiatric = todayPatients.filter(p => p.patient_category === "psychiatric").length;
    const todayDeaddiction = todayPatients.filter(p => p.patient_category === "deaddiction").length;
    const todayRevenue = invoices
      .filter(i => i.invoice_date === today)
      .reduce((sum, i) => sum + i.grand_total, 0);

    return {
      visits: todayVisits.length,
      completed: todayVisits.filter(v => v.status === "completed").length,
      inProgress: todayVisits.filter(v => v.status === "in_progress").length,
      newPatients: todayPatients.length,
      psychiatric: todayPsychiatric,
      deaddiction: todayDeaddiction,
      revenue: todayRevenue,
    };
  }, [visits, patients, invoices, today]);

  // Monthly statistics
  const monthlyStats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyPatients = patients.filter(p => {
      if (!p.created_at) return false;
      const date = new Date(p.created_at);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    return {
      total: monthlyPatients.length,
      psychiatric: monthlyPatients.filter(p => p.patient_category === "psychiatric").length,
      deaddiction: monthlyPatients.filter(p => p.patient_category === "deaddiction").length,
    };
  }, [patients]);

  // Category distribution chart data
  const categoryChartData = useMemo(() => [
    { name: "Psychiatric", value: categoryStats.psychiatric, color: COLORS.psychiatric },
    { name: "De-Addiction", value: categoryStats.deaddiction, color: COLORS.deaddiction },
    { name: "Unassigned", value: categoryStats.unassigned, color: "#94A3B8" },
  ].filter(d => d.value > 0), [categoryStats]);

  // Daily registration trend (last 7 days)
  const dailyTrend = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    return last7Days.map(date => {
      const dayPatients = patients.filter(p => 
        p.created_at && p.created_at.startsWith(date)
      );
      const dayVisits = visits.filter(v => v.visit_date === date);
      
      return {
        date: new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
        psychiatric: dayPatients.filter(p => p.patient_category === "psychiatric").length,
        deaddiction: dayPatients.filter(p => p.patient_category === "deaddiction").length,
        visits: dayVisits.length,
      };
    });
  }, [patients, visits]);

  // Revenue data
  const revenueData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    return last7Days.map(date => ({
      date: new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
      revenue: invoices.filter(i => i.invoice_date === date).reduce((sum, i) => sum + i.grand_total, 0),
      invoices: invoices.filter(i => i.invoice_date === date).length,
    }));
  }, [invoices]);

  // Age distribution
  const ageDistribution = useMemo(() => {
    const groups: Record<string, { psychiatric: number; deaddiction: number }> = {
      "Under 20": { psychiatric: 0, deaddiction: 0 },
      "20-29": { psychiatric: 0, deaddiction: 0 },
      "30-39": { psychiatric: 0, deaddiction: 0 },
      "40-49": { psychiatric: 0, deaddiction: 0 },
      "50+": { psychiatric: 0, deaddiction: 0 },
    };

    patients.forEach(p => {
      const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
      let group = "50+";
      if (age < 20) group = "Under 20";
      else if (age < 30) group = "20-29";
      else if (age < 40) group = "30-39";
      else if (age < 50) group = "40-49";

      if (p.patient_category === "psychiatric") groups[group].psychiatric++;
      else if (p.patient_category === "deaddiction") groups[group].deaddiction++;
    });

    return Object.entries(groups).map(([group, data]) => ({
      group,
      ...data,
    }));
  }, [patients]);

  // Staff statistics
  const staffStats = useMemo(() => ({
    total: users.length,
    admin: users.filter(u => u.role === "admin").length,
    reception: users.filter(u => u.role === "reception").length,
    counsellor: users.filter(u => u.role === "counsellor").length,
    doctor: users.filter(u => u.role === "doctor").length,
    pharmacist: users.filter(u => u.role === "pharmacist").length,
  }), [users]);

  // Medicine alerts
  const medicineAlerts = useMemo(() => {
    const lowStock = medicines.filter(m => m.stock_quantity <= m.reorder_level);
    const expiringSoon = medicines.filter(m => {
      const expiryDate = new Date(m.expiry_date);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return expiryDate <= thirtyDaysFromNow;
    });
    return { lowStock, expiringSoon };
  }, [medicines]);

  const totalRevenue = invoices.reduce((sum, i) => sum + i.grand_total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive insights into hospital operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-purple-500 to-purple-600" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Psychiatric Patients</p>
                <p className="text-2xl font-bold mt-1">{categoryStats.psychiatric}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Today: +{todayStats.psychiatric}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-purple-100">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-sky-500 to-sky-600" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">De-Addiction Patients</p>
                <p className="text-2xl font-bold mt-1">{categoryStats.deaddiction}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Today: +{todayStats.deaddiction}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-sky-100">
                <Heart className="h-5 w-5 text-sky-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Visits</p>
                <p className="text-2xl font-bold mt-1">{todayStats.visits}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {todayStats.completed} completed, {todayStats.inProgress} in progress
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-100">
                <Activity className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-amber-500 to-amber-600" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Revenue</p>
                <p className="text-2xl font-bold mt-1">Rs. {todayStats.revenue.toLocaleString('en-IN')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total: Rs. {totalRevenue.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-100">
                <IndianRupee className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patients">Patient Reports</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Category Distribution */}
            <Card className="border-0 shadow-md">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle>Patient Category Distribution</CardTitle>
                <CardDescription>Psychiatric vs De-Addiction patients</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Daily Trend */}
            <Card className="border-0 shadow-md">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle>Registration Trend (Last 7 Days)</CardTitle>
                <CardDescription>New patients by category</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="psychiatric" name="Psychiatric" fill={COLORS.psychiatric} />
                    <Bar dataKey="deaddiction" name="De-Addiction" fill={COLORS.deaddiction} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Age Distribution by Category */}
            <Card className="border-0 shadow-md lg:col-span-2">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle>Age Distribution by Category</CardTitle>
                <CardDescription>Patient age groups breakdown</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ageDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="psychiatric" name="Psychiatric" fill={COLORS.psychiatric} />
                    <Bar dataKey="deaddiction" name="De-Addiction" fill={COLORS.deaddiction} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Patient Reports Tab */}
        <TabsContent value="patients" className="space-y-6">
          {/* Filters */}
          <Card className="border-0 shadow-md">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as PatientCategory | "all")}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="psychiatric">Psychiatric</SelectItem>
                      <SelectItem value="deaddiction">De-Addiction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">This Month Total</p>
                    <p className="text-2xl font-bold">{monthlyStats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-purple-100">
                    <Brain className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Psychiatric (Month)</p>
                    <p className="text-2xl font-bold">{monthlyStats.psychiatric}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-sky-100">
                    <Heart className="h-5 w-5 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">De-Addiction (Month)</p>
                    <p className="text-2xl font-bold">{monthlyStats.deaddiction}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Patient List */}
          <Card className="border-0 shadow-md">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle>Patient Records</CardTitle>
              <CardDescription>Showing {filteredPatients.length} patients</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Reg. No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Age/Gender</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.slice(0, 10).map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{patient.registration_number}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{patient.full_name}</TableCell>
                      <TableCell>
                        <Badge className={patient.patient_category === "psychiatric" 
                          ? "bg-purple-100 text-purple-800" 
                          : patient.patient_category === "deaddiction"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-gray-100 text-gray-800"
                        }>
                          {patient.patient_category === "psychiatric" ? "Psychiatric" : 
                           patient.patient_category === "deaddiction" ? "De-Addiction" : "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} / {patient.gender?.charAt(0).toUpperCase()}
                      </TableCell>
                      <TableCell>{patient.phone}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {patient.created_at ? new Date(patient.created_at).toLocaleDateString('en-IN') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-md">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle>Revenue Trend (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" name="Revenue (Rs.)" fill={COLORS.primary} />
                    <Line yAxisId="right" type="monotone" dataKey="invoices" name="Invoices" stroke={COLORS.success} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle>Revenue Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-sm text-emerald-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-emerald-800">Rs. {totalRevenue.toLocaleString('en-IN')}</p>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-600">Today&apos;s Revenue</p>
                  <p className="text-2xl font-bold text-blue-800">Rs. {todayStats.revenue.toLocaleString('en-IN')}</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-sm text-amber-600">Total Invoices</p>
                  <p className="text-2xl font-bold text-amber-800">{invoices.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-5">
            {[
              { label: "Total Staff", value: staffStats.total, color: "bg-primary/10 text-primary" },
              { label: "Admins", value: staffStats.admin, color: "bg-red-100 text-red-800" },
              { label: "Reception", value: staffStats.reception, color: "bg-blue-100 text-blue-800" },
              { label: "Counsellors", value: staffStats.counsellor, color: "bg-green-100 text-green-800" },
              { label: "Doctors", value: staffStats.doctor, color: "bg-purple-100 text-purple-800" },
            ].map((stat) => (
              <Card key={stat.label} className="border-0 shadow-md">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-0 shadow-md">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle>Staff List</CardTitle>
              <CardDescription>All registered users</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={u.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Pill className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Medicines</p>
                    <p className="text-2xl font-bold">{medicines.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-amber-100">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Low Stock</p>
                    <p className="text-2xl font-bold">{medicineAlerts.lowStock.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-red-100">
                    <Clock className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expiring Soon</p>
                    <p className="text-2xl font-bold">{medicineAlerts.expiringSoon.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {medicineAlerts.lowStock.length > 0 && (
            <Card className="border-0 shadow-md border-l-4 border-l-amber-500">
              <CardHeader className="border-b bg-amber-50">
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-5 w-5" />
                  Low Stock Alert
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-50">
                      <TableHead>Medicine</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Reorder Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {medicineAlerts.lowStock.map((med) => (
                      <TableRow key={med.id}>
                        <TableCell className="font-medium">{med.name}</TableCell>
                        <TableCell>{med.category}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{med.stock_quantity}</Badge>
                        </TableCell>
                        <TableCell>{med.reorder_level}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {medicineAlerts.expiringSoon.length > 0 && (
            <Card className="border-0 shadow-md border-l-4 border-l-red-500">
              <CardHeader className="border-b bg-red-50">
                <CardTitle className="flex items-center gap-2 text-red-800">
                  <Clock className="h-5 w-5" />
                  Expiring Soon
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-red-50">
                      <TableHead>Medicine</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Expiry Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {medicineAlerts.expiringSoon.map((med) => (
                      <TableRow key={med.id}>
                        <TableCell className="font-medium">{med.name}</TableCell>
                        <TableCell>{med.category}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {new Date(med.expiry_date).toLocaleDateString('en-IN')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
