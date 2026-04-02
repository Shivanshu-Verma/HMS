'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CounsellorSession, Patient } from '@/lib/types';
import { RiskBadge } from '@/components/status-badge';
import { Search, FileText, Calendar, Clock } from 'lucide-react';

interface SessionWithPatient extends CounsellorSession {
  patient: Patient;
}

export default function SessionHistoryPage() {
  const [sessions, setSessions] = useState<SessionWithPatient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Session history needs a dedicated backend endpoint
    setSessions([]);
  }, []);

  const filteredSessions = sessions.filter((session) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.patient.full_name.toLowerCase().includes(query) ||
      session.patient.registration_number.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Session History</h1>
        <p className="text-muted-foreground">View past counselling sessions</p>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {filteredSessions.length > 0 ? (
          filteredSessions.map((session) => (
            <Card key={session.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {session.patient.full_name}
                    </CardTitle>
                    <CardDescription>
                      {session.patient.registration_number}
                    </CardDescription>
                  </div>
                  <RiskBadge level={session.risk_level} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(session.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {session.session_duration_minutes || 0} minutes
                    </div>
                    <div>Mood: {session.mood_assessment}/10</div>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-sm">{session.session_notes}</p>
                  </div>

                  {session.recommendations && (
                    <div>
                      <p className="text-sm font-medium mb-1">Recommendations</p>
                      <p className="text-sm text-muted-foreground">
                        {session.recommendations}
                      </p>
                    </div>
                  )}

                  {session.follow_up_required && (
                    <p className="text-sm text-primary">Follow-up required</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No sessions found</p>
                <p className="text-sm">
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Sessions will appear here after completion'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
