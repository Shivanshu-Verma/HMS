"use client";

import { useState, useEffect, useMemo } from "react";
import type { Patient, Visit, PatientCategory } from "@/lib/types";
import {
  getPatientsList,
  getReceptionReports,
  type PatientLookupResponse,
} from "@/lib/hms-api";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Calendar,
  Download,
  Users,
  ClipboardList,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  TrendingUp,
  CalendarDays,
  Filter,
  UserPlus,
  Brain,
  Heart,
} from "lucide-react";

interface VisitWithPatient extends Visit {
  patient?: Patient;
}

export default function ReportsPage() {
  const { accessToken } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits] = useState<Visit[]>([]);
  const [backendReports, setBackendReports] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("daily");

  // Date filters
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Selected patient for details
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const mapApiPatient = (p: PatientLookupResponse): Patient => ({
    id: p.patient_id,
    registration_number: p.registration_number,
    patient_category: (p.patient_category as PatientCategory) || "deaddiction",
    full_name: p.full_name,
    date_of_birth: p.date_of_birth,
    phone: p.phone_number || p.phone || "",
    gender: (p.sex || p.gender || "male") as "male" | "female" | "other",
    status: (p.status as Patient["status"]) || "active",
    address: (p.address_line1 || p.address || "") as string,
    city: "",
    state: "",
    pincode: "",
    addiction_type: "other",
    addiction_duration: p.addiction_duration_text || p.addiction_duration || "",
    first_visit_date: p.date_of_birth,
    emergency_contact_name: "",
    emergency_contact_phone: p.relative_phone || "",
    emergency_contact_relation: "",
    created_at: (p as any).created_at || new Date().toISOString(),
    updated_at: (p as any).updated_at || new Date().toISOString(),
  });

  useEffect(() => {
    if (!accessToken) return;
    const loadReports = () => {
      getReceptionReports(accessToken)
        .then((data) => setBackendReports(data))
        .catch(() => setBackendReports(null));
    };

    const loadPatients = () => {
      getPatientsList(accessToken)
        .then((data) => setPatients((data.items || []).map(mapApiPatient)))
        .catch(() => setPatients([]));
    };

    loadReports();
    loadPatients();

    // Keep reports fresh when new check-ins happen in parallel tabs/users.
    const refreshTimer = window.setInterval(loadReports, 10000);
    const onFocus = () => loadReports();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", onFocus);
    };
  }, [accessToken]);

  const monthBreakdownMap = useMemo(() => {
    const result: Record<string, number> = {};
    const breakdown = backendReports?.monthly?.breakdown;
    const year = backendReports?.monthly?.year;
    const month = backendReports?.monthly?.month;
    if (!Array.isArray(breakdown) || !year || !month) return result;

    breakdown.forEach((item: { day?: number; count?: number }) => {
      if (!item?.day) return;
      const dateKey = `${String(year)}-${String(month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`;
      result[dateKey] = item.count || 0;
    });

    return result;
  }, [backendReports]);

  // Get visits with patient data
  const visitsWithPatients: VisitWithPatient[] = useMemo(() => {
    return visits.map((visit) => ({
      ...visit,
      patient: patients.find((p) => p.id === visit.patient_id),
    }));
  }, [visits, patients]);

  // Daily Report Data
  const dailyReportData = useMemo(() => {
    if (backendReports) {
      const isSelectedDateInBackendMonth = selectedDate.startsWith(
        `${String(backendReports.monthly?.year || "")}-${String(backendReports.monthly?.month || "").padStart(2, "0")}`,
      );
      const selectedDateTotal = isSelectedDateInBackendMonth
        ? monthBreakdownMap[selectedDate] || 0
        : 0;
      const todayDate = backendReports.daily?.date;
      const isToday = selectedDate === todayDate;

      const todayRegistrations = patients.filter((p) => {
        if (!p.created_at) return false;
        const regDate = new Date(p.created_at).toISOString().split("T")[0];
        return regDate === selectedDate;
      });

      const backendDailyItems = Array.isArray(backendReports.daily?.items)
        ? backendReports.daily.items
        : [];
      const selectedDateVisits = isToday
        ? backendDailyItems
        : backendDailyItems.filter((v: any) => v.visit_date === selectedDate);
      const completedCount = selectedDateVisits.filter(
        (v: any) => v.status === "completed",
      ).length;
      const inProgressCount = selectedDateVisits.filter(
        (v: any) => v.status === "in_progress",
      ).length;
      const psychiatricVisits = selectedDateVisits.filter(
        (v: any) => v.patient?.patient_category === "psychiatric",
      ).length;
      const deaddictionVisits = selectedDateVisits.filter(
        (v: any) => v.patient?.patient_category === "deaddiction",
      ).length;

      return {
        visits: selectedDateVisits,
        total: selectedDateVisits.length || selectedDateTotal,
        completed: completedCount,
        inProgress: inProgressCount,
        atCounsellor: 0,
        atDoctor: 0,
        atPharmacy: 0,
        psychiatricVisits,
        deaddictionVisits,
        newRegistrations: todayRegistrations.length,
        psychiatricNew: todayRegistrations.filter(
          (p) => p.patient_category === "psychiatric",
        ).length,
        deaddictionNew: todayRegistrations.filter(
          (p) => p.patient_category === "deaddiction",
        ).length,
      };
    }

    const filtered = visitsWithPatients.filter(
      (v) => v.visit_date === selectedDate,
    );
    const completed = filtered.filter((v) => v.status === "completed");
    const inProgress = filtered.filter((v) => v.status === "in_progress");

    // Category counts
    const psychiatricVisits = filtered.filter(
      (v) => v.patient?.patient_category === "psychiatric",
    );
    const deaddictionVisits = filtered.filter(
      (v) => v.patient?.patient_category === "deaddiction",
    );

    // New registrations today by category
    const todayRegistrations = patients.filter((p) => {
      const regDate = p.created_at
        ? new Date(p.created_at).toISOString().split("T")[0]
        : null;
      return regDate === selectedDate;
    });
    const psychiatricNew = todayRegistrations.filter(
      (p) => p.patient_category === "psychiatric",
    );
    const deaddictionNew = todayRegistrations.filter(
      (p) => p.patient_category === "deaddiction",
    );

    return {
      visits: filtered,
      total: filtered.length,
      completed: completed.length,
      inProgress: inProgress.length,
      atCounsellor: filtered.filter((v) => v.current_stage === "counsellor")
        .length,
      atDoctor: filtered.filter((v) => v.current_stage === "doctor").length,
      atPharmacy: filtered.filter((v) => v.current_stage === "pharmacy").length,
      psychiatricVisits: psychiatricVisits.length,
      deaddictionVisits: deaddictionVisits.length,
      newRegistrations: todayRegistrations.length,
      psychiatricNew: psychiatricNew.length,
      deaddictionNew: deaddictionNew.length,
    };
  }, [
    backendReports,
    monthBreakdownMap,
    visitsWithPatients,
    selectedDate,
    patients,
  ]);

  // Monthly Report Data
  const monthlyReportData = useMemo(() => {
    if (backendReports) {
      const selectedMonthKey = selectedMonth;
      const backendMonthKey = `${String(backendReports.monthly?.year || "")}-${String(backendReports.monthly?.month || "").padStart(2, "0")}`;
      const isSameMonth = selectedMonthKey === backendMonthKey;

      const total = isSameMonth
        ? backendReports.monthly?.total_checkins || 0
        : 0;
      const daysWithVisits = isSameMonth
        ? (backendReports.monthly?.breakdown || []).filter(
            (d: { count?: number }) => (d.count || 0) > 0,
          ).length
        : 0;

      const [year, month] = selectedMonth.split("-").map(Number);
      const newPatients = patients.filter((p) => {
        if (!p.created_at) return false;
        const regDate = new Date(p.created_at);
        return (
          regDate.getFullYear() === year && regDate.getMonth() === month - 1
        );
      });

      return {
        visits: [],
        total,
        completed: total,
        uniquePatients: 0,
        newRegistrations: newPatients.length,
        byDay: {},
        daysWithVisits,
        averagePerDay:
          daysWithVisits > 0 ? Math.round(total / daysWithVisits) : 0,
        psychiatricVisits: 0,
        deaddictionVisits: 0,
        psychiatricNew: newPatients.filter(
          (p) => p.patient_category === "psychiatric",
        ).length,
        deaddictionNew: newPatients.filter(
          (p) => p.patient_category === "deaddiction",
        ).length,
      };
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    const filtered = visitsWithPatients.filter((v) => {
      const visitDate = new Date(v.visit_date);
      return (
        visitDate.getFullYear() === year && visitDate.getMonth() === month - 1
      );
    });

    // Group by day
    const byDay: Record<string, VisitWithPatient[]> = {};
    filtered.forEach((v) => {
      const day = v.visit_date;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(v);
    });

    // Unique patients this month
    const uniquePatients = new Set(filtered.map((v) => v.patient_id));

    // New registrations this month
    const newPatients = patients.filter((p) => {
      const regDate = new Date(p.created_at);
      return regDate.getFullYear() === year && regDate.getMonth() === month - 1;
    });

    // Category counts for visits
    const psychiatricVisits = filtered.filter(
      (v) => v.patient?.patient_category === "psychiatric",
    );
    const deaddictionVisits = filtered.filter(
      (v) => v.patient?.patient_category === "deaddiction",
    );

    // Category counts for new registrations
    const psychiatricNew = newPatients.filter(
      (p) => p.patient_category === "psychiatric",
    );
    const deaddictionNew = newPatients.filter(
      (p) => p.patient_category === "deaddiction",
    );

    return {
      visits: filtered,
      total: filtered.length,
      completed: filtered.filter((v) => v.status === "completed").length,
      uniquePatients: uniquePatients.size,
      newRegistrations: newPatients.length,
      byDay,
      daysWithVisits: Object.keys(byDay).length,
      averagePerDay:
        Object.keys(byDay).length > 0
          ? Math.round(filtered.length / Object.keys(byDay).length)
          : 0,
      psychiatricVisits: psychiatricVisits.length,
      deaddictionVisits: deaddictionVisits.length,
      psychiatricNew: psychiatricNew.length,
      deaddictionNew: deaddictionNew.length,
    };
  }, [backendReports, visitsWithPatients, patients, selectedMonth]);

  const monthlyBreakdownRows = useMemo(() => {
    if (backendReports) {
      return Object.entries(monthBreakdownMap).map(([date, count]) => ({
        date,
        total: count,
        completed: count,
        inProgress:
          date === backendReports.daily?.date
            ? backendReports.daily?.active_checkins || 0
            : 0,
      }));
    }

    return Object.entries(monthlyReportData.byDay).map(([date, dayVisits]) => ({
      date,
      total: dayVisits.length,
      completed: dayVisits.filter((v) => v.status === "completed").length,
      inProgress: dayVisits.filter((v) => v.status === "in_progress").length,
    }));
  }, [backendReports, monthBreakdownMap, monthlyReportData.byDay]);

  // Custom Date Range Report Data
  const customRangeData = useMemo(() => {
    if (!startDate || !endDate) return { visits: [], total: 0 };

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = visitsWithPatients.filter((v) => {
      const visitDate = new Date(v.visit_date);
      return visitDate >= start && visitDate <= end;
    });

    // Group by patient
    const byPatient: Record<string, VisitWithPatient[]> = {};
    filtered.forEach((v) => {
      if (!byPatient[v.patient_id]) byPatient[v.patient_id] = [];
      byPatient[v.patient_id].push(v);
    });

    return {
      visits: filtered,
      total: filtered.length,
      completed: filtered.filter((v) => v.status === "completed").length,
      uniquePatients: Object.keys(byPatient).length,
      byPatient,
    };
  }, [visitsWithPatients, startDate, endDate]);

  const formatTime = (time?: string) => {
    if (!time) return "-";
    return new Date(time).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "counsellor":
        return "bg-amber-100 text-amber-800";
      case "doctor":
        return "bg-blue-100 text-blue-800";
      case "pharmacy":
        return "bg-purple-100 text-purple-800";
      case "completed":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const calculateAge = (dob: string) => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const exportToCSV = (data: VisitWithPatient[], filename: string) => {
    const headers = [
      "File No",
      "Patient Name",
      "Phone",
      "Visit Date",
      "Check-in Time",
      "Stage",
      "Status",
    ];
    const rows = data.map((v) => [
      v.patient?.registration_number || "",
      v.patient?.full_name || "",
      v.patient?.phone || "",
      v.visit_date,
      formatTime(v.checkin_time),
      v.current_stage,
      v.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#0d7377] to-[#14919b] bg-clip-text text-transparent">
          Reports
        </h1>
        <p className="text-muted-foreground">
          View daily, monthly reports and patient visit history
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px] bg-[#0d7377]/10">
          <TabsTrigger
            value="daily"
            className="flex items-center gap-2 data-[state=active]:bg-[#0d7377] data-[state=active]:text-white"
          >
            <Calendar className="h-4 w-4" />
            Daily
          </TabsTrigger>
          <TabsTrigger
            value="monthly"
            className="flex items-center gap-2 data-[state=active]:bg-[#0d7377] data-[state=active]:text-white"
          >
            <CalendarDays className="h-4 w-4" />
            Monthly
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            className="flex items-center gap-2 data-[state=active]:bg-[#0d7377] data-[state=active]:text-white"
          >
            <Filter className="h-4 w-4" />
            Custom
          </TabsTrigger>
        </TabsList>

        {/* Daily Report */}
        <TabsContent value="daily" className="space-y-6">
          {/* Date Selector */}
          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Daily Report</CardTitle>
                  <CardDescription>
                    Patient visits for a specific date
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-auto focus-visible:ring-[#0d7377]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToCSV(
                        dailyReportData.visits,
                        `daily-report-${selectedDate}`,
                      )
                    }
                    disabled={dailyReportData.total === 0}
                    className="border-[#0d7377]/30 hover:bg-[#0d7377]/10"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Daily Stats - General */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#0d7377] to-[#14919b]"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#0d7377]/10">
                    <ClipboardList className="h-5 w-5 text-[#0d7377]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.total}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total Visits
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.completed}
                    </p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.inProgress}
                    </p>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.newRegistrations}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      New Registrations
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Stats - Category Wise */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Brain className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.psychiatricVisits}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Psychiatric Visits
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#0d7377] to-[#14919b]"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#0d7377]/10">
                    <Heart className="h-5 w-5 text-[#0d7377]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.deaddictionVisits}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      De-Addiction Visits
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50">
                    <UserPlus className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.psychiatricNew}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      New Psychiatric
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-teal-400 to-teal-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-50">
                    <UserPlus className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.deaddictionNew}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      New De-Addiction
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Visit Table */}
          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader className="border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
              <CardTitle>
                Patient Visits on{" "}
                {new Date(selectedDate).toLocaleDateString("en-IN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {dailyReportData.visits.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
                        <TableHead className="font-semibold">
                          File No.
                        </TableHead>
                        <TableHead className="font-semibold">
                          Patient Name
                        </TableHead>
                        <TableHead className="font-semibold">
                          Age/Gender
                        </TableHead>
                        <TableHead className="font-semibold">Phone</TableHead>
                        <TableHead className="font-semibold">
                          Check-in Time
                        </TableHead>
                        <TableHead className="font-semibold">
                          Current Stage
                        </TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyReportData.visits
                        .sort((a: VisitWithPatient, b: VisitWithPatient) =>
                          (a.patient?.registration_number || "").localeCompare(
                            b.patient?.registration_number || "",
                          ),
                        )
                        .map((visit: VisitWithPatient) => (
                          <TableRow
                            key={visit.id}
                            className="hover:bg-[#0d7377]/5"
                          >
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="font-mono border-[#0d7377]/30 text-[#0d7377]"
                              >
                                {visit.patient?.registration_number || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {visit.patient?.full_name || "-"}
                            </TableCell>
                            <TableCell>
                              {visit.patient
                                ? `${visit.patient.date_of_birth ? `${calculateAge(visit.patient.date_of_birth)}Y` : "-"} / ${(visit.patient.gender || "other").charAt(0).toUpperCase()}`
                                : "-"}
                            </TableCell>
                            <TableCell>{visit.patient?.phone || "-"}</TableCell>
                            <TableCell>
                              {formatTime(visit.checkin_time)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={getStageColor(visit.current_stage)}
                              >
                                {visit.current_stage}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  visit.status === "completed"
                                    ? "default"
                                    : "outline"
                                }
                                className={
                                  visit.status === "completed"
                                    ? "bg-emerald-600"
                                    : ""
                                }
                              >
                                {visit.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Sheet>
                                <SheetTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setSelectedPatient(visit.patient || null)
                                    }
                                    className="hover:text-[#0d7377] hover:bg-[#0d7377]/10"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </SheetTrigger>
                                <SheetContent className="overflow-y-auto">
                                  <SheetHeader>
                                    <SheetTitle className="text-[#0d7377]">
                                      Patient Details
                                    </SheetTitle>
                                    <SheetDescription>
                                      Complete information for{" "}
                                      {selectedPatient?.full_name}
                                    </SheetDescription>
                                  </SheetHeader>
                                  {selectedPatient && (
                                    <div className="mt-6 space-y-6">
                                      <div className="space-y-4 rounded-lg bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5 p-4">
                                        <h4 className="font-semibold text-sm text-[#0d7377]">
                                          Personal Information
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                          <div>
                                            <p className="text-muted-foreground">
                                              File No.
                                            </p>
                                            <p className="font-medium">
                                              {
                                                selectedPatient.registration_number
                                              }
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground">
                                              Name
                                            </p>
                                            <p className="font-medium">
                                              {selectedPatient.full_name}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground">
                                              Age
                                            </p>
                                            <p className="font-medium">
                                              {calculateAge(
                                                selectedPatient.date_of_birth,
                                              )}{" "}
                                              years
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground">
                                              Gender
                                            </p>
                                            <p className="font-medium capitalize">
                                              {selectedPatient.gender}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground">
                                              Phone
                                            </p>
                                            <p className="font-medium">
                                              {selectedPatient.phone}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground">
                                              Blood Group
                                            </p>
                                            <p className="font-medium">
                                              {selectedPatient.blood_group ||
                                                "-"}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="space-y-4 rounded-lg bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5 p-4">
                                        <h4 className="font-semibold text-sm text-[#0d7377]">
                                          Addiction Details
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                          <div>
                                            <p className="text-muted-foreground">
                                              Type
                                            </p>
                                            <p className="font-medium capitalize">
                                              {selectedPatient.addiction_type}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground">
                                              Duration
                                            </p>
                                            <p className="font-medium">
                                              {selectedPatient.addiction_duration ||
                                                "-"}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="space-y-4 rounded-lg bg-amber-50 border border-amber-100 p-4">
                                        <h4 className="font-semibold text-sm text-amber-700">
                                          Emergency Contact
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                          <div>
                                            <p className="text-muted-foreground">
                                              Name
                                            </p>
                                            <p className="font-medium">
                                              {
                                                selectedPatient.emergency_contact_name
                                              }
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground">
                                              Phone
                                            </p>
                                            <p className="font-medium">
                                              {
                                                selectedPatient.emergency_contact_phone
                                              }
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </SheetContent>
                              </Sheet>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0d7377]/10 to-[#14919b]/10 flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-[#0d7377]/50" />
                  </div>
                  <p className="text-muted-foreground">
                    No visits recorded for this date
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Report */}
        <TabsContent value="monthly" className="space-y-6">
          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Monthly Report</CardTitle>
                  <CardDescription>
                    Overview of visits for the selected month
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-auto focus-visible:ring-[#0d7377]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToCSV(
                        monthlyReportData.visits,
                        `monthly-report-${selectedMonth}`,
                      )
                    }
                    disabled={monthlyReportData.total === 0}
                    className="border-[#0d7377]/30 hover:bg-[#0d7377]/10"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Monthly Stats - General */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#0d7377] to-[#14919b]"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#0d7377]/10">
                    <ClipboardList className="h-5 w-5 text-[#0d7377]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {monthlyReportData.total}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total Visits
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {monthlyReportData.uniquePatients}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Unique Patients
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <UserPlus className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {monthlyReportData.newRegistrations}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      New Registrations
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {monthlyReportData.averagePerDay}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Avg. Visits/Day
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Stats - Category Wise */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Brain className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {monthlyReportData.psychiatricVisits}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Psychiatric Visits
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#0d7377] to-[#14919b]"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#0d7377]/10">
                    <Heart className="h-5 w-5 text-[#0d7377]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {monthlyReportData.deaddictionVisits}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      De-Addiction Visits
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50">
                    <UserPlus className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {monthlyReportData.psychiatricNew}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      New Psychiatric
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-teal-400 to-teal-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-50">
                    <UserPlus className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {monthlyReportData.deaddictionNew}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      New De-Addiction
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Breakdown */}
          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader className="border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
              <CardTitle>Daily Breakdown</CardTitle>
              <CardDescription>
                Click on a date to see detailed visits
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {monthlyBreakdownRows.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">
                          Total Visits
                        </TableHead>
                        <TableHead className="font-semibold">
                          Completed
                        </TableHead>
                        <TableHead className="font-semibold">
                          In Progress
                        </TableHead>
                        <TableHead className="font-semibold text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyBreakdownRows
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((row) => (
                          <TableRow
                            key={row.date}
                            className="hover:bg-[#0d7377]/5"
                          >
                            <TableCell className="font-medium">
                              {new Date(row.date).toLocaleDateString("en-IN", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </TableCell>
                            <TableCell>{row.total}</TableCell>
                            <TableCell className="text-emerald-600">
                              {row.completed}
                            </TableCell>
                            <TableCell className="text-amber-600">
                              {row.inProgress}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedDate(row.date);
                                  setActiveTab("daily");
                                }}
                                className="hover:text-[#0d7377] hover:bg-[#0d7377]/10"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0d7377]/10 to-[#14919b]/10 flex items-center justify-center mx-auto mb-4">
                    <CalendarDays className="h-8 w-8 text-[#0d7377]/50" />
                  </div>
                  <p className="text-muted-foreground">
                    No visits recorded for this month
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Date Range */}
        <TabsContent value="custom" className="space-y-6">
          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Custom Date Range</CardTitle>
                  <CardDescription>
                    Find patients who visited during a specific period
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="startDate"
                      className="text-sm whitespace-nowrap"
                    >
                      From:
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-auto focus-visible:ring-[#0d7377]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="endDate"
                      className="text-sm whitespace-nowrap"
                    >
                      To:
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-auto focus-visible:ring-[#0d7377]"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToCSV(
                        customRangeData.visits,
                        `custom-report-${startDate}-to-${endDate}`,
                      )
                    }
                    disabled={customRangeData.total === 0}
                    className="border-[#0d7377]/30 hover:bg-[#0d7377]/10"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {startDate && endDate ? (
            <>
              {/* Custom Range Stats */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-[#0d7377] to-[#14919b]"></div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#0d7377]/10">
                        <ClipboardList className="h-5 w-5 text-[#0d7377]" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {customRangeData.total}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Total Visits
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {customRangeData.uniquePatients}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Unique Patients
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100">
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {customRangeData.completed}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Completed
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Custom Range Visit Table */}
              <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
                <CardHeader className="border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
                  <CardTitle>
                    Visits from {new Date(startDate).toLocaleDateString()} to{" "}
                    {new Date(endDate).toLocaleDateString()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {customRangeData.visits.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
                            <TableHead className="font-semibold">
                              File No.
                            </TableHead>
                            <TableHead className="font-semibold">
                              Patient Name
                            </TableHead>
                            <TableHead className="font-semibold">
                              Phone
                            </TableHead>
                            <TableHead className="font-semibold">
                              Visit Date
                            </TableHead>
                            <TableHead className="font-semibold">
                              Check-in Time
                            </TableHead>
                            <TableHead className="font-semibold">
                              Status
                            </TableHead>
                            <TableHead className="font-semibold text-right">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customRangeData.visits
                            .sort((a, b) =>
                              (
                                a.patient?.registration_number || ""
                              ).localeCompare(
                                b.patient?.registration_number || "",
                              ),
                            )
                            .map((visit) => (
                              <TableRow
                                key={visit.id}
                                className="hover:bg-[#0d7377]/5"
                              >
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className="font-mono border-[#0d7377]/30 text-[#0d7377]"
                                  >
                                    {visit.patient?.registration_number || "-"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {visit.patient?.full_name || "-"}
                                </TableCell>
                                <TableCell>
                                  {visit.patient?.phone || "-"}
                                </TableCell>
                                <TableCell>
                                  {new Date(
                                    visit.visit_date,
                                  ).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  {formatTime(visit.checkin_time)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      visit.status === "completed"
                                        ? "default"
                                        : "outline"
                                    }
                                    className={
                                      visit.status === "completed"
                                        ? "bg-emerald-600"
                                        : ""
                                    }
                                  >
                                    {visit.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Sheet>
                                    <SheetTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          setSelectedPatient(
                                            visit.patient || null,
                                          )
                                        }
                                        className="hover:text-[#0d7377] hover:bg-[#0d7377]/10"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </SheetTrigger>
                                    <SheetContent className="overflow-y-auto">
                                      <SheetHeader>
                                        <SheetTitle className="text-[#0d7377]">
                                          Patient Details
                                        </SheetTitle>
                                        <SheetDescription>
                                          Complete information for{" "}
                                          {selectedPatient?.full_name}
                                        </SheetDescription>
                                      </SheetHeader>
                                      {selectedPatient && (
                                        <div className="mt-6 space-y-6">
                                          <div className="space-y-4 rounded-lg bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5 p-4">
                                            <h4 className="font-semibold text-sm text-[#0d7377]">
                                              Personal Information
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                              <div>
                                                <p className="text-muted-foreground">
                                                  File No.
                                                </p>
                                                <p className="font-medium">
                                                  {
                                                    selectedPatient.registration_number
                                                  }
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-muted-foreground">
                                                  Name
                                                </p>
                                                <p className="font-medium">
                                                  {selectedPatient.full_name}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-muted-foreground">
                                                  Phone
                                                </p>
                                                <p className="font-medium">
                                                  {selectedPatient.phone}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-muted-foreground">
                                                  Addiction Type
                                                </p>
                                                <p className="font-medium capitalize">
                                                  {
                                                    selectedPatient.addiction_type
                                                  }
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </SheetContent>
                                  </Sheet>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0d7377]/10 to-[#14919b]/10 flex items-center justify-center mx-auto mb-4">
                        <Filter className="h-8 w-8 text-[#0d7377]/50" />
                      </div>
                      <p className="text-muted-foreground">
                        No visits found for this date range
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0d7377]/10 to-[#14919b]/10 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-[#0d7377]/50" />
                </div>
                <p className="text-muted-foreground">
                  Select a start and end date to view patient visits
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
