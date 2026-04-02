'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from './types';
import { login as apiLogin } from './hms-api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapBackendRole(role: string): UserRole {
  if (role === 'receptionist') return 'reception';
  if (role === 'consultant') return 'counsellor';
  if (role === 'pharmacy') return 'pharmacist';
  if (role === 'doctor') return 'doctor';
  return 'reception';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Check for stored user and token on mount.
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem('hms_user');
        const storedToken = localStorage.getItem('hms_access_token');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        if (storedToken) {
          setAccessToken(storedToken);
        }
      } catch {
        localStorage.removeItem('hms_user');
        localStorage.removeItem('hms_access_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await apiLogin(email, password);
      const mappedUser: User = {
        id: result.user.id,
        email: result.user.email,
        full_name: result.user.full_name,
        role: mapBackendRole(result.user.role),
        is_active: true,
        created_at: new Date().toISOString(),
      };

      setUser(mappedUser);
      setAccessToken(result.access_token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('hms_user', JSON.stringify(mappedUser));
        localStorage.setItem('hms_access_token', result.access_token);
      }
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hms_user');
      localStorage.removeItem('hms_access_token');
      window.location.href = '/login';
    }
  };

  // Don't render children until mounted to prevent hydration mismatch
  if (!isMounted) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, accessToken, login, logout, isDemo: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
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
  admin: '/admin',
  reception: '/reception',
  counsellor: '/counsellor',
  doctor: '/doctor',
  pharmacist: '/pharmacy',
};
