import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default async function NonSubmittersPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/auth/login');
  }

  // Get active assignments
  const activeAssignments = await prisma.formAssignment.findMany({
    where: {
      form: { status: 'PUBLISHED', archived: false }
    },
    include: {
      form: true,
      batch: true
    }
  });

  // Find non-submitters
  // A non-submitter is a student in the assigned batch who has NOT submitted the specific form
  const nonSubmittersData = [];

  for (const assignment of activeAssignments) {
    // Get all active students in this batch
    const studentsInBatch = await prisma.studentProfile.findMany({
      where: { batch_id: assignment.batch_id, archived: false },
      include: { user: true }
    });

    // Get all submissions for this form by students in this batch
    const submissions = await prisma.submission.findMany({
      where: {
        form_id: assignment.form_id,
        batch_id_snapshot: assignment.batch_id
      },
      select: { student_id: true }
    });

    const submittedStudentIds = new Set(submissions.map(s => s.student_id));

    // Find those who haven't submitted
    const missing = studentsInBatch.filter(s => !submittedStudentIds.has(s.user_id));

    if (missing.length > 0) {
      nonSubmittersData.push({
        assignment,
        missingStudents: missing
      });
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/admin/reports" className="flex items-center hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Reports
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
          <AlertCircle className="w-8 h-8 text-orange-500" />
          Non-Submitter Tracking
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Students who have not completed their assigned mandatory feedback forms.</p>
      </div>

      <div className="space-y-6">
        {nonSubmittersData.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">All caught up!</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">There are no missing submissions for active forms.</p>
          </div>
        ) : (
          nonSubmittersData.map((data) => (
            <div key={data.assignment.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{data.assignment.form.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Assigned to: {data.assignment.batch.name}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-sm font-medium">
                  {data.missingStudents.length} Missing
                </span>
              </div>
              <ul className="divide-y divide-gray-200 dark:divide-gray-800 max-h-96 overflow-y-auto">
                {data.missingStudents.map((student) => (
                  <li key={student.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{student.user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{student.user.email}</p>
                    </div>
                    <span className="text-sm font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {student.roll_number}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
