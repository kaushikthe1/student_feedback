import { prisma } from './prisma';

export async function calculateTeacherScore(teacherId: string, formId?: string) {
  // Fetch all scored answers for the teacher
  const answers = await prisma.answer.findMany({
    where: {
      submission: {
        teacher_id: teacherId,
        ...(formId ? { form_id: formId } : {})
      },
      normalized_score: { not: null }
    },
    select: {
      normalized_score: true,
      submission_id: true,
    }
  });

  if (answers.length === 0) return null;

  // Group by submission (which represents one student's attempt at one form)
  const submissionScores: Record<string, number[]> = {};
  for (const ans of answers) {
    if (ans.normalized_score !== null) {
      if (!submissionScores[ans.submission_id]) {
        submissionScores[ans.submission_id] = [];
      }
      submissionScores[ans.submission_id].push(ans.normalized_score);
    }
  }

  // Calculate average per submission
  const submissionAverages = Object.values(submissionScores).map(scores => {
    const sum = scores.reduce((a, b) => a + b, 0);
    return sum / scores.length;
  });

  // Calculate final average across all submissions
  const finalSum = submissionAverages.reduce((a, b) => a + b, 0);
  return finalSum / submissionAverages.length;
}

export async function getTeacherAnalytics(teacherId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { department: true }
  });
  
  if (!teacher) return null;

  const score = await calculateTeacherScore(teacherId);
  const submissionsCount = await prisma.submission.count({
    where: { teacher_id: teacherId }
  });

  // Get score history by month
  const submissions = await prisma.submission.findMany({
    where: { teacher_id: teacherId },
    select: {
      id: true,
      submitted_at: true,
      answers: {
        where: { normalized_score: { not: null } },
        select: { normalized_score: true }
      }
    },
    orderBy: { submitted_at: 'asc' }
  });

  const monthlyScores: Record<string, { total: number, count: number }> = {};
  for (const sub of submissions) {
    if (sub.answers.length === 0) continue;
    
    const month = sub.submitted_at.toISOString().slice(0, 7); // YYYY-MM
    const subAvg = sub.answers.reduce((sum, ans) => sum + (ans.normalized_score || 0), 0) / sub.answers.length;
    
    if (!monthlyScores[month]) {
      monthlyScores[month] = { total: 0, count: 0 };
    }
    monthlyScores[month].total += subAvg;
    monthlyScores[month].count += 1;
  }

  const trend = Object.entries(monthlyScores).map(([month, data]) => ({
    month,
    score: data.total / data.count
  }));

  return {
    teacher,
    overallScore: score,
    totalSubmissions: submissionsCount,
    trend
  };
}
