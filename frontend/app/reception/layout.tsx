'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, hasRole } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/dashboard-sidebar';
import { Spinner } from '@/components/ui/spinner';

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !hasRole(user, ['reception', 'admin'])) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!hasRole(user, ['reception', 'admin'])) {
    return null;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
