'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { patientsApi, visitsApi } from '@/lib/api-client';
import { checkRDService, simulateFingerprint, type RDServiceInfo } from '@/lib/biometric';
import type { Patient, Visit } from '@/lib/types';
import { PatientCard } from '@/components/patient-card';
import { toast } from 'sonner';
import {
  Fingerprint,
  Search,
  AlertCircle,
  CheckCircle,
  Loader2,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';

export default function CheckinPage() {
  const router = useRouter();
  const [rdService, setRdService] = useState<RDServiceInfo | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Check RD Service status on mount
  useEffect(() => {
    checkRDService().then(setRdService);
  }, []);

  // Search patients
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const result = await patientsApi.search(searchQuery);
      if (result.success && result.data?.items) {
        setSearchResults(result.data.items);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    }
    setSelectedPatient(null);
  };

  // Simulate fingerprint scan
  const handleFingerprintScan = async () => {
    setIsScanning(true);
    
    const result = await simulateFingerprint();
    
    if (result.success && result.data) {
      try {
        const lookupResult = await patientsApi.lookupFingerprint(result.data);
        if (lookupResult.success && lookupResult.data) {
          toast.success('Fingerprint matched!');
          setSelectedPatient(lookupResult.data as any);
        } else {
          toast.info('No matching patient found. Please register new patient.');
        }
      } catch {
        toast.info('No matching patient found. Please register new patient.');
      }
    } else {
      toast.error(result.error || 'Fingerprint scan failed');
    }
    
    setIsScanning(false);
  };

  // Check in patient
  const handleCheckin = async () => {
    if (!selectedPatient) return;

    setIsCheckingIn(true);

    try {
      const result = await visitsApi.create(selectedPatient.id);
      if (result.success) {
        toast.success(`${selectedPatient.full_name} checked in successfully!`);
        setSelectedPatient(null);
        setSearchQuery('');
        setSearchResults([]);
      } else {
        toast.error('Check-in failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Check-in failed');
    }

    setIsCheckingIn(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Patient Check-in</h1>
          <p className="text-muted-foreground">
            Scan fingerprint or search to check in a patient
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/reception/register">
            <UserPlus className="h-4 w-4 mr-2" />
            Register New Patient
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Check-in Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Find Patient</CardTitle>
            <CardDescription>
              Use fingerprint scanner or search by name/ID/phone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="fingerprint" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="fingerprint">Fingerprint</TabsTrigger>
                <TabsTrigger value="search">Manual Search</TabsTrigger>
              </TabsList>

              {/* Fingerprint Tab */}
              <TabsContent value="fingerprint" className="space-y-4">
                {/* RD Service Status */}
                {rdService && !rdService.available && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {rdService.error || 'Fingerprint scanner not detected'}.
                      Using demo mode.
                    </AlertDescription>
                  </Alert>
                )}

                {rdService?.available && rdService.deviceInfo && (
                  <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      {rdService.deviceInfo.name} connected (
                      {rdService.deviceInfo.status})
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col items-center py-8 space-y-4">
                  <div
                    className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                      isScanning
                        ? 'bg-primary/20 animate-pulse'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    {isScanning ? (
                      <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    ) : (
                      <Fingerprint className="h-12 w-12 text-primary" />
                    )}
                  </div>

                  <Button
                    size="lg"
                    onClick={handleFingerprintScan}
                    disabled={isScanning}
                  >
                    {isScanning ? 'Scanning...' : 'Scan Fingerprint'}
                  </Button>

                  <p className="text-sm text-muted-foreground text-center">
                    Place finger on the scanner and click the button
                  </p>
                </div>
              </TabsContent>

              {/* Manual Search Tab */}
              <TabsContent value="search" className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="search" className="sr-only">
                      Search
                    </Label>
                    <Input
                      id="search"
                      placeholder="Enter name, ID, or phone number"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                  <Button onClick={handleSearch}>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>

                {/* Search Results */}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    searchResults.map((patient) => (
                      <div
                        key={patient.id}
                        onClick={() => setSelectedPatient(patient)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPatient?.id === patient.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <p className="font-medium">{patient.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {patient.registration_number} | {patient.phone}
                        </p>
                      </div>
                    ))
                  ) : searchQuery && searchResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No patients found</p>
                      <Button asChild variant="link" className="mt-2">
                        <Link href="/reception/register">Register New Patient</Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Selected Patient / Check-in Confirmation */}
        <Card>
          <CardHeader>
            <CardTitle>Check-in Confirmation</CardTitle>
            <CardDescription>
              Verify patient details and proceed with check-in
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedPatient ? (
              <div className="space-y-4">
                <PatientCard patient={selectedPatient} showStage={false} />

                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Date of Birth</span>
                    <span>
                      {new Date(selectedPatient.date_of_birth).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Addiction Type</span>
                    <span className="capitalize">{selectedPatient.addiction_type}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Emergency Contact</span>
                    <span>{selectedPatient.emergency_contact_name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Status</span>
                    <span className="capitalize">{selectedPatient.status}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedPatient(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleCheckin}
                    disabled={isCheckingIn}
                  >
                    {isCheckingIn ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Checking In...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirm Check-in
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Fingerprint className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Scan fingerprint or search for a patient to check in
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
