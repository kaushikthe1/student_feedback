import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import FormFlow from './FormFlow';

export default async function StudentSubmitPage(props: { params: Promise<{ assignmentId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'STUDENT') {
    redirect('/');
  }

  const { assignmentId } = await props.params;

  const profile = await prisma.studentProfile.findUnique({
    where: { user_id: session.userId }
  });

  if (!profile) {
    return <div>Error loading profile</div>;
  }

  const assignment = await prisma.formAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      form: {
        include: {
          questions: {
            include: { options: true },
            orderBy: { order: 'asc' }
          }
        }
      }
    }
  });

  if (!assignment || assignment.batch_id !== profile.batch_id) {
    return <div>Assignment not found or not assigned to your batch.</div>;
  }

  // Get all teachers for this department/batch? Wait, teachers are mapped to departments.
  // We need to fetch teachers so the student can select one.
  // In a real app, batches might be mapped to specific teachers, but the spec says "Select Class/Teacher -> Fill Form"
  // Let's just fetch all active teachers and let them select, or fetch teachers in the same department?
  // The spec: "Student selects the teacher/class being evaluated"
  const teachers = await prisma.teacher.findMany({
    where: { archived: false },
    include: { department: true },
    orderBy: { name: 'asc' }
  });

  // Get completed submissions for this form by this student
  const completedSubmissions = await prisma.submission.findMany({
    where: {
      student_id: session.userId,
      form_id: assignment.form_id,
    },
    select: { teacher_id: true }
  });

  const completedTeacherIds = completedSubmissions.map(s => s.teacher_id);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{assignment.form.title}</h1>
        <p className="text-gray-500 mt-2">{assignment.form.description}</p>
      </div>

      <FormFlow 
        assignment={assignment} 
        teachers={teachers} 
        completedTeacherIds={completedTeacherIds}
      />
    </div>
  );
}
