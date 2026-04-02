'use client';

import { useEffect, useState, useRef } from 'react';
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
import { store, generateId, generateInvoiceNumber } from '@/lib/demo-store';
import { useAuth } from '@/lib/auth-context';
import { useDemoData } from '@/lib/runtime-mode';
import {
  checkoutPharmacySession,
  getPharmacySessionDetail,
  submitPharmacyDispense,
  type PharmacyCheckoutResponse,
  type PharmacyPaymentMethod,
} from '@/lib/hms-api';
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
import { navigate } from '@/lib/navigation';

interface PrescriptionWithMedicine extends Prescription {
  medicine?: Medicine;
  selected: boolean;
}

interface CheckoutReceipt {
  invoice_number: string;
  invoice_date: string;
  payment_method: PharmacyPaymentMethod;
  medicines_total: number;
  total_charged: number;
  cash_amount: number;
  online_amount: number;
  new_debt: number;
  debt_before: number;
  debt_after: number;
}

export default function DispensePage({ params }: { params: Promise<{ visitId: string }> }) {
  const [visitId, setVisitId] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);
  const { user, accessToken } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const [visit, setVisit] = useState<Visit | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultation, setConsultation] = useState<DoctorConsultation | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionWithMedicine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [checkoutReceipt, setCheckoutReceipt] = useState<CheckoutReceipt | null>(null);
  const [outstandingDebt, setOutstandingDebt] = useState(0);
  const [splitCashAmount, setSplitCashAmount] = useState(0);

  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PharmacyPaymentMethod>('cash');

  // Get params safely after mount
  useEffect(() => {
    setIsMounted(true);
    params.then((p) => setVisitId(p.visitId));
  }, [params]);

  useEffect(() => {
    if (!visitId) return;
    if (useDemoData || !accessToken) {
      const visitData = store.getVisitById(visitId);
      if (visitData) {
        setVisit(visitData);
        const patientData = store.getPatientById(visitData.patient_id);
        if (patientData) {
          setPatient(patientData);
        }
        const consultationData = store.getConsultationByVisit(visitId);
        if (consultationData) {
          setConsultation(consultationData);
        }

        const prescriptionData = store.getPrescriptionsByVisit(visitId).map((p) => ({
          ...p,
          medicine: store.getMedicineById(p.medicine_id),
          selected: true,
        }));
        setPrescriptions(prescriptionData);
      }
      return;
    }

    getPharmacySessionDetail(accessToken, visitId)
      .then((session) => {
        setOutstandingDebt(session.outstanding_debt || 0);
        setVisit({
          id: session.session_id,
          patient_id: session.patient.patient_id,
          visit_date: new Date().toISOString().split('T')[0],
          visit_number: 1,
          current_stage: 'pharmacy',
          status: 'in_progress',
        });

        setPatient({
          id: session.patient.patient_id,
          registration_number: session.patient.registration_number,
          patient_category: 'deaddiction',
          full_name: session.patient.full_name,
          date_of_birth: session.patient.date_of_birth,
          gender: session.patient.sex,
          phone: session.patient.phone_number,
          address: '',
          city: '',
          state: '',
          pincode: '',
          addiction_type: 'other',
          first_visit_date: new Date().toISOString().split('T')[0],
          emergency_contact_name: '',
          emergency_contact_phone: '',
          emergency_contact_relation: '',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        setConsultation(null);

        const dispenseRows: PrescriptionWithMedicine[] = session.dispense_items.map((item, index) => ({
          id: `session-item-${index}`,
          consultation_id: '',
          visit_id: session.session_id,
          patient_id: session.patient.patient_id,
          medicine_id: item.medicine_id,
          quantity: item.quantity,
          dosage: '-',
          frequency: 'as_needed',
          duration_days: 1,
          dispensed: false,
          selected: true,
          medicine: {
            id: item.medicine_id,
            name: item.medicine_name,
            unit: 'tablet',
            price_per_unit: item.unit_price,
            stock_quantity: 0,
            reorder_level: 0,
            is_active: true,
            created_at: new Date().toISOString(),
          },
        }));
        setPrescriptions(dispenseRows);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load session details');
      });
  }, [visitId, accessToken]);

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

    if (useDemoData || !accessToken) {
      const consultationFee = 500;
      const subtotal = consultationFee + medicineTotal;
      const discountAmount = (subtotal * discount) / 100;
      const afterDiscount = subtotal - discountAmount;
      const tax = afterDiscount * 0.05;
      const grandTotal = afterDiscount + tax;

      return {
        consultationFee,
        medicineTotal,
        subtotal,
        discountAmount,
        tax,
        grandTotal,
        totalDue: grandTotal,
      };
    }

    const totalDue = medicineTotal + outstandingDebt;

    return {
      consultationFee: 0,
      medicineTotal,
      subtotal: medicineTotal,
      discountAmount: 0,
      tax: 0,
      grandTotal: totalDue,
      totalDue,
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

    if (!useDemoData && accessToken) {
      try {
        const dispensePayload = {
          items: selectedPrescriptions.map((p) => ({
            medicine_id: p.medicine_id,
            quantity: p.quantity,
            unit_price: p.medicine?.price_per_unit || 0,
          })),
        };

        const dispenseResult = await submitPharmacyDispense(accessToken, visit.id, dispensePayload);
        const totalDue = (dispenseResult.medicines_total || 0) + outstandingDebt;

        let cashAmount = 0;
        let onlineAmount = 0;
        let newDebt = 0;
        let debtCleared = 0;

        if (paymentMethod === 'cash') {
          cashAmount = totalDue;
          debtCleared = outstandingDebt;
        } else if (paymentMethod === 'online') {
          onlineAmount = totalDue;
          debtCleared = outstandingDebt;
        } else if (paymentMethod === 'split') {
          const splitCash = Math.min(Math.max(splitCashAmount || 0, 0), totalDue);
          cashAmount = splitCash;
          onlineAmount = totalDue - splitCash;
          debtCleared = outstandingDebt;
        } else {
          newDebt = totalDue;
        }

        const checkoutResult: PharmacyCheckoutResponse = await checkoutPharmacySession(accessToken, visit.id, {
          method: paymentMethod,
          cash_amount: cashAmount,
          online_amount: onlineAmount,
          debt_cleared: debtCleared,
          new_debt: newDebt,
        });

        const invoiceNo = `INV-${checkoutResult.visit_id.slice(-8).toUpperCase()}`;
        setCheckoutReceipt({
          invoice_number: invoiceNo,
          invoice_date: checkoutResult.visit_date,
          payment_method: checkoutResult.payment.method,
          medicines_total: checkoutResult.medicines_total,
          total_charged: checkoutResult.payment.total_charged,
          cash_amount: checkoutResult.payment.cash_amount,
          online_amount: checkoutResult.payment.online_amount,
          new_debt: checkoutResult.payment.new_debt,
          debt_before: checkoutResult.debt_snapshot.debt_before,
          debt_after: checkoutResult.debt_snapshot.debt_after,
        });
        setShowInvoice(true);
        toast.success('Dispense and checkout completed successfully.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Checkout failed');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const totals = calculateTotals();

    // Create invoice
    const newInvoice: Invoice = {
      id: generateId(),
      visit_id: visit.id,
      patient_id: patient.id,
      invoice_number: generateInvoiceNumber(),
      invoice_date: new Date().toISOString().split('T')[0],
      consultation_fee: totals.consultationFee,
      medicine_total: totals.medicineTotal,
      discount: totals.discountAmount,
      tax: totals.tax,
      grand_total: totals.grandTotal,
      payment_status: 'paid',
      payment_method: paymentMethod,
      created_at: new Date().toISOString(),
    };

    store.addInvoice(newInvoice);
    setInvoice(newInvoice);

    // Mark prescriptions as dispensed and update inventory
    selectedPrescriptions.forEach((p) => {
      store.updatePrescription(p.id, {
        dispensed: true,
        dispensed_at: new Date().toISOString(),
      });

      // Deduct from inventory
      if (p.medicine) {
        store.addInventoryTransaction({
          id: generateId(),
          medicine_id: p.medicine_id,
          transaction_type: 'out',
          quantity: p.quantity,
          reference_id: p.id,
          performed_by: user.id,
          notes: `Dispensed for patient ${patient.full_name}`,
          created_at: new Date().toISOString(),
        });
      }
    });

    // Update visit to completed
    store.updateVisit(visit.id, {
      current_stage: 'completed',
      pharmacy_time: new Date().toISOString(),
      completed_time: new Date().toISOString(),
      pharmacist_id: user.id,
      status: 'completed',
    });

    setIsSubmitting(false);
    setShowInvoice(true);
    toast.success('Medicines dispensed! Invoice generated.');
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const invoiceNumber = checkoutReceipt?.invoice_number || invoice?.invoice_number;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${invoiceNumber || '-'}</title>
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
  if (showInvoice && (invoice || checkoutReceipt)) {
    const invoiceNumber = checkoutReceipt?.invoice_number || invoice?.invoice_number || '-';
    const invoiceDate = checkoutReceipt?.invoice_date || invoice?.invoice_date || new Date().toISOString();
    const paymentLabel = (checkoutReceipt?.payment_method || invoice?.payment_method || 'cash').toUpperCase();

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
<Button variant="ghost" size="icon" onClick={() => navigate('/pharmacy')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Invoice Generated</h1>
              <p className="text-muted-foreground">Invoice #{invoiceNumber}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Invoice
            </Button>
<Button onClick={() => navigate('/pharmacy')}>
                      <Check className="h-4 w-4 mr-2" />
                      Done
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
                <p><strong>Invoice No:</strong> {invoiceNumber}</p>
                <p><strong>Date:</strong> {new Date(invoiceDate).toLocaleDateString()}</p>
                <p><strong>Payment:</strong> {paymentLabel}</p>
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
              <p>Medicine Total: Rs. {(checkoutReceipt?.medicines_total ?? totals.medicineTotal).toFixed(2)}</p>
              {useDemoData && totals.discountAmount > 0 && (
                <p>Discount ({discount}%): -Rs. {totals.discountAmount.toFixed(2)}</p>
              )}
              {useDemoData && <p>GST (5%): Rs. {totals.tax.toFixed(2)}</p>}
              {!useDemoData && (
                <>
                  <p>Outstanding Debt Before: Rs. {(checkoutReceipt?.debt_before ?? outstandingDebt).toFixed(2)}</p>
                  <p>Paid in Cash: Rs. {(checkoutReceipt?.cash_amount ?? 0).toFixed(2)}</p>
                  <p>Paid Online: Rs. {(checkoutReceipt?.online_amount ?? 0).toFixed(2)}</p>
                  <p>New Debt Added: Rs. {(checkoutReceipt?.new_debt ?? 0).toFixed(2)}</p>
                </>
              )}
              <p className="text-lg font-bold pt-2 border-t">
                Grand Total: Rs. {(checkoutReceipt?.total_charged ?? totals.grandTotal).toFixed(2)}
              </p>
              {!useDemoData && <p>Outstanding Debt After: Rs. {(checkoutReceipt?.debt_after ?? outstandingDebt).toFixed(2)}</p>}
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
<Button variant="ghost" size="icon" onClick={() => navigate('/pharmacy/queue')}>
                    <ArrowLeft className="h-4 w-4" />
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
                {(useDemoData || !accessToken) && (
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
                )}
                <div>
                  <Label htmlFor="payment">Payment Method</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as PharmacyPaymentMethod)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="split">Split</SelectItem>
                      <SelectItem value="debt">Debt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!useDemoData && paymentMethod === 'split' && (
                <div>
                  <Label htmlFor="splitCashAmount">Cash Amount (for split payment)</Label>
                  <Input
                    id="splitCashAmount"
                    type="number"
                    min={0}
                    max={totals.totalDue}
                    value={splitCashAmount}
                    onChange={(e) => setSplitCashAmount(parseFloat(e.target.value) || 0)}
                    placeholder="Enter cash amount"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Remaining amount will be paid online.
                  </p>
                </div>
              )}

              {/* Totals */}
              <div className="pt-4 border-t space-y-2 text-sm">
                {(useDemoData || !accessToken) && (
                  <div className="flex justify-between">
                    <span>Consultation Fee</span>
                    <span>Rs. {totals.consultationFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Medicine Total</span>
                  <span>Rs. {totals.medicineTotal.toFixed(2)}</span>
                </div>
                {(useDemoData || !accessToken) && (
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>Rs. {totals.subtotal.toFixed(2)}</span>
                  </div>
                )}
                {(useDemoData || !accessToken) && totals.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount ({discount}%)</span>
                    <span>-Rs. {totals.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {(useDemoData || !accessToken) && (
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span>Rs. {totals.tax.toFixed(2)}</span>
                  </div>
                )}
                {!useDemoData && (
                  <div className="flex justify-between">
                    <span>Outstanding Debt</span>
                    <span>Rs. {outstandingDebt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>{useDemoData || !accessToken ? 'Grand Total' : 'Total Due'}</span>
                  <span>Rs. {(useDemoData || !accessToken ? totals.grandTotal : totals.totalDue).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
<Button variant="outline" onClick={() => navigate('/pharmacy/queue')}>
                      Cancel
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
