import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardList, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session || session.role !== 'STUDENT') {
    redirect('/');
  }

  // Get student profile
  const profile = await prisma.studentProfile.findUnique({
    where: { user_id: session.userId }
  });

  if (!profile) {
    return <div>Error loading profile</div>;
  }

  const now = new Date();
  const currentDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const currentTimeString = currentDate.toTimeString().slice(0, 5); // "HH:mm"

  const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const currentWeekday = dayMap[currentDate.getDay()];

  // Find assignments for this student's batch
  const assignments = await prisma.formAssignment.findMany({
    where: {
      batch_id: profile.batch_id,
    },
    include: {
      form: true
    }
  });

  // Get student's completed submissions
  const completedSubmissions = await prisma.submission.findMany({
    where: { student_id: session.userId },
    select: { form_id: true, teacher_id: true }
  });

  // Process assignments
  const activeForms: any[] = [];
  const closedForms: any[] = [];
  const completedForms: any[] = []; // If we wanted to track completion per form. (A form may need multiple submissions per teacher though)

  // Wait, if a form is assigned to a batch, the student must evaluate all teachers in their batch?
  // The spec says: "submission flow: Select Class/Teacher -> Fill Form"
  // So the form itself represents an open task.
  // We'll show all assignments for the batch.

  for (const assignment of assignments) {
    const isWithinDate = currentDate >= assignment.start_date && currentDate <= assignment.end_date;
    const isWithinTime = currentTimeString >= assignment.daily_start_time && currentTimeString <= assignment.daily_end_time;
    const isAllowedDay = assignment.allowed_weekdays.includes(currentWeekday as any);

    // Get submissions by this student for this form
    const subs = completedSubmissions.filter(s => s.form_id === assignment.form_id);
    
    // We can count how many teachers they evaluated for this form.
    // For now, we'll just show if the form is open or closed, and how many submissions they've done.

    const isOpen = isWithinDate && isWithinTime && isAllowedDay;

    if (isOpen) {
      activeForms.push({ assignment, submissionsCount: subs.length });
    } else {
      closedForms.push({ assignment, submissionsCount: subs.length });
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Feedback Forms</h1>
        <p className="text-gray-500 mt-2">Complete the active forms below to provide your feedback.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {activeForms.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed">
            <ClipboardList className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Active Forms</h3>
            <p className="text-gray-500">There are currently no open forms for your batch.</p>
          </div>
        ) : (
          activeForms.map(({ assignment, submissionsCount }) => (
            <div key={assignment.id} className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ClipboardList className="w-16 h-16 text-primary" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center space-x-2 mb-4">
                  <span className="px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold uppercase tracking-wider">
                    Open Now
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">{assignment.form.title}</h3>
                <p className="text-sm text-gray-500 mb-6 line-clamp-2">
                  {assignment.form.description || "No description provided."}
                </p>
                
                <div className="flex items-center justify-between mt-auto">
                  <div className="text-sm font-medium text-gray-500">
                    {submissionsCount > 0 ? (
                      <span className="flex items-center text-primary">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        {submissionsCount} Submitted
                      </span>
                    ) : (
                      "0 Submitted"
                    )}
                  </div>
                  <Link 
                    href={`/dashboard/student/submit/${assignment.id}`}
                    className="inline-flex items-center justify-center bg-primary hover:bg-blue-700 text-white p-2 rounded-xl transition-colors"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {closedForms.length > 0 && (
        <div className="pt-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-gray-400" />
            Upcoming / Closed Forms
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {closedForms.map(({ assignment, submissionsCount }) => (
              <div key={assignment.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 opacity-75">
                <h3 className="text-lg font-bold mb-1">{assignment.form.title}</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Available: {assignment.daily_start_time} - {assignment.daily_end_time} on {assignment.allowed_weekdays.join(', ')}
                </p>
                <div className="text-sm font-medium text-gray-500">
                  {submissionsCount} Submissions completed
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
