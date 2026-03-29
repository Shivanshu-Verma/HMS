'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth, roleRoutes } from '@/lib/auth-context';
import type { UserRole } from '@/lib/types';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  Stethoscope,
  Pill,
  Package,
  FileText,
  Settings,
  LogOut,
  Fingerprint,
  Heart,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const navigationByRole: Record<UserRole, NavItem[]> = {
  admin: [
    { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { title: 'Users', href: '/admin/users', icon: Users },
    { title: 'Patients', href: '/admin/patients', icon: Heart },
    { title: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { title: 'Settings', href: '/admin/settings', icon: Settings },
  ],
  reception: [
    { title: 'Dashboard', href: '/reception', icon: LayoutDashboard },
    { title: 'Check-in', href: '/reception/checkin', icon: Fingerprint },
    { title: 'Register Patient', href: '/reception/register', icon: UserPlus },
    { title: 'Queue Status', href: '/reception/queue', icon: ClipboardList },
  ],
  counsellor: [
    { title: 'Dashboard', href: '/counsellor', icon: LayoutDashboard },
    { title: 'Patient Queue', href: '/counsellor/queue', icon: ClipboardList },
    { title: 'Session History', href: '/counsellor/history', icon: FileText },
  ],
  doctor: [
    { title: 'Dashboard', href: '/doctor', icon: LayoutDashboard },
    { title: 'Patient Queue', href: '/doctor/queue', icon: ClipboardList },
    { title: 'Consultations', href: '/doctor/history', icon: Stethoscope },
  ],
  pharmacist: [
    { title: 'Dashboard', href: '/pharmacy', icon: LayoutDashboard },
    { title: 'Prescriptions', href: '/pharmacy/queue', icon: Pill },
    { title: 'Inventory', href: '/pharmacy/inventory', icon: Package },
    { title: 'Invoices', href: '/pharmacy/invoices', icon: FileText },
  ],
};

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const navigation = navigationByRole[user.role] || [];

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Heart className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">De-Addiction Center</span>
            <span className="text-xs text-sidebar-foreground/60">Management System</span>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User Info */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{user.role}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <main className="pl-64">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
