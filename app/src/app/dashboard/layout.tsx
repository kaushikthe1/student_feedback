import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { LogOut, User, LayoutDashboard, FileText, Users, Building, GraduationCap, Settings, ShieldAlert, Database, Shield } from 'lucide-react';

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

  const adminNav = [
    { label: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'Forms', href: '/dashboard/admin/forms', icon: FileText },
    { label: 'Departments', href: '/dashboard/admin/departments', icon: Building },
    { label: 'Batches', href: '/dashboard/admin/batches', icon: GraduationCap },
    { label: 'Teachers', href: '/dashboard/admin/teachers', icon: User },
    { label: 'Students', href: '/dashboard/admin/students', icon: Users },
    { label: 'Admins', href: '/dashboard/admin/admins', icon: Shield },
  ];

  if (isSuperadmin) {
    adminNav.push({ label: 'Audit Logs', href: '/dashboard/admin/audit-logs', icon: ShieldAlert });
    adminNav.push({ label: 'Backups', href: '/dashboard/admin/backups', icon: Database });
  }

  const navItems = isAdmin ? adminNav : [
    { label: 'My Feedback', href: '/dashboard/student', icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen text-gray-900 dark:text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-background/50 backdrop-blur-xl flex-shrink-0 fixed h-full z-20">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
          <span className="font-bold text-xl tracking-tight text-primary">EduFeed</span>
        </div>
        
        <nav className="p-4 space-y-1 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium text-sm"
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-background/50 backdrop-blur-xl sticky top-0 z-10 px-8 flex items-center justify-between">
          <div className="font-medium text-sm text-gray-500">
            {isAdmin ? 'Admin Portal' : 'Student Portal'}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm font-medium">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User className="w-4 h-4" />
              </div>
              <span className="hidden sm:inline-block">{session.email}</span>
            </div>
            <div className="flex items-center space-x-2 border-l border-gray-200 dark:border-gray-800 pl-4 ml-2">
              <Link
                href="/dashboard/settings"
                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button 
                  type="submit"
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </header>
        <div className="p-8 flex-1">
          {children}
        </div>
        <footer suppressHydrationWarning className="py-4 border-t border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500 dark:text-gray-400 mt-auto bg-background/50 backdrop-blur-xl">
          &copy; {new Date().getFullYear()} AIIMS Kalyani. All rights reserved.
        </footer>
      </main>
    </div>
  );
}
