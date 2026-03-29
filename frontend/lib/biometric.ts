// Mantra MFS100 Fingerprint Scanner Integration via RD Service
// RD Service runs locally on port 11100

export interface BiometricResult {
  success: boolean;
  data?: string; // PID XML data
  error?: string;
}

export interface RDServiceInfo {
  available: boolean;
  deviceInfo?: {
    name: string;
    serial: string;
    status: string;
  };
  error?: string;
}

// Check if RD Service is running
export async function checkRDService(): Promise<RDServiceInfo> {
  try {
    const response = await fetch("https://localhost:11100/rd/info", {
      method: "RDSERVICE",
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const xmlText = await response.text();
      // Parse device info from XML response
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, "text/xml");

      const deviceInfo = doc.querySelector("RDService");
      if (deviceInfo) {
        return {
          available: true,
          deviceInfo: {
            name: deviceInfo.getAttribute("info") || "Mantra MFS100",
            serial: deviceInfo.getAttribute("dpId") || "Unknown",
            status: deviceInfo.getAttribute("status") || "READY",
          },
        };
      }
    }

    return { available: false, error: "RD Service not responding properly" };
  } catch (error) {
    return {
      available: false,
      error:
        "RD Service not detected. Please ensure Mantra driver is installed.",
    };
  }
}

// Capture fingerprint
export async function captureFingerprint(): Promise<BiometricResult> {
  try {
    // First check if service is available
    const serviceInfo = await checkRDService();
    if (!serviceInfo.available) {
      return { success: false, error: serviceInfo.error };
    }

    // Capture fingerprint
    const captureXML = `<?xml version="1.0"?>
<PidOptions ver="1.0">
  <Opts fCount="1" fType="0" iCount="0" pCount="0" format="0" pidVer="2.0" 
        timeout="10000" posh="UNKNOWN" env="P" />
</PidOptions>`;

    const response = await fetch("https://localhost:11100/rd/capture", {
      method: "CAPTURE",
      headers: { "Content-Type": "text/xml" },
      body: captureXML,
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const pidXML = await response.text();

      // Check for errors in PID response
      const parser = new DOMParser();
      const doc = parser.parseFromString(pidXML, "text/xml");
      const respElement = doc.querySelector("Resp");

      if (respElement) {
        const errCode = respElement.getAttribute("errCode");
        if (errCode && errCode !== "0") {
          const errInfo =
            respElement.getAttribute("errInfo") || "Capture failed";
          return { success: false, error: errInfo };
        }
      }

      return { success: true, data: pidXML };
    }

    return { success: false, error: "Failed to capture fingerprint" };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { success: false, error: "Capture timed out. Please try again." };
    }
    return {
      success: false,
      error: "Fingerprint capture failed. Please try again.",
    };
  }
}

// Demo mode simulation
export async function simulateFingerprint(): Promise<BiometricResult> {
  // Simulate a delay for realistic feel
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Generate a simulated fingerprint template
  const template = `DEMO_FP_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    success: true,
    data: template,
  };
}

// Match fingerprint against stored template
// In production, this would use actual biometric matching algorithms
export function matchFingerprint(captured: string, stored: string): boolean {
  // Demo mode: Always match for demo templates
  if (captured.startsWith("DEMO_FP_") || stored.startsWith("DEMO_FP_")) {
    return true;
  }

  // In production, implement actual matching logic using Mantra SDK
  // or send to a matching service
  return captured === stored;
}
