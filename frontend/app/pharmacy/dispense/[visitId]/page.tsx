'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { pharmacyApi } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Visit, Patient, Prescription, Medicine, Invoice, PaymentMethod, DoctorConsultation } from '@/lib/types';
import { PatientCard } from '@/components/patient-card';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Pill,
  FileText,
  Printer,
  Send,
  Loader2,
  Check,
} from 'lucide-react';
import Link from 'next/link';

interface PrescriptionWithMedicine extends Prescription {
  medicine?: Medicine;
  selected: boolean;
}

const CONSULTATION_FEE = 500;

export default function DispensePage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const visitId = params.visitId as string;
  const printRef = useRef<HTMLDivElement>(null);

  const [visit, setVisit] = useState<Visit | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultation, setConsultation] = useState<DoctorConsultation | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionWithMedicine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await pharmacyApi.getDispenseDetail(visitId);
        if (result.success && result.data) {
          const v = result.data;
          setVisit({
            id: v.id,
            patient_id: v.patient_id,
            visit_date: v.visit_date?.split('T')[0] || '',
            visit_number: v.visit_number,
            current_stage: v.current_stage,
            checkin_time: v.checkin_time,
            status: v.status,
          });
          if (v.patient) {
            setPatient(v.patient as any);
          }
          if (v.doctor_stage) {
            setConsultation({
              id: v.id,
              visit_id: v.id,
              patient_id: v.patient_id,
              doctor_id: '',
              diagnosis: v.doctor_stage.diagnosis,
              treatment_plan: v.doctor_stage.treatment_plan,
              clinical_notes: v.doctor_stage.clinical_notes,
              created_at: v.doctor_stage.completed_at || '',
            });
          }
          const rxData = (v.doctor_stage?.prescriptions || []).map((p: any) => ({
            id: p.id || p.medicine_id,
            consultation_id: '',
            visit_id: v.id,
            patient_id: v.patient_id,
            medicine_id: p.medicine_id,
            quantity: p.quantity,
            dosage: p.dosage,
            frequency: p.frequency,
            duration_days: p.duration_days,
            instructions: p.instructions || '',
            dispensed: false,
            medicine: {
              id: p.medicine_id,
              name: p.medicine_name || 'Unknown',
              unit: p.medicine_unit || 'tablet',
              price_per_unit: p.price_per_unit || 0,
              stock_quantity: p.stock_quantity || 0,
            } as any,
            selected: true,
          }));
          setPrescriptions(rxData);
        }
      } catch (err) {
        console.error('Failed to load dispense details:', err);
      }
    };
    fetchData();
  }, [visitId]);

  const togglePrescription = (index: number) => {
    const updated = [...prescriptions];
    updated[index].selected = !updated[index].selected;
    setPrescriptions(updated);
  };

  const calculateTotals = () => {
    const selectedPrescriptions = prescriptions.filter((p) => p.selected);
    const medicineTotal = selectedPrescriptions.reduce((sum, p) => {
      const price = p.medicine?.price_per_unit || 0;
      return sum + price * p.quantity;
    }, 0);

    const subtotal = CONSULTATION_FEE + medicineTotal;
    const discountAmount = (subtotal * discount) / 100;
    const afterDiscount = subtotal - discountAmount;
    const tax = afterDiscount * 0.05; // 5% GST
    const grandTotal = afterDiscount + tax;

    return {
      consultationFee: CONSULTATION_FEE,
      medicineTotal,
      subtotal,
      discountAmount,
      tax,
      grandTotal,
    };
  };

  const handleDispense = async () => {
    if (!visit || !patient || !user) return;

    const selectedPrescriptions = prescriptions.filter((p) => p.selected);
    if (selectedPrescriptions.length === 0) {
      toast.error('Please select at least one medicine to dispense');
      return;
    }

    setIsSubmitting(true);

    try {
      // Dispense via API
      const dispenseItems = prescriptions
        .filter((p) => p.selected)
        .map((p) => ({
          medicine_id: p.medicine_id,
          quantity_dispensed: p.quantity,
          selected: true,
        }));

      await pharmacyApi.dispense(visitId, {
        items: dispenseItems,
        dispensing_notes: '',
      });

      // Close visit
      await pharmacyApi.closeVisit(visitId);

      const totals = calculateTotals();
      setInvoice({
        id: visitId,
        visit_id: visitId,
        patient_id: patient.id,
        invoice_number: `INV-${Date.now()}`,
        invoice_date: new Date().toISOString().split('T')[0],
        consultation_fee: totals.consultationFee,
        medicine_total: totals.medicineTotal,
        discount: totals.discountAmount,
        tax: totals.tax,
        grand_total: totals.grandTotal,
        payment_status: 'paid',
        payment_method: paymentMethod,
        created_at: new Date().toISOString(),
      });

      setIsSubmitting(false);
      setShowInvoice(true);
      toast.success('Medicines dispensed! Visit completed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispense');
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${invoice?.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .details { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .totals { text-align: right; }
            .grand-total { font-size: 1.2em; font-weight: bold; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (!visit || !patient) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const totals = calculateTotals();

  // Invoice View
  if (showInvoice && invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/pharmacy">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Invoice Generated</h1>
              <p className="text-muted-foreground">Invoice #{invoice.invoice_number}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Invoice
            </Button>
            <Button asChild>
              <Link href="/pharmacy">
                <Check className="h-4 w-4 mr-2" />
                Done
              </Link>
            </Button>
          </div>
        </div>

        {/* Printable Invoice */}
        <Card>
          <CardContent className="p-6" ref={printRef}>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">De-Addiction Center</h2>
              <p className="text-muted-foreground">Tax Invoice</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p><strong>Patient:</strong> {patient.full_name}</p>
                <p><strong>Reg No:</strong> {patient.registration_number}</p>
                <p><strong>Phone:</strong> {patient.phone}</p>
              </div>
              <div className="text-right">
                <p><strong>Invoice No:</strong> {invoice.invoice_number}</p>
                <p><strong>Date:</strong> {new Date(invoice.invoice_date).toLocaleDateString()}</p>
                <p><strong>Payment:</strong> {invoice.payment_method?.toUpperCase()}</p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Consultation Fee</TableCell>
                  <TableCell className="text-right">1</TableCell>
                  <TableCell className="text-right">Rs. {CONSULTATION_FEE.toFixed(2)}</TableCell>
                  <TableCell className="text-right">Rs. {CONSULTATION_FEE.toFixed(2)}</TableCell>
                </TableRow>
                {prescriptions
                  .filter((p) => p.selected)
                  .map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.medicine?.name || 'Medicine'}</TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                      <TableCell className="text-right">
                        Rs. {(p.medicine?.price_per_unit || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        Rs. {((p.medicine?.price_per_unit || 0) * p.quantity).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            <div className="mt-4 space-y-1 text-right text-sm">
              <p>Subtotal: Rs. {totals.subtotal.toFixed(2)}</p>
              {totals.discountAmount > 0 && (
                <p>Discount ({discount}%): -Rs. {totals.discountAmount.toFixed(2)}</p>
              )}
              <p>GST (5%): Rs. {totals.tax.toFixed(2)}</p>
              <p className="text-lg font-bold pt-2 border-t">
                Grand Total: Rs. {totals.grandTotal.toFixed(2)}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
              <p>Thank you for your visit. Get well soon!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/pharmacy/queue">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dispense Medicines</h1>
          <p className="text-muted-foreground">Dispense for {patient.full_name}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Prescriptions */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Prescription</CardTitle>
              </div>
              <CardDescription>Select medicines to dispense</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Dosage</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prescriptions.map((p, index) => (
                    <TableRow key={p.id} className={!p.selected ? 'opacity-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={p.selected}
                          onCheckedChange={() => togglePrescription(index)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {p.medicine?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>{p.dosage}</TableCell>
                      <TableCell>{p.frequency.replace('_', ' ')}</TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                      <TableCell className="text-right">
                        Rs. {(p.medicine?.price_per_unit || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        Rs. {((p.medicine?.price_per_unit || 0) * p.quantity).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {prescriptions.some(p => p.instructions) && (
                <div className="mt-4 p-3 bg-secondary/50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Instructions:</p>
                  {prescriptions.filter(p => p.instructions).map(p => (
                    <p key={p.id} className="text-sm text-muted-foreground">
                      <strong>{p.medicine?.name}:</strong> {p.instructions}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Payment Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="discount">Discount (%)</Label>
                  <Input
                    id="discount"
                    type="number"
                    min={0}
                    max={100}
                    value={discount}
                    onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="payment">Payment Method</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Totals */}
              <div className="pt-4 border-t space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Consultation Fee</span>
                  <span>Rs. {totals.consultationFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Medicine Total</span>
                  <span>Rs. {totals.medicineTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rs. {totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount ({discount}%)</span>
                    <span>-Rs. {totals.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST (5%)</span>
                  <span>Rs. {totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Grand Total</span>
                  <span>Rs. {totals.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link href="/pharmacy/queue">Cancel</Link>
            </Button>
            <Button onClick={handleDispense} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Dispense & Generate Invoice
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <PatientCard patient={patient} showStage={false} />

          {consultation && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Doctor Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Diagnosis</p>
                  <p>{consultation.diagnosis}</p>
                </div>
                {consultation.treatment_plan && (
                  <div>
                    <p className="text-muted-foreground mb-1">Treatment Plan</p>
                    <p>{consultation.treatment_plan}</p>
                  </div>
                )}
                {consultation.next_visit_date && (
                  <div className="pt-2 border-t">
                    <p className="text-primary">
                      Next visit: {new Date(consultation.next_visit_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
