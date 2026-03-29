"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { patientsApi } from "@/lib/api-client";
import { simulateFingerprint } from "@/lib/biometric";
import type { Gender, AddictionType } from "@/lib/types";
import { toast } from "sonner";
import {
  User,
  Phone,
  MapPin,
  Heart,
  AlertTriangle,
  Fingerprint,
  Loader2,
  Save,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default function RegisterPatientPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCapturingFingerprint, setIsCapturingFingerprint] = useState(false);
  const [fingerprintCaptured, setFingerprintCaptured] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    date_of_birth: "",
    gender: "" as Gender | "",
    blood_group: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    aadhaar_number: "",
    addiction_type: "" as AddictionType | "",
    addiction_duration: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
    family_history: "",
    medical_history: "",
    allergies: "",
    current_medications: "",
    previous_treatments: "",
    fingerprint_template: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleCaptureFingerprint = async () => {
    setIsCapturingFingerprint(true);
    const result = await simulateFingerprint();

    if (result.success && result.data) {
      setFormData({ ...formData, fingerprint_template: result.data });
      setFingerprintCaptured(true);
      toast.success("Fingerprint captured successfully!");
    } else {
      toast.error(result.error || "Failed to capture fingerprint");
    }

    setIsCapturingFingerprint(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (
      !formData.full_name ||
      !formData.phone ||
      !formData.gender ||
      !formData.addiction_type
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!formData.emergency_contact_name || !formData.emergency_contact_phone) {
      toast.error("Emergency contact information is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        full_name: formData.full_name,
        date_of_birth: formData.date_of_birth
          ? `${formData.date_of_birth}T00:00:00Z`
          : new Date().toISOString(),
        gender: formData.gender,
        blood_group: formData.blood_group || "",
        phone: formData.phone,
        email: formData.email || "",
        address: {
          line1: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
        },
        aadhaar_number_last4: formData.aadhaar_number
          ? formData.aadhaar_number.slice(-4)
          : "",
        addiction_type: formData.addiction_type,
        addiction_duration_text: formData.addiction_duration || "",
        emergency_contact: {
          name: formData.emergency_contact_name,
          phone: formData.emergency_contact_phone,
          relation: formData.emergency_contact_relation || "Other",
        },
        family_history: formData.family_history || "",
        medical_history: formData.medical_history || "",
        allergies: formData.allergies || "",
        current_medications: formData.current_medications || "",
        previous_treatments: formData.previous_treatments || "",
        fingerprint_template: formData.fingerprint_template || "manual-entry",
      };

      const result = await patientsApi.register(payload);
      if (result.success && result.data) {
        toast.success(
          `Patient registered successfully! Registration No: ${result.data.registration_number}`,
        );
        router.push("/reception/checkin");
      } else {
        toast.error("Patient registration failed");
      }
    } catch (error: any) {
      toast.error(error?.message || "Patient registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/reception">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Register New Patient
          </h1>
          <p className="text-muted-foreground">
            Enter patient details to create a new record
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </div>
              <CardDescription>Basic patient details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="full_name">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    name="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <Label htmlFor="gender">
                    Gender <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(v) => handleSelectChange("gender", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="blood_group">Blood Group</Label>
                  <Select
                    value={formData.blood_group}
                    onValueChange={(v) => handleSelectChange("blood_group", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="aadhaar_number">Aadhaar Number</Label>
                  <Input
                    id="aadhaar_number"
                    name="aadhaar_number"
                    value={formData.aadhaar_number}
                    onChange={handleChange}
                    placeholder="XXXX XXXX XXXX"
                    maxLength={14}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </div>
              <CardDescription>How to reach the patient</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter phone number"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter email address"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                  />
                </div>

                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="State"
                  />
                </div>

                <div>
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="Pincode"
                    maxLength={6}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Addiction Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Addiction Details</CardTitle>
              </div>
              <CardDescription>Primary condition information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="addiction_type">
                    Addiction Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.addiction_type}
                    onValueChange={(v) =>
                      handleSelectChange("addiction_type", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alcohol">Alcohol</SelectItem>
                      <SelectItem value="drugs">Drugs</SelectItem>
                      <SelectItem value="tobacco">Tobacco</SelectItem>
                      <SelectItem value="gambling">Gambling</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="addiction_duration">
                    Duration of Addiction
                  </Label>
                  <Input
                    id="addiction_duration"
                    name="addiction_duration"
                    value={formData.addiction_duration}
                    onChange={handleChange}
                    placeholder="e.g., 5 years"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="previous_treatments">
                    Previous Treatments
                  </Label>
                  <Textarea
                    id="previous_treatments"
                    name="previous_treatments"
                    value={formData.previous_treatments}
                    onChange={handleChange}
                    placeholder="Any previous treatment history"
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Emergency Contact</CardTitle>
              </div>
              <CardDescription>Required for emergencies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="emergency_contact_name">
                    Contact Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="emergency_contact_name"
                    name="emergency_contact_name"
                    value={formData.emergency_contact_name}
                    onChange={handleChange}
                    placeholder="Emergency contact name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="emergency_contact_phone">
                    Contact Phone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="emergency_contact_phone"
                    name="emergency_contact_phone"
                    type="tel"
                    value={formData.emergency_contact_phone}
                    onChange={handleChange}
                    placeholder="Phone number"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="emergency_contact_relation">
                    Relationship
                  </Label>
                  <Input
                    id="emergency_contact_relation"
                    name="emergency_contact_relation"
                    value={formData.emergency_contact_relation}
                    onChange={handleChange}
                    placeholder="e.g., Spouse, Parent"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medical History */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Medical History</CardTitle>
              </div>
              <CardDescription>Important health information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="medical_history">Medical History</Label>
                <Textarea
                  id="medical_history"
                  name="medical_history"
                  value={formData.medical_history}
                  onChange={handleChange}
                  placeholder="Any existing medical conditions"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="allergies">Allergies</Label>
                <Input
                  id="allergies"
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleChange}
                  placeholder="Known allergies"
                />
              </div>

              <div>
                <Label htmlFor="current_medications">Current Medications</Label>
                <Textarea
                  id="current_medications"
                  name="current_medications"
                  value={formData.current_medications}
                  onChange={handleChange}
                  placeholder="List of current medications"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="family_history">Family History</Label>
                <Textarea
                  id="family_history"
                  name="family_history"
                  value={formData.family_history}
                  onChange={handleChange}
                  placeholder="Relevant family medical history"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Fingerprint Registration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">
                  Biometric Registration
                </CardTitle>
              </div>
              <CardDescription>
                Capture fingerprint for future check-ins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center py-6 space-y-4">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                    fingerprintCaptured
                      ? "bg-emerald-100 text-emerald-600"
                      : isCapturingFingerprint
                        ? "bg-primary/20 animate-pulse"
                        : "bg-secondary"
                  }`}
                >
                  {isCapturingFingerprint ? (
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  ) : (
                    <Fingerprint
                      className={`h-10 w-10 ${
                        fingerprintCaptured
                          ? "text-emerald-600"
                          : "text-muted-foreground"
                      }`}
                    />
                  )}
                </div>

                <Button
                  type="button"
                  variant={fingerprintCaptured ? "outline" : "default"}
                  onClick={handleCaptureFingerprint}
                  disabled={isCapturingFingerprint}
                >
                  {fingerprintCaptured
                    ? "Recapture Fingerprint"
                    : "Capture Fingerprint"}
                </Button>

                {fingerprintCaptured && (
                  <p className="text-sm text-emerald-600">
                    Fingerprint captured successfully
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/reception">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Register Patient
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
