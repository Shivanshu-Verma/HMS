"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { User, UserRole } from "./types";
import {
  authApi,
  getStoredUser,
  clearTokens,
  getAccessToken,
} from "./api-client";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Maps backend role names to frontend role names.
 * Backend uses 'consultant' and 'pharmacy'; frontend uses 'counsellor' and 'pharmacist'.
 */
function mapBackendRole(backendRole: string): UserRole {
  const roleMap: Record<string, UserRole> = {
    receptionist: "reception",
    consultant: "counsellor",
    doctor: "doctor",
    pharmacy: "pharmacist",
  };
  return roleMap[backendRole] || (backendRole as UserRole);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user on mount
    const storedUser = getStoredUser();
    if (storedUser && getAccessToken()) {
      try {
        setUser({
          id: storedUser.id,
          full_name: storedUser.full_name,
          email: storedUser.email,
          role: mapBackendRole(storedUser.role),
          is_active: true,
          created_at: storedUser.created_at || new Date().toISOString(),
        });
      } catch {
        clearTokens();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await authApi.login(email, password);

      if (result.success && result.data?.user) {
        const backendUser = result.data.user;
        const frontendUser: User = {
          id: backendUser.id,
          full_name: backendUser.full_name,
          email: backendUser.email,
          role: mapBackendRole(backendUser.role),
          is_active: true,
          created_at: new Date().toISOString(),
        };
        setUser(frontendUser);
        return { success: true };
      }

      return { success: false, error: "Login failed" };
    } catch (err: any) {
      return { success: false, error: err.message || "Login failed" };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Non-critical
    }
    setUser(null);
    clearTokens();
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, isDemo: false }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Helper to check if user has required role
export function hasRole(user: User | null, allowedRoles: UserRole[]): boolean {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

// Role-based route mapping
export const roleRoutes: Record<UserRole, string> = {
  admin: "/admin",
  reception: "/reception",
  counsellor: "/counsellor",
  doctor: "/doctor",
  pharmacist: "/pharmacy",
};
