"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/auth-context";
import {
  completeCounsellorSession,
  getCounsellorSessionDetail,
} from "@/lib/hms-api";
import type { Visit, Patient, CounsellorSession, RiskLevel } from "@/lib/types";
import { PatientCard } from "@/components/patient-card";
import { RiskBadge } from "@/components/status-badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  FileText,
  AlertTriangle,
  Heart,
  Clock,
  Send,
  Loader2,
} from "lucide-react";
import { navigate } from "@/lib/navigation";

export default function SessionPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const [visitId, setVisitId] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const { user, accessToken } = useAuth();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionStartTime] = useState(Date.now());

  const [formData, setFormData] = useState({
    session_notes: "",
    mood_assessment: 5,
    risk_level: "low" as RiskLevel,
    recommendations: "",
    follow_up_required: true,
  });

  // Get params safely after mount
  useEffect(() => {
    setIsMounted(true);
    params.then((p) => setVisitId(p.visitId));
  }, [params]);

  useEffect(() => {
    if (!visitId || !accessToken) return;

    getCounsellorSessionDetail(accessToken, visitId)
      .then((res) => {
        setVisit({
          id: res.session_id,
          patient_id: res.patient.patient_id,
          visit_date:
            res.checked_in_at?.split("T")[0] ||
            new Date().toISOString().split("T")[0],
          visit_number: 1,
          current_stage: "counsellor",
          checkin_time: res.checked_in_at || undefined,
          status: "in_progress",
        });

        setPatient({
          id: res.patient.patient_id,
          registration_number: res.patient.registration_number,
          patient_category: "deaddiction",
          full_name: res.patient.full_name,
          date_of_birth: res.patient.date_of_birth || "",
          gender: res.patient.sex,
          phone: res.patient.phone_number,
          address: "",
          city: "",
          state: "",
          pincode: "",
          addiction_type: (res.patient.addiction_type as any) || "other",
          addiction_duration: res.patient.addiction_duration_text || undefined,
          first_visit_date:
            res.checked_in_at?.split("T")[0] ||
            new Date().toISOString().split("T")[0],
          emergency_contact_name: "",
          emergency_contact_phone: "",
          emergency_contact_relation: "",
          medical_history: res.patient.medical_history || undefined,
          allergies: res.patient.allergies || undefined,
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load session details",
        );
      });
  }, [visitId, user, accessToken]);

  const handleSubmit = async () => {
    if (!formData.session_notes.trim()) {
      toast.error("Please enter session notes");
      return;
    }

    if (!visit || !patient || !user) return;

    setIsSubmitting(true);

    // Calculate session duration
    const durationMinutes = Math.round((Date.now() - sessionStartTime) / 60000);

    if (!accessToken) return;

    try {
      await completeCounsellorSession(accessToken, visit.id, {
        session_notes: formData.session_notes,
        mood_assessment: formData.mood_assessment,
        risk_level: formData.risk_level,
        recommendations: formData.recommendations || undefined,
        follow_up_required: formData.follow_up_required,
      });
      toast.success("Session ended successfully.");
      window.location.href = "/counsellor";
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit session",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visit || !patient) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Previous sessions — not available in API mode, would need a dedicated endpoint
  const previousSessions: CounsellorSession[] = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/counsellor/queue")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Counselling Session
          </h1>
          <p className="text-muted-foreground">
            Session with {patient.full_name}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Session Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Session Notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Session Notes</CardTitle>
              </div>
              <CardDescription>
                Document the counselling session details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="session_notes">
                  Notes <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="session_notes"
                  value={formData.session_notes}
                  onChange={(e) =>
                    setFormData({ ...formData, session_notes: e.target.value })
                  }
                  placeholder="Enter detailed session notes..."
                  rows={6}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="recommendations">Recommendations</Label>
                <Textarea
                  id="recommendations"
                  value={formData.recommendations}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recommendations: e.target.value,
                    })
                  }
                  placeholder="Treatment recommendations for the doctor..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Assessment */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Patient Assessment</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Mood Assessment */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Mood Assessment</Label>
                  <span className="text-lg font-semibold text-primary">
                    {formData.mood_assessment}/10
                  </span>
                </div>
                <Slider
                  value={[formData.mood_assessment]}
                  onValueChange={(v) =>
                    setFormData({ ...formData, mood_assessment: v[0] })
                  }
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Very Low</span>
                  <span>Neutral</span>
                  <span>Very High</span>
                </div>
              </div>

              {/* Risk Level */}
              <div>
                <Label className="mb-3 block">Risk Level</Label>
                <RadioGroup
                  value={formData.risk_level}
                  onValueChange={(v) =>
                    setFormData({ ...formData, risk_level: v as RiskLevel })
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="low" />
                    <Label htmlFor="low" className="cursor-pointer">
                      <RiskBadge level="low" />
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="medium" />
                    <Label htmlFor="medium" className="cursor-pointer">
                      <RiskBadge level="medium" />
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="high" />
                    <Label htmlFor="high" className="cursor-pointer">
                      <RiskBadge level="high" />
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Follow-up Required */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Follow-up Required</Label>
                  <p className="text-sm text-muted-foreground">
                    Schedule another counselling session
                  </p>
                </div>
                <Switch
                  checked={formData.follow_up_required}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, follow_up_required: v })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/counsellor/queue")}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Ending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  End Session
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Sidebar - Patient Info */}
        <div className="space-y-6">
          {/* Patient Card */}
          <PatientCard patient={patient} showStage={false} />

          {/* Patient Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Patient Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Addiction Type</span>
                <span className="capitalize font-medium">
                  {patient.addiction_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">
                  {patient.addiction_duration || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Visit Number</span>
                <span className="font-medium">#{visit.visit_number}</span>
              </div>
              {patient.allergies && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground block mb-1">
                    Allergies
                  </span>
                  <span className="text-destructive font-medium">
                    {patient.allergies}
                  </span>
                </div>
              )}
              {patient.medical_history && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground block mb-1">
                    Medical History
                  </span>
                  <span>{patient.medical_history}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Previous Sessions */}
          {previousSessions.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Previous Sessions</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {previousSessions.slice(0, 3).map((session) => (
                  <div
                    key={session.id}
                    className="p-3 rounded-lg border text-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString()}
                      </span>
                      <RiskBadge level={session.risk_level} />
                    </div>
                    <p className="text-muted-foreground line-clamp-2">
                      {session.session_notes}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mood: {session.mood_assessment}/10
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
