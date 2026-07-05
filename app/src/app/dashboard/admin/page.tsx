import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users, Building, GraduationCap, FileText, ClipboardList, TrendingUp } from 'lucide-react';

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  // Fetch some quick stats
  const [studentCount, teacherCount, formCount, submissionCount] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT', is_active: true } }),
    prisma.teacher.count({ where: { archived: false } }),
    prisma.form.count({ where: { archived: false } }),
    prisma.submission.count(),
  ]);

  const stats = [
    { name: 'Active Students', value: studentCount, icon: GraduationCap, href: '/dashboard/admin/students', bgClass: 'bg-blue-500', textClass: 'text-blue-500' },
    { name: 'Active Teachers', value: teacherCount, icon: Users, href: '/dashboard/admin/teachers', bgClass: 'bg-green-500', textClass: 'text-green-500' },
    { name: 'Forms Created', value: formCount, icon: FileText, href: '/dashboard/admin/forms', bgClass: 'bg-purple-500', textClass: 'text-purple-500' },
    { name: 'Total Submissions', value: submissionCount, icon: ClipboardList, href: '/dashboard/admin/reports', bgClass: 'bg-orange-500', textClass: 'text-orange-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Welcome back. Here is an overview of the system.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Link key={stat.name} href={stat.href}>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bgClass} bg-opacity-10 dark:bg-opacity-20 group-hover:scale-110 transition-transform`}>
                  <stat.icon className={`w-6 h-6 ${stat.textClass}`} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/dashboard/admin/forms/new" className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-primary hover:bg-primary/5 transition-colors text-center group">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Create New Form</span>
            </Link>
            <Link href="/dashboard/admin/reports" className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-primary hover:bg-primary/5 transition-colors text-center group">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-3 group-hover:bg-green-500/20 transition-colors">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">View Analytics</span>
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-8">
              Activity tracking will be implemented in the analytics phase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
