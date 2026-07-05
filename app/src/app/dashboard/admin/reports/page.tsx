import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { calculateTeacherScore } from '@/lib/analytics';
import { ChevronRight, BarChart3, Users, AlertTriangle, MessageSquareWarning } from 'lucide-react';
import ExportCsvButton from './ExportCsvButton';

export default async function ReportsHubPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  const teachers = await prisma.teacher.findMany({
    where: { archived: false },
    include: { department: true }
  });

  // Calculate scores for all teachers
  const teacherStats = await Promise.all(
    teachers.map(async (t) => {
      const score = await calculateTeacherScore(t.id);
      const subCount = await prisma.submission.count({ where: { teacher_id: t.id } });
      return {
        ...t,
        score,
        subCount
      };
    })
  );

  const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } });
  const batches = await prisma.batch.findMany({ orderBy: { year: 'desc' } });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Analytics & Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Institutional performance overview and detailed teacher reports.</p>
        </div>
        <div className="flex items-center space-x-3">
          <ExportCsvButton departments={departments} teachers={teachers} batches={batches} />
          <Link href="/dashboard/admin/reports/email-reports" className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Email Reports
          </Link>
          <Link href="/dashboard/admin/reports/language-review" className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700">
            <MessageSquareWarning className="w-4 h-4 mr-2" />
            Language Review
          </Link>
          <Link href="/dashboard/admin/reports/non-submitters" className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Non-Submitters
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Teacher Performance
          </h3>
        </div>
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {teacherStats.length === 0 ? (
            <li className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
              No teachers found.
            </li>
          ) : (
            teacherStats.map((teacher) => (
              <li key={teacher.id}>
                <Link href={`/dashboard/admin/reports/teacher/${teacher.id}`} className="block hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary">{teacher.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{teacher.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{teacher.department.name} • {teacher.designation}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {teacher.score !== null ? `${teacher.score.toFixed(1)} / 100` : 'No Data'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{teacher.subCount} Submissions</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
