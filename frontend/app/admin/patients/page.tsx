"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from '@/lib/auth-context';
import { getPatientsList } from '@/lib/hms-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Phone,
  MapPin,
  Heart,
  Calendar,
  Download,
  Search,
  Edit,
  Trash2,
  MoreVertical,
  Eye,
  Brain,
  UserCheck,
  Filter,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Patient, PatientCategory } from "@/lib/types";

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PatientCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "discharged">("all");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);

  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;
    getPatientsList(accessToken)
      .then((data) => {
        const mapped = data.items.map((item: any) => ({
          id: item.id || item._id,
          registration_number: item.registration_number || '',
          patient_category: item.patient_category || 'deaddiction',
          full_name: item.full_name || '',
          date_of_birth: item.date_of_birth || item.dob || '',
          gender: item.gender || 'other',
          phone: item.phone_number || item.phone || '',
          address: item.address || '',
          city: item.city || '',
          state: item.state || '',
          pincode: item.pincode || '',
          addiction_type: item.addiction_type || 'other',
          first_visit_date: item.registration_date || '',
          emergency_contact_name: item.emergency_contact_name || '',
          emergency_contact_phone: item.emergency_contact_phone || '',
          emergency_contact_relation: item.emergency_contact_relation || '',
          status: item.status || 'active',
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
          aadhaar_number: item.aadhaar_number || '',
          blood_group: item.blood_group || '',
          medical_history: item.medical_history || '',
          allergies: item.allergies || '',
          addiction_duration: item.addiction_duration || '',
        } as Patient));
        setPatients(mapped);
      })
      .catch(() => setPatients([]));
  }, [accessToken]);

  const visits: any[] = [];

  // Filter patients
  const filteredPatients = useMemo(() => {
    let result = patients;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.full_name.toLowerCase().includes(query) ||
        p.registration_number.toLowerCase().includes(query) ||
        p.phone.includes(query) ||
        p.aadhaar_number?.includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter(p => p.patient_category === categoryFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(p => p.status === statusFilter);
    }

    return result;
  }, [patients, searchQuery, categoryFilter, statusFilter]);

  const getPatientVisits = (patientId: string) => {
    return visits.filter(v => v.patient_id === patientId);
  };

  const handleViewPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsViewOpen(true);
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatient({ ...patient });
    setIsEditOpen(true);
  };

  const handleSavePatient = () => {
    if (!editingPatient) return;
    // Update local state (backend endpoint needed for persistence)
    setPatients(prev => prev.map(p => p.id === editingPatient.id ? editingPatient : p));
    toast.success("Patient updated successfully");
    setIsEditOpen(false);
    setEditingPatient(null);
  };

  const handleDeleteConfirm = () => {
    if (!patientToDelete) return;
    // Update local state (backend endpoint needed for persistence)
    setPatients(prev => prev.filter(p => p.id !== patientToDelete.id));
    toast.success("Patient deleted successfully");
    setIsDeleteOpen(false);
    setPatientToDelete(null);
  };

  const getCategoryBadge = (category?: PatientCategory) => {
    if (category === "psychiatric") {
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Psychiatric</Badge>;
    } else if (category === "deaddiction") {
      return <Badge className="bg-sky-100 text-sky-800 border-sky-200">De-Addiction</Badge>;
    }
    return <Badge variant="outline">N/A</Badge>;
  };

  const getStatusBadge = (status?: string) => {
    if (status === "active") {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    } else if (status === "inactive") {
      return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
    } else if (status === "discharged") {
      return <Badge className="bg-blue-100 text-blue-800">Discharged</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  // Statistics
  const stats = useMemo(() => ({
    total: patients.length,
    psychiatric: patients.filter(p => p.patient_category === "psychiatric").length,
    deaddiction: patients.filter(p => p.patient_category === "deaddiction").length,
    active: patients.filter(p => p.status === "active").length,
  }), [patients]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Patient Management</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all patient records
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Data
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Patients</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Psychiatric</p>
                <p className="text-2xl font-bold">{stats.psychiatric}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-100">
                <Heart className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">De-Addiction</p>
                <p className="text-2xl font-bold">{stats.deaddiction}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-[180px]">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as PatientCategory | "all")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="psychiatric">Psychiatric</SelectItem>
                  <SelectItem value="deaddiction">De-Addiction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="discharged">Discharged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setStatusFilter("all"); }}>
              <Filter className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Patient Table */}
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle>Patient Records</CardTitle>
          <CardDescription>
            Showing {filteredPatients.length} of {patients.length} patients
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Reg. No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Age/Gender</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient) => {
                const patientVisits = getPatientVisits(patient.id);
                const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();
                return (
                  <TableRow key={patient.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{patient.registration_number}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{patient.full_name}</TableCell>
                    <TableCell>{getCategoryBadge(patient.patient_category)}</TableCell>
                    <TableCell>{age} yrs / {patient.gender?.charAt(0).toUpperCase()}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" />
                        {patient.phone}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(patient.status)}</TableCell>
                    <TableCell>{patientVisits.length}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleViewPatient(patient)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditPatient(patient)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Patient
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { setPatientToDelete(patient); setIsDeleteOpen(true); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Patient
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredPatients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No patients found matching your criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Patient Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPatient && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPatient.full_name}</DialogTitle>
                <DialogDescription>
                  Registration #{selectedPatient.registration_number}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="personal" className="mt-4">
                <TabsList>
                  <TabsTrigger value="personal">Personal Info</TabsTrigger>
                  <TabsTrigger value="medical">Medical Info</TabsTrigger>
                  <TabsTrigger value="visits">Visit History</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Full Name</Label>
                      <p className="font-medium">{selectedPatient.full_name}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Category</Label>
                      <p>{getCategoryBadge(selectedPatient.patient_category)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                      <p className="font-medium">{new Date(selectedPatient.date_of_birth).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Gender</Label>
                      <p className="font-medium capitalize">{selectedPatient.gender}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <p className="font-medium">{selectedPatient.phone}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Aadhaar</Label>
                      <p className="font-medium">{selectedPatient.aadhaar_number || "Not provided"}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Address</Label>
                      <p className="font-medium">
                        {selectedPatient.address}, {selectedPatient.city}, {selectedPatient.state} - {selectedPatient.pincode}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Emergency Contact</Label>
                      <p className="font-medium">{selectedPatient.emergency_contact_name || "Not provided"}</p>
                      <p className="text-sm text-muted-foreground">{selectedPatient.emergency_contact_phone}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="medical" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Blood Group</Label>
                      <p className="font-medium">{selectedPatient.blood_group || "Not specified"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Addiction Type</Label>
                      <Badge variant="outline" className="capitalize">{selectedPatient.addiction_type}</Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Addiction Duration</Label>
                      <p className="font-medium">{selectedPatient.addiction_duration || "Not specified"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">First Visit</Label>
                      <p className="font-medium">{selectedPatient.first_visit_date ? new Date(selectedPatient.first_visit_date).toLocaleDateString('en-IN') : "N/A"}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Medical History</Label>
                      <p className="font-medium">{selectedPatient.medical_history || "None reported"}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Allergies</Label>
                      <p className="font-medium">{selectedPatient.allergies || "None reported"}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="visits" className="space-y-4 mt-4">
                  {getPatientVisits(selectedPatient.id).length > 0 ? (
                    <div className="space-y-2">
                      {getPatientVisits(selectedPatient.id).map((visit) => (
                        <div key={visit.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{visit.visit_date}</span>
                          </div>
                          <Badge variant={visit.status === "completed" ? "default" : "secondary"}>
                            {visit.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No visits recorded</p>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
                <Button onClick={() => { setIsViewOpen(false); handleEditPatient(selectedPatient); }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Patient
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
            <DialogDescription>Update patient information</DialogDescription>
          </DialogHeader>

          {editingPatient && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={editingPatient.full_name}
                    onChange={(e) => setEditingPatient({ ...editingPatient, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input value={editingPatient.registration_number} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={editingPatient.patient_category || ""}
                    onValueChange={(v) => setEditingPatient({ ...editingPatient, patient_category: v as PatientCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="psychiatric">Psychiatric</SelectItem>
                      <SelectItem value="deaddiction">De-Addiction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingPatient.status || "active"}
                    onValueChange={(v) => setEditingPatient({ ...editingPatient, status: v as "active" | "inactive" | "discharged" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="discharged">Discharged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={editingPatient.date_of_birth}
                    onChange={(e) => setEditingPatient({ ...editingPatient, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={editingPatient.gender}
                    onValueChange={(v) => setEditingPatient({ ...editingPatient, gender: v as "male" | "female" | "other" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editingPatient.phone}
                    onChange={(e) => setEditingPatient({ ...editingPatient, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Aadhaar Number</Label>
                  <Input
                    value={editingPatient.aadhaar_number || ""}
                    onChange={(e) => setEditingPatient({ ...editingPatient, aadhaar_number: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={editingPatient.address}
                    onChange={(e) => setEditingPatient({ ...editingPatient, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={editingPatient.city}
                    onChange={(e) => setEditingPatient({ ...editingPatient, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={editingPatient.state}
                    onChange={(e) => setEditingPatient({ ...editingPatient, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input
                    value={editingPatient.pincode}
                    onChange={(e) => setEditingPatient({ ...editingPatient, pincode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Blood Group</Label>
                  <Select
                    value={editingPatient.blood_group || ""}
                    onValueChange={(v) => setEditingPatient({ ...editingPatient, blood_group: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Addiction Type</Label>
                  <Select
                    value={editingPatient.addiction_type}
                    onValueChange={(v) => setEditingPatient({ ...editingPatient, addiction_type: v as Patient["addiction_type"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alcohol">Alcohol</SelectItem>
                      <SelectItem value="drugs">Drugs</SelectItem>
                      <SelectItem value="tobacco">Tobacco</SelectItem>
                      <SelectItem value="multiple">Multiple</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Addiction Duration</Label>
                  <Input
                    value={editingPatient.addiction_duration || ""}
                    onChange={(e) => setEditingPatient({ ...editingPatient, addiction_duration: e.target.value })}
                    placeholder="e.g., 5 years"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Medical History</Label>
                  <Textarea
                    value={editingPatient.medical_history || ""}
                    onChange={(e) => setEditingPatient({ ...editingPatient, medical_history: e.target.value })}
                    placeholder="Any relevant medical history..."
                    rows={3}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Allergies</Label>
                  <Textarea
                    value={editingPatient.allergies || ""}
                    onChange={(e) => setEditingPatient({ ...editingPatient, allergies: e.target.value })}
                    placeholder="Any known allergies..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Contact Name</Label>
                  <Input
                    value={editingPatient.emergency_contact_name || ""}
                    onChange={(e) => setEditingPatient({ ...editingPatient, emergency_contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Contact Phone</Label>
                  <Input
                    value={editingPatient.emergency_contact_phone || ""}
                    onChange={(e) => setEditingPatient({ ...editingPatient, emergency_contact_phone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSavePatient}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Patient</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {patientToDelete?.full_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
