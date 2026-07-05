import { prisma } from './prisma';

export async function calculateTeacherScore(teacherId: string, formId?: string) {
  // We keep this for backward compatibility if needed elsewhere, 
  // but it's now correct according to the spec (average per student).
  const submissions = await prisma.submission.findMany({
    where: {
      teacher_id: teacherId,
      ...(formId ? { form_id: formId } : {})
    },
    select: {
      student_id: true,
      answers: {
        where: { normalized_score: { not: null } },
        select: { normalized_score: true }
      }
    }
  });

  if (submissions.length === 0) return null;

  const studentScores: Record<string, number[]> = {};
  let totalScoredAnswers = 0;

  for (const sub of submissions) {
    if (sub.answers.length === 0) continue;
    
    if (!studentScores[sub.student_id]) {
      studentScores[sub.student_id] = [];
    }
    
    for (const ans of sub.answers) {
      if (ans.normalized_score !== null) {
        studentScores[sub.student_id].push(ans.normalized_score);
        totalScoredAnswers++;
      }
    }
  }

  if (totalScoredAnswers === 0) return null;

  const studentAverages = Object.values(studentScores).map(scores => {
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  });

  return studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length;
}

export async function getTeacherAnalytics(teacherId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { department: true }
  });
  
  if (!teacher) return null;

  // Fetch all submissions and answers in ONE query
  const submissions = await prisma.submission.findMany({
    where: { teacher_id: teacherId },
    select: {
      id: true,
      student_id: true,
      submitted_at: true,
      form: {
        select: { id: true, title: true }
      },
      answers: {
        where: { normalized_score: { not: null } },
        select: { 
          normalized_score: true,
          question: {
            select: { id: true, text: true, order: true }
          }
        }
      }
    },
    orderBy: { submitted_at: 'asc' }
  });

  if (submissions.length === 0) {
    return {
      teacher,
      overallScore: null,
      totalSubmissions: 0,
      trend: [],
      formsBreakdown: []
    };
  }

  // 1. Overall Score (Average per student)
  const studentOverallScores: Record<string, number[]> = {};
  
  // 2. Trend (Average per student per month)
  const monthlyStudentScores: Record<string, Record<string, number[]>> = {};

  // 3. Question-Specific Scores by Form
  // form_id -> { title, questions: question_id -> { text, order, studentScores: student_id -> number[] } }
  const formBreakdowns: Record<string, any> = {};

  for (const sub of submissions) {
    if (sub.answers.length === 0) continue;
    const month = sub.submitted_at.toISOString().slice(0, 7); // YYYY-MM

    if (!studentOverallScores[sub.student_id]) studentOverallScores[sub.student_id] = [];
    if (!monthlyStudentScores[month]) monthlyStudentScores[month] = {};
    if (!monthlyStudentScores[month][sub.student_id]) monthlyStudentScores[month][sub.student_id] = [];

    // Initialize Form Breakdown
    if (!formBreakdowns[sub.form.id]) {
      formBreakdowns[sub.form.id] = {
        id: sub.form.id,
        title: sub.form.title,
        questions: {}
      };
    }

    for (const ans of sub.answers) {
      if (ans.normalized_score === null) continue;
      
      const score = ans.normalized_score;
      
      // Add to overall
      studentOverallScores[sub.student_id].push(score);
      
      // Add to trend
      monthlyStudentScores[month][sub.student_id].push(score);

      // Add to specific question
      const qId = ans.question.id;
      if (!formBreakdowns[sub.form.id].questions[qId]) {
        formBreakdowns[sub.form.id].questions[qId] = {
          id: qId,
          text: ans.question.text,
          order: ans.question.order,
          studentScores: {}
        };
      }
      
      if (!formBreakdowns[sub.form.id].questions[qId].studentScores[sub.student_id]) {
        formBreakdowns[sub.form.id].questions[qId].studentScores[sub.student_id] = [];
      }
      formBreakdowns[sub.form.id].questions[qId].studentScores[sub.student_id].push(score);
    }
  }

  // Calculate Overall Score
  const overallStudentAverages = Object.values(studentOverallScores).map(scores => scores.reduce((a, b) => a + b, 0) / scores.length);
  const overallScore = overallStudentAverages.length > 0 ? (overallStudentAverages.reduce((a, b) => a + b, 0) / overallStudentAverages.length) : null;

  // Calculate Trend
  const trend = Object.entries(monthlyStudentScores).map(([month, studentData]) => {
    const monthStudentAverages = Object.values(studentData).map((scores: any) => scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
    const monthScore = monthStudentAverages.length > 0 ? (monthStudentAverages.reduce((a, b) => a + b, 0) / monthStudentAverages.length) : null;
    return { month, score: monthScore };
  }).filter(t => t.score !== null);

  // Calculate Form Breakdowns
  const formattedBreakdown = Object.values(formBreakdowns).map((form: any) => {
    const questions = Object.values(form.questions).map((q: any) => {
      const qStudentAverages = Object.values(q.studentScores).map((scores: any) => scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
      const qScore = qStudentAverages.length > 0 ? (qStudentAverages.reduce((a: number, b: number) => a + b, 0) / qStudentAverages.length) : null;
      return {
        id: q.id,
        text: q.text,
        order: q.order,
        score: qScore
      };
    });
    
    // Sort questions by order
    questions.sort((a, b) => a.order - b.order);

    return {
      id: form.id,
      title: form.title,
      questions
    };
  });

  return {
    teacher,
    overallScore,
    totalSubmissions: submissions.length, // Count of distinct sessions (not students)
    trend,
    formsBreakdown: formattedBreakdown
  };
}

export async function getDepartmentAverages(departmentId: string) {
  const teachers = await prisma.teacher.findMany({ where: { department_id: departmentId }, select: { id: true } });
  
  const teacherStats = [];
  for (const t of teachers) {
    const stats = await getTeacherAnalytics(t.id);
    if (stats && stats.totalSubmissions > 0) {
      teacherStats.push(stats);
    }
  }

  const overallScores = teacherStats.map(t => t.overallScore).filter(s => s !== null) as number[];
  const overallScore = overallScores.length > 0 ? overallScores.reduce((a,b) => a+b, 0) / overallScores.length : null;

  const questionScores: Record<string, number[]> = {};
  for (const t of teacherStats) {
    for (const form of t.formsBreakdown) {
      for (const q of form.questions) {
        if (q.score !== null) {
          if (!questionScores[q.id]) questionScores[q.id] = [];
          questionScores[q.id].push(q.score);
        }
      }
    }
  }

  const questions: Record<string, number> = {};
  for (const [qId, scores] of Object.entries(questionScores)) {
    questions[qId] = scores.reduce((a,b) => a+b, 0) / scores.length;
  }

  return { overallScore, questions };
}

export async function getInstituteAverages() {
  const teachers = await prisma.teacher.findMany({ select: { id: true } });
  
  const teacherStats = [];
  for (const t of teachers) {
    const stats = await getTeacherAnalytics(t.id);
    if (stats && stats.totalSubmissions > 0) {
      teacherStats.push(stats);
    }
  }

  const overallScores = teacherStats.map(t => t.overallScore).filter(s => s !== null) as number[];
  const overallScore = overallScores.length > 0 ? overallScores.reduce((a,b) => a+b, 0) / overallScores.length : null;

  const questionScores: Record<string, number[]> = {};
  for (const t of teacherStats) {
    for (const form of t.formsBreakdown) {
      for (const q of form.questions) {
        if (q.score !== null) {
          if (!questionScores[q.id]) questionScores[q.id] = [];
          questionScores[q.id].push(q.score);
        }
      }
    }
  }

  const questions: Record<string, number> = {};
  for (const [qId, scores] of Object.entries(questionScores)) {
    questions[qId] = scores.reduce((a,b) => a+b, 0) / scores.length;
  }

  return { overallScore, questions };
}

export async function getDepartmentScore(departmentId: string, formId?: string) {
  const avgs = await getDepartmentAverages(departmentId);
  return avgs.overallScore;
}

export async function getInstituteScore(formId?: string) {
  const avgs = await getInstituteAverages();
  return avgs.overallScore;
}
