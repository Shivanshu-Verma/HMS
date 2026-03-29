'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, roleRoutes } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heart, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login, isDemo } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await login(email, password);
    
    if (result.success) {
      // Small delay to allow auth state to update, then redirect
      setTimeout(() => {
        const stored = localStorage.getItem('hms_user');
        if (stored) {
          try {
            const userData = JSON.parse(stored);
            const roleMap: Record<string, keyof typeof roleRoutes> = {
              receptionist: 'reception',
              consultant: 'counsellor',
              doctor: 'doctor',
              pharmacy: 'pharmacist',
            };
            const role = roleMap[userData.role] || 'reception';
            router.push(roleRoutes[role]);
          } catch {
            router.push('/reception');
          }
        } else {
          router.push('/reception');
        }
      }, 100);
    } else {
      setError(result.error || 'Login failed');
    }
    
    setIsLoading(false);
  };

  const demoAccounts = [
    { email: 'reception@hms.com', password: 'reception123', role: 'Reception' },
    { email: 'counsellor@hms.com', password: 'counsellor123', role: 'Counsellor' },
    { email: 'doctor@hms.com', password: 'doctor123', role: 'Doctor' },
    { email: 'pharmacy@hms.com', password: 'pharmacy123', role: 'Pharmacist' },
  ];

  const quickLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Heart className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">De-Addiction Center</h1>
          <p className="text-muted-foreground">Management System</p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Accounts */}
        {true && (
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">Demo Mode</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Click on any account below to auto-fill credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => quickLogin(account.email, account.password)}
                    className="flex items-center justify-between rounded-lg border p-2 text-left text-sm hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium">{account.role}</p>
                      <p className="text-xs text-muted-foreground">{account.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {account.password}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
