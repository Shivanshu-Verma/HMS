'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pharmacyApi } from '@/lib/api-client';
import type { Visit, Patient, Prescription, Medicine } from '@/lib/types';
import { Pill, Users, Package } from 'lucide-react';

interface PrescriptionQueue {
  visit: Visit;
  patient: Patient;
  prescriptions: (Prescription & { medicine?: Medicine })[];
}

export default function PharmacyQueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<PrescriptionQueue[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await pharmacyApi.getQueue();
        if (result.success && result.data?.items) {
          const mapped = result.data.items.map((v: any) => ({
            visit: {
              id: v.id,
              patient_id: v.patient_id,
              visit_date: v.visit_date?.split('T')[0] || '',
              visit_number: v.visit_number,
              current_stage: v.current_stage,
              checkin_time: v.checkin_time,
              status: v.status,
            },
            patient: v.patient || { id: v.patient_id, full_name: 'Unknown', registration_number: '' },
            prescriptions: (v.doctor_stage?.prescriptions || []).map((p: any) => ({
              id: p.id || p.medicine_id,
              medicine_id: p.medicine_id,
              dosage: p.dosage,
              frequency: p.frequency,
              quantity: p.quantity,
              medicine: { name: p.medicine_name, unit: p.medicine_unit },
            })),
          }));
          setQueue(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch queue:', err);
      }
    };
    fetchData();
  }, []);

  const handleDispense = (visitId: string) => {
    router.push(`/pharmacy/dispense/${visitId}`);
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
          queue.map(({ visit, patient, prescriptions }, index) => (
            <Card key={visit.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {index + 1}
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{patient.full_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {patient.registration_number}
                        </p>
                      </div>
                      <Button onClick={() => handleDispense(visit.id)}>
                        <Package className="h-4 w-4 mr-2" />
                        Dispense
                      </Button>
                    </div>

                    {/* Prescription Preview */}
                    <div className="grid gap-2">
                      {prescriptions.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 text-sm p-2 rounded bg-secondary/50"
                        >
                          <Pill className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {p.medicine?.name || 'Unknown'}
                          </span>
                          <span className="text-muted-foreground">
                            - {p.quantity} {p.medicine?.unit}s
                          </span>
                        </div>
                      ))}
                      {prescriptions.length > 3 && (
                        <p className="text-sm text-muted-foreground pl-2">
                          +{prescriptions.length - 3} more medicines
                        </p>
                      )}
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
                <p className="text-lg font-medium">No prescriptions pending</p>
                <p className="text-sm">Prescriptions will appear after doctor consultation</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
