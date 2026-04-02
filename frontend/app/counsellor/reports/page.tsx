'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getCounsellorReports, type CounsellorReportsResponse } from '@/lib/hms-api';
import { useAuth } from '@/lib/auth-context';
import { PATIENT_CATEGORY_LABELS } from '@/lib/types';
import type { Patient, Visit, CounsellorSession } from '@/lib/types';
import {
  Calendar,
  Download,
  Users,
  ClipboardList,
  CheckCircle,
  Clock,
  TrendingUp,
  Brain,
  Heart,
  AlertTriangle,
  Smile,
  Meh,
  Frown,
  FileText,
  BarChart3,
  CalendarDays,
} from 'lucide-react';

interface SessionWithPatient extends CounsellorSession {
  patient?: Patient;
  visit?: Visit;
}

export default function CounsellorReportsPage() {
  const { accessToken } = useAuth();
  const [sessions, setSessions] = useState<SessionWithPatient[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [backendReports, setBackendReports] = useState<CounsellorReportsResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!accessToken) return;
    getCounsellorReports(accessToken)
      .then((data) => setBackendReports(data))
      .catch(() => setBackendReports(null));
  }, [accessToken]);

  // Daily Report Data
  const dailyReportData = useMemo(() => {
    if (backendReports) {
      return {
        sessions: [],
        total:
          backendReports.daily?.total_followups ??
          backendReports.daily?.total_checkins ??
          0,
        psychiatricCount: 0,
        deaddictionCount: 0,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
        avgMood: 0,
      };
    }

    const filtered = sessions.filter(s => s.created_at.startsWith(selectedDate));
    
    const psychiatricSessions = filtered.filter(s => s.patient?.patient_category === 'psychiatric');
    const deaddictionSessions = filtered.filter(s => s.patient?.patient_category === 'deaddiction');
    
    const highRisk = filtered.filter(s => s.risk_level === 'high').length;
    const mediumRisk = filtered.filter(s => s.risk_level === 'medium').length;
    const lowRisk = filtered.filter(s => s.risk_level === 'low').length;
    
    const avgMood = filtered.length > 0 
      ? Math.round(filtered.reduce((acc, s) => acc + (s.mood_assessment || 5), 0) / filtered.length)
      : 0;
    
    return {
      sessions: filtered,
      total: filtered.length,
      psychiatricCount: psychiatricSessions.length,
      deaddictionCount: deaddictionSessions.length,
      highRisk,
      mediumRisk,
      lowRisk,
      avgMood,
    };
  }, [sessions, selectedDate]);

  // Monthly Report Data
  const monthlyReportData = useMemo(() => {
    if (backendReports) {
      return {
        sessions: [],
        total:
          backendReports.monthly?.total ??
          backendReports.monthly?.total_checkins ??
          0,
        psychiatricCount: 0,
        deaddictionCount: 0,
        uniquePatients: 0,
        byDay: {},
        daysWithSessions: 0,
        averagePerDay: 0,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
        avgMood: 0,
      };
    }

    const [year, month] = selectedMonth.split('-').map(Number);
    const filtered = sessions.filter(s => {
      const sessionDate = new Date(s.created_at);
      return sessionDate.getFullYear() === year && sessionDate.getMonth() === month - 1;
    });
    
    const psychiatricSessions = filtered.filter(s => s.patient?.patient_category === 'psychiatric');
    const deaddictionSessions = filtered.filter(s => s.patient?.patient_category === 'deaddiction');
    
    // Group by day for chart
    const byDay: Record<string, SessionWithPatient[]> = {};
    filtered.forEach(s => {
      const day = s.created_at.split('T')[0];
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(s);
    });
    
    const uniquePatients = new Set(filtered.map(s => s.patient_id));
    
    const highRisk = filtered.filter(s => s.risk_level === 'high').length;
    const mediumRisk = filtered.filter(s => s.risk_level === 'medium').length;
    const lowRisk = filtered.filter(s => s.risk_level === 'low').length;
    
    const avgMood = filtered.length > 0 
      ? Math.round(filtered.reduce((acc, s) => acc + (s.mood_assessment || 5), 0) / filtered.length)
      : 0;
    
    return {
      sessions: filtered,
      total: filtered.length,
      psychiatricCount: psychiatricSessions.length,
      deaddictionCount: deaddictionSessions.length,
      uniquePatients: uniquePatients.size,
      byDay,
      daysWithSessions: Object.keys(byDay).length,
      averagePerDay: Object.keys(byDay).length > 0 
        ? Math.round(filtered.length / Object.keys(byDay).length) 
        : 0,
      highRisk,
      mediumRisk,
      lowRisk,
      avgMood,
    };
  }, [sessions, selectedMonth]);

  // Export daily report
  const exportDailyReport = () => {
    const headers = ['Time', 'Patient Name', 'Category', 'Mood Score', 'Risk Level', 'Notes'];
    const rows = dailyReportData.sessions.map(s => [
      new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      s.patient?.full_name || 'Unknown',
      s.patient?.patient_category ? PATIENT_CATEGORY_LABELS[s.patient.patient_category] : 'N/A',
      s.mood_assessment?.toString() || 'N/A',
      s.risk_level || 'N/A',
      s.session_notes?.substring(0, 50) || '',
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `counsellor-report-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getMoodIcon = (score: number) => {
    if (score >= 7) return <Smile className="h-4 w-4 text-emerald-500" />;
    if (score >= 4) return <Meh className="h-4 w-4 text-amber-500" />;
    return <Frown className="h-4 w-4 text-red-500" />;
  };

  const getRiskBadge = (level?: string) => {
    switch (level) {
      case 'high':
        return <Badge variant="destructive">High Risk</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Low</Badge>;
      default:
        return <Badge variant="outline">Not Assessed</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Counselling Reports</h1>
          <p className="text-muted-foreground mt-1">View daily and monthly counselling session statistics</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <Tabs defaultValue="daily" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="daily" className="gap-2">
            <Calendar className="h-4 w-4" />
            Daily Report
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Monthly Report
          </TabsTrigger>
        </TabsList>

        {/* Daily Report Tab */}
        <TabsContent value="daily" className="space-y-6">
          {/* Date Selector */}
          <Card className="border-0 shadow-md">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-48"
                  />
                </div>
                <Button onClick={exportDailyReport} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Daily Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#0d7377] to-[#14919b]"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#0d7377]/10">
                    <ClipboardList className="h-5 w-5 text-[#0d7377]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{dailyReportData.total}</p>
                    <p className="text-sm text-muted-foreground">Total Sessions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Brain className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{dailyReportData.psychiatricCount}</p>
                    <p className="text-sm text-muted-foreground">Psychiatric</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-teal-400 to-teal-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-100">
                    <Heart className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{dailyReportData.deaddictionCount}</p>
                    <p className="text-sm text-muted-foreground">De-Addiction</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    {getMoodIcon(dailyReportData.avgMood)}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{dailyReportData.avgMood}/10</p>
                    <p className="text-sm text-muted-foreground">Avg Mood Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Level Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-md border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-red-600">{dailyReportData.highRisk}</p>
                      <p className="text-sm text-muted-foreground">High Risk</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-md border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-amber-600">{dailyReportData.mediumRisk}</p>
                      <p className="text-sm text-muted-foreground">Medium Risk</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-md border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-emerald-600">{dailyReportData.lowRisk}</p>
                      <p className="text-sm text-muted-foreground">Low Risk</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sessions Table */}
          <Card className="shadow-md border-0">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Session Details for {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </CardTitle>
              <CardDescription>{dailyReportData.total} session(s) recorded</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {dailyReportData.sessions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Mood</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyReportData.sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">
                          {new Date(session.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{session.patient?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{session.patient?.registration_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {session.patient?.patient_category === 'psychiatric' ? (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700">Psychiatric</Badge>
                          ) : session.patient?.patient_category === 'deaddiction' ? (
                            <Badge variant="secondary" className="bg-teal-100 text-teal-700">De-Addiction</Badge>
                          ) : (
                            <Badge variant="outline">Unknown</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMoodIcon(session.mood_assessment || 5)}
                            <span>{session.mood_assessment || 'N/A'}/10</span>
                          </div>
                        </TableCell>
                        <TableCell>{getRiskBadge(session.risk_level)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {session.session_notes || 'No notes'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No sessions recorded</p>
                  <p className="text-sm text-muted-foreground mt-1">No counselling sessions for this date</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Report Tab */}
        <TabsContent value="monthly" className="space-y-6">
          {/* Month Selector */}
          <Card className="border-0 shadow-md">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-48"
                />
              </div>
            </CardContent>
          </Card>

          {/* Monthly Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#0d7377] to-[#14919b]"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#0d7377]/10">
                    <ClipboardList className="h-5 w-5 text-[#0d7377]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{monthlyReportData.total}</p>
                    <p className="text-sm text-muted-foreground">Total Sessions</p>
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
                    <p className="text-2xl font-bold">{monthlyReportData.uniquePatients}</p>
                    <p className="text-sm text-muted-foreground">Unique Patients</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{monthlyReportData.averagePerDay}</p>
                    <p className="text-sm text-muted-foreground">Avg. Sessions/Day</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    {getMoodIcon(monthlyReportData.avgMood)}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{monthlyReportData.avgMood}/10</p>
                    <p className="text-sm text-muted-foreground">Avg Mood Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Brain className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{monthlyReportData.psychiatricCount}</p>
                    <p className="text-sm text-muted-foreground">Psychiatric Sessions</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {monthlyReportData.total > 0 
                    ? `${Math.round((monthlyReportData.psychiatricCount / monthlyReportData.total) * 100)}% of total`
                    : '0% of total'}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-teal-400 to-teal-600"></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-100">
                    <Heart className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{monthlyReportData.deaddictionCount}</p>
                    <p className="text-sm text-muted-foreground">De-Addiction Sessions</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {monthlyReportData.total > 0 
                    ? `${Math.round((monthlyReportData.deaddictionCount / monthlyReportData.total) * 100)}% of total`
                    : '0% of total'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Level Summary */}
          <Card className="shadow-md border-0">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Monthly Risk Assessment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-red-50 border border-red-100">
                  <div className="p-3 rounded-full bg-red-100">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{monthlyReportData.highRisk}</p>
                    <p className="text-sm text-red-600/80">High Risk Patients</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-amber-50 border border-amber-100">
                  <div className="p-3 rounded-full bg-amber-100">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{monthlyReportData.mediumRisk}</p>
                    <p className="text-sm text-amber-600/80">Medium Risk Patients</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div className="p-3 rounded-full bg-emerald-100">
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">{monthlyReportData.lowRisk}</p>
                    <p className="text-sm text-emerald-600/80">Low Risk Patients</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Breakdown */}
          <Card className="shadow-md border-0">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Daily Breakdown
              </CardTitle>
              <CardDescription>Sessions completed each day of the month</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {Object.keys(monthlyReportData.byDay).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Psychiatric</TableHead>
                      <TableHead className="text-center">De-Addiction</TableHead>
                      <TableHead className="text-center">High Risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(monthlyReportData.byDay)
                      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                      .map(([date, daySessions]) => {
                        const psychiatric = daySessions.filter(s => s.patient?.patient_category === 'psychiatric').length;
                        const deaddiction = daySessions.filter(s => s.patient?.patient_category === 'deaddiction').length;
                        const highRisk = daySessions.filter(s => s.risk_level === 'high').length;
                        return (
                          <TableRow key={date}>
                            <TableCell className="font-medium">
                              {new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </TableCell>
                            <TableCell className="text-center">{daySessions.length}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700">{psychiatric}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="bg-teal-100 text-teal-700">{deaddiction}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {highRisk > 0 ? (
                                <Badge variant="destructive">{highRisk}</Badge>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No sessions this month</p>
                  <p className="text-sm text-muted-foreground mt-1">Sessions will appear here once recorded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
