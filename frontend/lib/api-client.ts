/**
 * HMS API Client — Central module for all backend API calls.
 *
 * Handles JWT token management, automatic token refresh on 401,
 * and provides typed functions for each endpoint group.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hms_access_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hms_refresh_token");
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem("hms_access_token", access);
  localStorage.setItem("hms_refresh_token", refresh);
}

export function clearTokens(): void {
  localStorage.removeItem("hms_access_token");
  localStorage.removeItem("hms_refresh_token");
  localStorage.removeItem("hms_user");
}

export function getStoredUser(): any | null {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem("hms_user");
  return user ? JSON.parse(user) : null;
}

export function setStoredUser(user: any): void {
  localStorage.setItem("hms_user", JSON.stringify(user));
}

async function apiFetch(
  path: string,
  options: RequestInit = {},
  skipAuth = false,
): Promise<any> {
  const url = `${API_BASE_URL}/api/v1/${path.replace(/^\//, "")}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && !skipAuth) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getAccessToken()}`;
      const retryResponse = await fetch(url, { ...options, headers });
      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => ({}));
        throw new ApiError(
          errorData?.error?.code || "REQUEST_FAILED",
          errorData?.error?.message ||
            `Request failed: ${retryResponse.status}`,
          retryResponse.status,
          errorData?.error?.field,
        );
      }
      return retryResponse.json();
    }

    clearTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(
      "SESSION_EXPIRED",
      "Session expired. Please log in again.",
      401,
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData?.error?.code || "REQUEST_FAILED",
      errorData?.error?.message || `Request failed: ${response.status}`,
      response.status,
      errorData?.error?.field,
    );
  }

  return response.json();
}

async function attemptTokenRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        setTokens(data.data.access_token, data.data.refresh_token);
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export class ApiError extends Error {
  code: string;
  statusCode: number;
  field?: string;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    field?: string,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.field = field;
    this.name = "ApiError";
  }
}

export const authApi = {
  async login(email: string, password: string) {
    const result = await apiFetch(
      "auth/login/",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      true,
    );
    if (result.success && result.data) {
      setTokens(result.data.access_token, result.data.refresh_token);
      setStoredUser(result.data.user);
    }
    return result;
  },

  async logout() {
    const refreshToken = getRefreshToken();
    try {
      await apiFetch("auth/logout/", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // no-op
    }
    clearTokens();
  },
};

export const patientsApi = {
  async register(data: any) {
    return apiFetch("patients", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getById(patientId: string) {
    return apiFetch(`patients/${patientId}`);
  },

  async getByRegistration(regNumber: string) {
    return apiFetch(`patients/by-registration/${regNumber}`);
  },

  async lookupFingerprint(fingerprintTemplate: string) {
    return apiFetch("patients/lookup-fingerprint", {
      method: "POST",
      body: JSON.stringify({ fingerprint_template: fingerprintTemplate }),
    });
  },

  async search(q: string, page = 1, pageSize = 20) {
    return apiFetch(
      `patients/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`,
    );
  },

  async getSummary(patientId: string) {
    return apiFetch(`patients/${patientId}/summary`);
  },

  async getHistory(patientId: string, page = 1) {
    return apiFetch(`patients/${patientId}/history?page=${page}`);
  },
};

export const visitsApi = {
  async create(patientId: string) {
    return apiFetch("visits", {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId }),
    });
  },

  async getActive() {
    return apiFetch("visits/active");
  },

  async getVisitDetail(visitId: string) {
    return apiFetch(`visits/${visitId}/detail`);
  },
};

export const consultantApi = {
  async getQueue() {
    return apiFetch("consultant/queue");
  },

  async startSession(sessionId: string) {
    return apiFetch(`consultant/sessions/${sessionId}/start`, {
      method: "POST",
    });
  },

  async getContext(sessionId: string) {
    return apiFetch(`consultant/sessions/${sessionId}/context`);
  },

  async submitNotes(sessionId: string, data: any) {
    return apiFetch(`consultant/sessions/${sessionId}/notes`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async assignDoctor(sessionId: string) {
    return apiFetch(`consultant/sessions/${sessionId}/assign-doctor`, {
      method: "PATCH",
    });
  },

  async getHistory(page = 1) {
    return apiFetch(`consultant/history?page=${page}`);
  },
};

export const doctorApi = {
  async getQueue() {
    return apiFetch("doctor/queue");
  },

  async startConsultation(sessionId: string) {
    return apiFetch(`doctor/consultations/${sessionId}/start`, {
      method: "POST",
    });
  },

  async getContext(sessionId: string) {
    return apiFetch(`doctor/consultations/${sessionId}/context`);
  },

  async saveFindings(sessionId: string, data: any) {
    return apiFetch(`doctor/consultations/${sessionId}/findings`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async savePrescriptions(sessionId: string, prescriptions: any[]) {
    return apiFetch(`doctor/consultations/${sessionId}/prescriptions`, {
      method: "POST",
      body: JSON.stringify({ prescriptions }),
    });
  },

  async assignPharmacy(sessionId: string) {
    return apiFetch(`doctor/consultations/${sessionId}/assign-pharmacy`, {
      method: "PATCH",
    });
  },

  async getHistory(page = 1) {
    return apiFetch(`doctor/history?page=${page}`);
  },
};

export const medicineApi = {
  async search(q: string) {
    return apiFetch(`medicines/search?q=${encodeURIComponent(q)}`);
  },
};

export const pharmacyApi = {
  async getQueue() {
    return apiFetch("pharmacy/queue");
  },

  async getDispenseDetail(sessionId: string) {
    return apiFetch(`pharmacy/dispense/${sessionId}`);
  },

  async dispense(sessionId: string, data: any) {
    return apiFetch(`pharmacy/dispense/${sessionId}/submit`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async closeVisit(sessionId: string) {
    return apiFetch(`pharmacy/visits/${sessionId}/close`, {
      method: "POST",
    });
  },

  async getInventory(
    params: {
      q?: string;
      filter?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.filter) query.set("filter", params.filter);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    return apiFetch(`pharmacy/inventory?${query.toString()}`);
  },

  async addStock(medicineId: string, quantity: number, notes?: string) {
    return apiFetch(`pharmacy/inventory/${medicineId}/stock`, {
      method: "PATCH",
      body: JSON.stringify({ quantity, notes }),
    });
  },

  async addMedicine(data: any) {
    return apiFetch("pharmacy/inventory/add", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getHistory(page = 1) {
    return apiFetch(`pharmacy/history?page=${page}`);
  },
};
