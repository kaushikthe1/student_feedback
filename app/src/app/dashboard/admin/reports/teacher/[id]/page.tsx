import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTeacherAnalytics } from '@/lib/analytics';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, User } from 'lucide-react';
import TeacherChart from './TeacherChart';
import ExportButtons from './ExportButtons';

export default async function TeacherReportPage(props: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/');
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

  const rawFeedback = await prisma.answer.findMany({
    where: {
      submission: { teacher_id: id },
      text_value: { not: null }
    },
    include: {
      question: { select: { text: true } },
      submission: {
        include: {
          form: { select: { title: true } },
          student: { select: { roll_number: true } }
        }
      }
    },
    orderBy: { submission: { submitted_at: 'desc' } }
  });

  if (rawFeedback.length > 0) {
    await prisma.auditLog.create({
      data: {
        actor_user_id: session.userId,
        action: 'RAW_FEEDBACK_VIEWED',
        entity: 'Teacher',
        entity_id: id,
        metadata: { context: 'Teacher Analytics Drill-down' },
        ip_address: 'internal'
      }
    });
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

      {analytics.formsBreakdown.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detailed Breakdown by Form</h2>
          {analytics.formsBreakdown.map((form: any) => (
            <div key={form.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                <h3 className="font-medium text-gray-900 dark:text-white">{form.title}</h3>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {form.questions.map((q: any) => (
                  <li key={q.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{q.text}</span>
                    <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      {q.score !== null ? q.score.toFixed(1) : '--'} <span className="text-xs text-gray-400 font-normal">/ 100</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Raw Student Feedback</h2>
        <div className="space-y-4">
          {rawFeedback.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">No text feedback available for this teacher.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 space-y-4">
              {rawFeedback.map((fb) => (
                <li key={fb.id} className="pt-4 first:pt-0">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">
                      {fb.submission.form.title}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      Student: {fb.submission.student.roll_number}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{fb.question.text}</p>
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{fb.text_value}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </div>
  );
}
