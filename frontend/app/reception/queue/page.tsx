'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getReceptionReports } from '@/lib/hms-api';
import { useAuth } from '@/lib/auth-context';

export default function ReceptionQueuePage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!accessToken) return;
    getReceptionReports(accessToken).then(setData).catch(() => setData(null));
  }, [accessToken]);

  const daily = data?.daily?.total_checkins || 0;
  const monthly = data?.monthly?.total_checkins || 0;
  const yearly = data?.yearly?.total_checkins || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Operations Snapshot</h1>
        <p className="text-muted-foreground">Reception queue is now represented by check-in throughput metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Today</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{daily}</p><p className="text-muted-foreground text-sm">Check-ins</p></CardContent></Card>
        <Card><CardHeader><CardTitle>This Month</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{monthly}</p><p className="text-muted-foreground text-sm">Check-ins</p></CardContent></Card>
        <Card><CardHeader><CardTitle>This Year</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{yearly}</p><p className="text-muted-foreground text-sm">Check-ins</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Legacy multi-stage queue tracking is removed in the new backend flow. Reception is responsible for registration and check-in only; active sessions then move directly to pharmacy.
        </CardContent>
      </Card>
    </div>
  );
}
