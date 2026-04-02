'use client';

import { useEffect, useState } from 'react';
import { useAuth, roleRoutes } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/spinner';
import Image from 'next/image';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShouldRedirect(true);
    }
  }, [isLoading]);

  useEffect(() => {
    if (shouldRedirect) {
      if (user) {
        window.location.href = roleRoutes[user.role];
      } else {
        window.location.href = '/login';
      }
    }
  }, [shouldRedirect, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0d7377]/10 via-background to-[#14919b]/10">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d7377] to-[#14919b] rounded-full blur-xl opacity-30 animate-pulse"></div>
          <Image
            src="/logo.png"
            alt="Aggarwal Hospital Logo"
            width={100}
            height={100}
            className="relative rounded-full shadow-xl"
            priority
          />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#0d7377] to-[#14919b] bg-clip-text text-transparent">
            Aggarwal Psychiatric
          </h1>
          <p className="text-sm text-muted-foreground">& De-Addiction Centre</p>
        </div>
        <div className="flex items-center gap-3">
          <Spinner className="h-5 w-5 text-[#0d7377]" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    </div>
  );
}
