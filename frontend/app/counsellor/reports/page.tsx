"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getCounsellorReportSessions,
  type CounsellorReportSessionItem,
} from "@/lib/hms-api";
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Brain,
  Calendar,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Filter,
  Heart,
  TrendingUp,
  Users,
} from "lucide-react";

interface SessionWithPatient {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_category: "psychiatric" | "deaddiction" | "general" | "other";
  created_at: string;
  completed_at?: string;
  session_status: string;
  mood_assessment?: number;
  risk_level?: "low" | "medium" | "high";
  session_notes?: string;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function CounsellorReportsPage() {
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState("daily");
  const [sessions, setSessions] = useState<SessionWithPatient[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!accessToken) return;

    const loadData = async () => {
      try {
        const reportSessionsRes =
          await getCounsellorReportSessions(accessToken);

        const mappedSessions: SessionWithPatient[] =
          reportSessionsRes.items?.map((item: CounsellorReportSessionItem) => ({
            id: item.session_id,
            patient_id: item.patient_id,
            patient_name: item.patient_name || "Unknown",
            patient_category:
              (item.patient_category as SessionWithPatient["patient_category"]) ||
              "deaddiction",
            created_at: item.checked_in_at || "",
            completed_at: item.completed_at || undefined,
            session_status: item.session_status,
            session_notes: item.session_notes || "",
            mood_assessment: item.mood_assessment,
            risk_level: item.risk_level,
          })) || [];

        setSessions(mappedSessions);
      } catch {
        setSessions([]);
      }
    };

    loadData();
    const refreshTimer = window.setInterval(loadData, 10000);
    const onFocus = () => loadData();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", onFocus);
    };
  }, [accessToken]);

  const dailyReportData = useMemo(() => {
    const filtered = sessions.filter((s) =>
      (s.completed_at || s.created_at || "").startsWith(selectedDate),
    );
    const psychiatric = filtered.filter(
      (s) => s.patient_category === "psychiatric",
    );
    const deaddiction = filtered.filter(
      (s) => s.patient_category === "deaddiction",
    );
    const highRisk = filtered.filter((s) => s.risk_level === "high").length;
    const mediumRisk = filtered.filter((s) => s.risk_level === "medium").length;
    const lowRisk = filtered.filter((s) => s.risk_level === "low").length;
    const completed = filtered.filter((s) => Boolean(s.completed_at)).length;

    return {
      sessions: filtered,
      total: filtered.length,
      completed,
      psychiatric: psychiatric.length,
      deaddiction: deaddiction.length,
      highRisk,
      mediumRisk,
      lowRisk,
    };
  }, [sessions, selectedDate]);

  const monthlyReportData = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const filtered = sessions.filter((s) => {
      const d = new Date(s.completed_at || s.created_at);
      return d.getFullYear() === year && d.getMonth() === month - 1;
    });

    const byDay: Record<string, SessionWithPatient[]> = {};
    filtered.forEach((s) => {
      const key = (s.completed_at || s.created_at).split("T")[0];
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(s);
    });

    const uniquePatients = new Set(filtered.map((s) => s.patient_id)).size;
    const psychiatric = filtered.filter(
      (s) => s.patient_category === "psychiatric",
    ).length;
    const deaddiction = filtered.filter(
      (s) => s.patient_category === "deaddiction",
    ).length;
    const highRisk = filtered.filter((s) => s.risk_level === "high").length;
    const mediumRisk = filtered.filter((s) => s.risk_level === "medium").length;
    const lowRisk = filtered.filter((s) => s.risk_level === "low").length;
    const completed = filtered.filter((s) => Boolean(s.completed_at)).length;
    const daysWithSessions = Object.keys(byDay).length;

    return {
      sessions: filtered,
      total: filtered.length,
      completed,
      uniquePatients,
      psychiatric,
      deaddiction,
      highRisk,
      mediumRisk,
      lowRisk,
      daysWithSessions,
      averagePerDay:
        daysWithSessions > 0
          ? Math.round(filtered.length / daysWithSessions)
          : 0,
      byDay,
    };
  }, [sessions, selectedMonth]);

  const customRangeData = useMemo(() => {
    if (!startDate || !endDate) {
      return {
        sessions: [] as SessionWithPatient[],
        total: 0,
        uniquePatients: 0,
        completed: 0,
      };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = sessions.filter((s) => {
      const d = new Date(s.completed_at || s.created_at);
      return d >= start && d <= end;
    });

    return {
      sessions: filtered,
      total: filtered.length,
      uniquePatients: new Set(filtered.map((s) => s.patient_id)).size,
      completed: filtered.length,
    };
  }, [sessions, startDate, endDate]);

  const monthlyBreakdownRows = useMemo(() => {
    return Object.entries(monthlyReportData.byDay)
      .map(([date, daySessions]) => ({
        date,
        total: daySessions.length,
        psychiatric: daySessions.filter(
          (s) => s.patient_category === "psychiatric",
        ).length,
        deaddiction: daySessions.filter(
          (s) => s.patient_category === "deaddiction",
        ).length,
        highRisk: daySessions.filter((s) => s.risk_level === "high").length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [monthlyReportData.byDay]);

  const exportToCSV = (items: SessionWithPatient[], filename: string) => {
    const headers = ["Time", "Patient", "Category", "Mood", "Risk", "Notes"];
    const rows = items.map((s) => [
      s.completed_at
        ? formatDateTime(s.completed_at)
        : s.created_at
          ? formatDateTime(s.created_at)
          : "",
      s.patient_name || "Unknown",
      s.patient_category || "unknown",
      s.mood_assessment?.toString() || "N/A",
      s.risk_level || "not_assessed",
      s.session_notes || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#0d7377] to-[#14919b] bg-clip-text text-transparent">
          Reports
        </h1>
        <p className="text-muted-foreground">
          View daily, monthly, and custom counselling reports
        </p>
      </div>

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

        <TabsContent value="daily" className="space-y-6">
          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Daily Report</CardTitle>
                  <CardDescription>
                    Counselling sessions for a specific date
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
                        dailyReportData.sessions,
                        `counsellor-daily-${selectedDate}`,
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#0d7377] to-[#14919b]" />
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
                      Total Sessions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-600" />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Brain className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.psychiatric}
                    </p>
                    <p className="text-sm text-muted-foreground">Psychiatric</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-teal-400 to-teal-600" />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-100">
                    <Heart className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.deaddiction}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      De-Addiction
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.completed}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Completed Sessions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-red-400 to-red-600" />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.highRisk}
                    </p>
                    <p className="text-sm text-muted-foreground">High Risk</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.mediumRisk}
                    </p>
                    <p className="text-sm text-muted-foreground">Medium Risk</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {dailyReportData.lowRisk}
                    </p>
                    <p className="text-sm text-muted-foreground">Low Risk</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader className="border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
              <CardTitle>
                Session Details on{" "}
                {new Date(selectedDate).toLocaleDateString("en-IN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {dailyReportData.sessions.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
                        <TableHead className="font-semibold">
                          Completed At
                        </TableHead>
                        <TableHead className="font-semibold">Patient</TableHead>
                        <TableHead className="font-semibold">
                          Category
                        </TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Mood</TableHead>
                        <TableHead className="font-semibold">Risk</TableHead>
                        <TableHead className="font-semibold">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyReportData.sessions.map((s) => (
                        <TableRow key={s.id} className="hover:bg-[#0d7377]/5">
                          <TableCell>
                            {formatDateTime(s.completed_at || s.created_at)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {s.patient_name || "Unknown"}
                          </TableCell>
                          <TableCell>
                            {s.patient_category === "psychiatric" ? (
                              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                                Psychiatric
                              </Badge>
                            ) : (
                              <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100">
                                De-Addiction
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {s.completed_at ? (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                Completed
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                {s.session_status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{s.mood_assessment ?? "N/A"}</TableCell>
                          <TableCell>
                            {s.risk_level === "high" ? (
                              <Badge variant="destructive">High</Badge>
                            ) : s.risk_level === "medium" ? (
                              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                Medium
                              </Badge>
                            ) : s.risk_level === "low" ? (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                Low
                              </Badge>
                            ) : (
                              <Badge variant="outline">Not Assessed</Badge>
                            )}
                          </TableCell>
                          <TableCell>{s.session_notes || "No notes"}</TableCell>
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
                    No sessions recorded for this date
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Monthly Report</CardTitle>
                  <CardDescription>
                    Overview of sessions for the selected month
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
                        monthlyReportData.sessions,
                        `counsellor-monthly-${selectedMonth}`,
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#0d7377] to-[#14919b]" />
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
                      Total Sessions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
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
              <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {monthlyReportData.averagePerDay}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Avg Sessions/Day
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {monthlyReportData.completed}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Completed Sessions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader className="border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
              <CardTitle>Daily Breakdown</CardTitle>
              <CardDescription>
                Session count by day for selected month
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {monthlyBreakdownRows.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Total</TableHead>
                        <TableHead className="font-semibold">
                          Psychiatric
                        </TableHead>
                        <TableHead className="font-semibold">
                          De-Addiction
                        </TableHead>
                        <TableHead className="font-semibold">
                          High Risk
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyBreakdownRows.map((row) => (
                        <TableRow
                          key={row.date}
                          className="hover:bg-[#0d7377]/5"
                        >
                          <TableCell>
                            {new Date(row.date).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </TableCell>
                          <TableCell>{row.total}</TableCell>
                          <TableCell>{row.psychiatric}</TableCell>
                          <TableCell>{row.deaddiction}</TableCell>
                          <TableCell>{row.highRisk}</TableCell>
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
                    No sessions recorded for this month
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Custom Date Range</CardTitle>
                  <CardDescription>
                    Sessions during a selected time period
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
                        customRangeData.sessions,
                        `counsellor-custom-${startDate}-to-${endDate}`,
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
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-[#0d7377] to-[#14919b]" />
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
                          Total Sessions
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
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
                  <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
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

              <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
                <CardHeader className="border-b bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
                  <CardTitle>
                    Sessions from {startDate} to {endDate}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {customRangeData.sessions.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-[#0d7377]/5 to-[#14919b]/5">
                            <TableHead className="font-semibold">
                              Completed At
                            </TableHead>
                            <TableHead className="font-semibold">
                              Patient
                            </TableHead>
                            <TableHead className="font-semibold">
                              Category
                            </TableHead>
                            <TableHead className="font-semibold">
                              Status
                            </TableHead>
                            <TableHead className="font-semibold">
                              Mood
                            </TableHead>
                            <TableHead className="font-semibold">
                              Risk
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customRangeData.sessions.map((s) => (
                            <TableRow
                              key={s.id}
                              className="hover:bg-[#0d7377]/5"
                            >
                              <TableCell>
                                {formatDateTime(s.completed_at || s.created_at)}
                              </TableCell>
                              <TableCell>
                                {s.patient_name || "Unknown"}
                              </TableCell>
                              <TableCell>
                                {s.patient_category || "unknown"}
                              </TableCell>
                              <TableCell>
                                {s.completed_at ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                    Completed
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    {s.session_status}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {s.mood_assessment ?? "N/A"}
                              </TableCell>
                              <TableCell>
                                {s.risk_level || "not_assessed"}
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
                        No sessions found for this date range
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
                  <Filter className="h-8 w-8 text-[#0d7377]/50" />
                </div>
                <p className="text-muted-foreground">
                  Please select start and end dates to view custom report
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
