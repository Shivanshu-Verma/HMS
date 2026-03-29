"use client";

import { useState } from "react";
import { useDemoStore } from "@/lib/demo-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, User, Phone, MapPin, Heart, Calendar } from "lucide-react";
import type { Patient } from "@/lib/types";

export default function PatientsPage() {
  const { patients, visits } = useDemoStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const filteredPatients = patients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.phone.includes(searchQuery)
  );

  const getPatientVisits = (patientId: string) => {
    return visits.filter((v) => v.patientId === patientId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">All Patients</h1>
        <p className="text-muted-foreground">
          View and manage all registered patients
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Patient Records</CardTitle>
              <CardDescription>
                {patients.length} patients registered
              </CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Age/Gender</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Addiction Type</TableHead>
                <TableHead>Total Visits</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient) => {
                const patientVisits = getPatientVisits(patient.id);
                return (
                  <TableRow
                    key={patient.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <TableCell>
                      <Badge variant="outline">{patient.patientId}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{patient.name}</TableCell>
                    <TableCell>
                      {patient.age} / {patient.gender.charAt(0).toUpperCase()}
                    </TableCell>
                    <TableCell>{patient.phone}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{patient.addictionType}</Badge>
                    </TableCell>
                    <TableCell>{patientVisits.length}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(patient.registeredAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredPatients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {searchQuery
                      ? "No patients found matching your search"
                      : "No patients registered yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Patient Details Dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>
              Complete patient profile and history
            </DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Full Name
                  </div>
                  <p className="font-medium text-foreground">{selectedPatient.name}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    Patient ID
                  </div>
                  <Badge variant="outline">{selectedPatient.patientId}</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    Phone
                  </div>
                  <p className="font-medium text-foreground">{selectedPatient.phone}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    Age / Gender
                  </div>
                  <p className="font-medium text-foreground">
                    {selectedPatient.age} years / {selectedPatient.gender}
                  </p>
                </div>
                <div className="space-y-1 col-span-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    Address
                  </div>
                  <p className="font-medium text-foreground">{selectedPatient.address}</p>
                </div>
              </div>

              {/* Medical Info */}
              <div className="space-y-3 rounded-lg border p-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  Medical Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Addiction Type:</span>
                    <Badge className="ml-2">{selectedPatient.addictionType}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Blood Group:</span>
                    <span className="ml-2 font-medium text-foreground">{selectedPatient.bloodGroup}</span>
                  </div>
                  {selectedPatient.medicalHistory && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Medical History:</span>
                      <p className="mt-1 text-foreground">{selectedPatient.medicalHistory}</p>
                    </div>
                  )}
                  {selectedPatient.allergies && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Allergies:</span>
                      <p className="mt-1 text-red-600">{selectedPatient.allergies}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-3 rounded-lg border p-4">
                <h4 className="font-semibold text-foreground">Emergency Contact</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <span className="ml-2 font-medium text-foreground">{selectedPatient.emergencyContact}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="ml-2 font-medium text-foreground">{selectedPatient.emergencyPhone}</span>
                  </div>
                </div>
              </div>

              {/* Visit History */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Visit History
                </h4>
                {getPatientVisits(selectedPatient.id).length > 0 ? (
                  <div className="space-y-2">
                    {getPatientVisits(selectedPatient.id).map((visit) => (
                      <div
                        key={visit.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {new Date(visit.checkInTime).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Check-in: {new Date(visit.checkInTime).toLocaleTimeString()}
                          </p>
                        </div>
                        <Badge
                          variant={visit.status === "completed" ? "default" : "secondary"}
                        >
                          {visit.status.replace("_", " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No visit history</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
