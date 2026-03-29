'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { store } from '@/lib/demo-store';
import type { Invoice, Patient } from '@/lib/types';
import { PaymentBadge } from '@/components/status-badge';
import { Search, FileText, Calendar } from 'lucide-react';

interface InvoiceWithPatient extends Invoice {
  patient: Patient;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithPatient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const allInvoices = store
      .getInvoices()
      .map((invoice) => ({
        ...invoice,
        patient: store.getPatientById(invoice.patient_id)!,
      }))
      .filter((i) => i.patient)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setInvoices(allInvoices);
  }, []);

  const filteredInvoices = invoices.filter((invoice) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      invoice.patient.full_name.toLowerCase().includes(query) ||
      invoice.invoice_number.toLowerCase().includes(query) ||
      invoice.patient.registration_number.toLowerCase().includes(query)
    );
  });

  const totalRevenue = invoices.reduce((sum, i) => sum + i.grand_total, 0);
  const todayInvoices = invoices.filter(
    (i) => i.invoice_date === new Date().toISOString().split('T')[0]
  );
  const todayRevenue = todayInvoices.reduce((sum, i) => sum + i.grand_total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Invoice History</h1>
        <p className="text-muted-foreground">View all generated invoices</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Invoices</p>
            <p className="text-2xl font-bold">{invoices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Today&apos;s Revenue</p>
            <p className="text-2xl font-bold">Rs. {todayRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold">Rs. {totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient or invoice number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Invoices List */}
      <div className="space-y-4">
        {filteredInvoices.length > 0 ? (
          filteredInvoices.map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{invoice.invoice_number}</h3>
                      <PaymentBadge status={invoice.payment_status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {invoice.patient.full_name} ({invoice.patient.registration_number})
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(invoice.invoice_date).toLocaleDateString()}
                      </span>
                      {invoice.payment_method && (
                        <span className="capitalize">{invoice.payment_method}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold">Rs. {invoice.grand_total.toFixed(2)}</p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Consultation: Rs. {invoice.consultation_fee.toFixed(2)}</p>
                      <p>Medicines: Rs. {invoice.medicine_total.toFixed(2)}</p>
                      {invoice.discount > 0 && (
                        <p className="text-emerald-600">Discount: -Rs. {invoice.discount.toFixed(2)}</p>
                      )}
                      <p>Tax: Rs. {invoice.tax.toFixed(2)}</p>
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
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No invoices found</p>
                <p className="text-sm">
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Invoices will appear here after dispensing'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
