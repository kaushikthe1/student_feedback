import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { calculateTeacherScore } from '@/lib/analytics';
import { ChevronRight, BarChart3, Users, AlertTriangle } from 'lucide-react';

export default async function ReportsHubPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/auth/login');
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Analytics & Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Institutional performance overview and detailed teacher reports.</p>
        </div>
        <Link href="/dashboard/admin/reports/non-submitters" className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">
          <AlertTriangle className="w-4 h-4 mr-2" />
          View Non-Submitters
        </Link>
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
