'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, roleRoutes } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/spinner';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // Redirect to role-specific dashboard
        router.push(roleRoutes[user.role]);
      } else {
        // Redirect to login
        router.push('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Spinner className="h-8 w-8" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
