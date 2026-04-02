'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getPharmacyQueue, type PharmacyQueueItem } from '@/lib/hms-api';
import { useAuth } from '@/lib/auth-context';
import { store } from '@/lib/demo-store';
import { useDemoData } from '@/lib/runtime-mode';
import { Pill, Users, Package } from 'lucide-react';

interface QueueItem extends PharmacyQueueItem {}

function isQueueItem(value: unknown): value is QueueItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.session_id === 'string' &&
    typeof item.patient_id === 'string' &&
    typeof item.patient_name === 'string' &&
    typeof item.checked_in_at === 'string' &&
    typeof item.checked_in_by_name === 'string' &&
    typeof item.outstanding_debt === 'number' &&
    typeof item.session_status === 'string'
  );
}

export default function PharmacyQueuePage() {
  const { accessToken } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    if (useDemoData || !accessToken) {
      const demoQueue = store
        .getVisitsByStage('pharmacy')
        .map((visit) => {
          const patient = store.getPatientById(visit.patient_id);
          return {
            session_id: visit.id,
            patient_id: visit.patient_id,
            patient_name: patient?.full_name || 'Unknown',
            checked_in_at: visit.checkin_time || new Date().toISOString(),
            checked_in_by_name: 'Reception',
            outstanding_debt: 0,
            session_status: visit.status,
          };
        });
      setQueue(demoQueue);
      return;
    }

    getPharmacyQueue(accessToken)
      .then((res) => {
        const items = Array.isArray(res.items) ? res.items : [];
        const validated = items.filter(isQueueItem);
        setQueue(validated);
      })
      .catch(() => {
        const demoQueue = store
          .getVisitsByStage('pharmacy')
          .map((visit) => {
            const patient = store.getPatientById(visit.patient_id);
            return {
              session_id: visit.id,
              patient_id: visit.patient_id,
              patient_name: patient?.full_name || 'Unknown',
              checked_in_at: visit.checkin_time || new Date().toISOString(),
              checked_in_by_name: 'Reception',
              outstanding_debt: 0,
              session_status: visit.status,
            };
          });
        setQueue(demoQueue);
      });
  }, [accessToken]);

  const handleDispense = (sessionId: string) => {
    window.location.href = `/pharmacy/dispense/${sessionId}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Prescription Queue</h1>
        <p className="text-muted-foreground">
          {queue.length} prescription{queue.length !== 1 ? 's' : ''} pending dispense
        </p>
      </div>

      {/* Queue List */}
      <div className="space-y-4">
        {queue.length > 0 ? (
          queue.map((item, index) => (
            <Card key={item.session_id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {index + 1}
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{item.patient_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Session: {item.session_id}
                        </p>
                      </div>
                      <Button onClick={() => handleDispense(item.session_id)}>
                        <Package className="h-4 w-4 mr-2" />
                        Dispense
                      </Button>
                    </div>

                    {/* Queue Summary */}
                    <div className="grid gap-2">
                      <div className="flex items-center gap-2 text-sm p-2 rounded bg-secondary/50">
                        <Pill className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Checked in by: {item.checked_in_by_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm p-2 rounded bg-secondary/50">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Outstanding debt: Rs {item.outstanding_debt.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No active sessions in queue</p>
                <p className="text-sm">Patients will appear after reception check-in</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
