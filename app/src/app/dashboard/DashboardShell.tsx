'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, User, Settings, Menu, X, LayoutDashboard, FileText, Users, Building, GraduationCap, ShieldAlert, Database, Shield } from 'lucide-react';
import Image from 'next/image';

export default function DashboardShell({
  children,
  userEmail,
  isAdmin,
  isSuperadmin,
}: {
  children: React.ReactNode;
  userEmail: string;
  isAdmin: boolean;
  isSuperadmin: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

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
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`w-64 border-r border-gray-200 dark:border-gray-800 bg-background/95 backdrop-blur-xl flex-shrink-0 fixed h-full z-40 transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-xl tracking-tight text-primary">EduFeed</span>
          </div>
          <button 
            className="md:hidden p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1 mt-4 overflow-y-auto h-[calc(100vh-5rem)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link 
                key={item.href} 
                href={item.href}
                onClick={() => setSidebarOpen(false)} // close on navigation
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors font-medium text-sm ${
                  isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen w-full relative">
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-background/50 backdrop-blur-xl sticky top-0 z-20 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button 
              className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="font-medium text-sm text-gray-500 hidden sm:block">
              {isAdmin ? 'Admin Portal' : 'Student Portal'}
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="flex items-center space-x-2 text-sm font-medium">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User className="w-4 h-4" />
              </div>
              <span className="hidden sm:inline-block max-w-[150px] truncate">{userEmail}</span>
            </div>
            <div className="flex items-center space-x-1 md:space-x-2 border-l border-gray-200 dark:border-gray-800 pl-2 md:pl-4 ml-1 md:ml-2">
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

        <div className="p-4 md:p-8 flex-1 w-full overflow-x-hidden">
          {children}
        </div>

        <footer suppressHydrationWarning className="py-4 border-t border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500 dark:text-gray-400 mt-auto bg-background/50 backdrop-blur-xl">
          &copy; {new Date().getFullYear()} AIIMS Kalyani. All rights reserved.
        </footer>
      </main>
    </div>
  );
}
