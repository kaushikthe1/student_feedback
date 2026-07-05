import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { LogOut, User, LayoutDashboard, FileText, Users, Building, GraduationCap, Settings, ShieldAlert, Database, Shield } from 'lucide-react';
import DashboardShell from './DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  const isAdmin = session.role === 'ADMIN' || session.role === 'SUPERADMIN';
  const isSuperadmin = session.role === 'SUPERADMIN';
  return (
    <DashboardShell 
      userEmail={session.email}
      isAdmin={isAdmin}
      isSuperadmin={isSuperadmin}
      mustChangePassword={session.mustChangePassword}
    >
      {children}
    </DashboardShell>
  );
}
