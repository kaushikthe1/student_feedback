import { getSession } from '@/lib/auth';
import { getTeacherAnalytics } from '@/lib/analytics';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, User } from 'lucide-react';
import TeacherChart from './TeacherChart';
import ExportButtons from './ExportButtons';

export default async function TeacherReportPage(props: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/auth/login');
  }

  const { id } = await props.params;
  const analytics = await getTeacherAnalytics(id);

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Teacher Not Found</h2>
        <Link href="/dashboard/admin/reports" className="text-primary hover:underline mt-4 inline-block">Back to Reports</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/admin/reports" className="flex items-center hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Reports
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{analytics.teacher.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{analytics.teacher.department.name} • {analytics.teacher.designation}</p>
        </div>
        <ExportButtons teacherId={analytics.teacher.id} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Overall Score (0-100)</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              {analytics.overallScore !== null ? analytics.overallScore.toFixed(1) : '--'}
            </span>
            {analytics.overallScore !== null && <span className="text-sm text-gray-500">/ 100</span>}
          </div>
          <p className="text-xs text-gray-400 mt-2">Calculated using per-student-first averaging</p>
        </div>
        
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Submissions</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              {analytics.totalSubmissions}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Total distinct feedback entries received</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Performance Trend</h2>
        <TeacherChart data={analytics.trend} />
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Raw Student Feedback</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            This section would display anonymized raw text feedback from open-ended questions.
            In a complete implementation, this would fetch Answers where text_value is not null for this teacher.
          </p>
        </div>
      </div>

    </div>
  );
}
