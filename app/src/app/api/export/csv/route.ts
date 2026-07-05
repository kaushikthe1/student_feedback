import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    
    if (!fromStr || !toStr) {
      return new NextResponse('Date from and to are mandatory', { status: 400 });
    }

    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);
    
    // Max 1 year span
    const oneYear = 1000 * 60 * 60 * 24 * 365;
    if (toDate.getTime() - fromDate.getTime() > oneYear) {
      return new NextResponse('Date range cannot exceed 1 year', { status: 400 });
    }
    
    // Optional filters
    const formId = searchParams.get('formId');
    const departmentId = searchParams.get('departmentId');
    const batchId = searchParams.get('batchId');
    const teacherId = searchParams.get('teacherId');

    const whereClause: any = {
      submitted_at: {
        gte: fromDate,
        lte: toDate
      }
    };

    if (formId) whereClause.form_id = formId;
    if (departmentId) whereClause.department_id = departmentId;
    if (batchId) whereClause.batch_id_snapshot = batchId;
    if (teacherId) whereClause.teacher_id = teacherId;

    // We stream this or build a large string. Given typical node limits, a large string might blow memory if it's millions of rows.
    // For now, let's fetch in chunks using cursor pagination if needed, but a single query is fine for moderate sizes.
    // Using a TransformStream for a true streamed response.

    const submissions = await prisma.submission.findMany({
      where: whereClause,
      include: {
        student: { select: { roll_number: true } },
        teacher: { select: { name: true } },
        form: { select: { title: true } },
        department: { select: { name: true } },
        answers: {
          include: {
            question: { select: { text: true, is_scored: true, type: true } },
            option: { select: { label: true } }
          }
        }
      },
      orderBy: { submitted_at: 'desc' },
      take: 50000
    });

    await prisma.auditLog.create({
      data: {
        actor_user_id: session.userId,
        action: 'CSV_EXPORTED',
        entity: 'System',
        metadata: { filters: { from: fromStr, to: toStr, formId, departmentId, batchId, teacherId }, recordCount: submissions.length },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown'
      }
    });

    const headers = [
      'Submission ID',
      'Submitted At',
      'Roll Number',
      'Form Title',
      'Department',
      'Teacher Name',
      'Subject/Topic',
      'Question Text',
      'Question Type',
      'Is Scored',
      'Answer Value',
      'Normalized Score (0-100)'
    ];

    let csvContent = headers.join(',') + '\n';

    const escapeCsv = (str: string | null | undefined) => {
      if (str == null) return '';
      let stringified = String(str);
      
      // Neutralize CSV formula injection BEFORE quoting
      if (/^[=+\-@]/.test(stringified)) {
        stringified = "'" + stringified;
      }
      
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    for (const sub of submissions) {
      const baseRow = [
        escapeCsv(sub.id),
        escapeCsv(sub.submitted_at.toISOString()),
        escapeCsv(sub.student.roll_number),
        escapeCsv(sub.form.title),
        escapeCsv(sub.department.name),
        escapeCsv(sub.teacher.name),
        escapeCsv(sub.subject_topic || '')
      ];

      for (const ans of sub.answers) {
        let answerValue = '';
        if (ans.question.type === 'RATING') answerValue = ans.numeric_value !== null ? String(ans.numeric_value) : '';
        else if (ans.question.type === 'MCQ' || ans.question.type === 'DROPDOWN') answerValue = ans.option ? ans.option.label : '';
        else answerValue = ans.text_value || '';

        const row = [
          ...baseRow,
          escapeCsv(ans.question.text),
          escapeCsv(ans.question.type),
          escapeCsv(ans.question.is_scored ? 'Yes' : 'No'),
          escapeCsv(answerValue),
          escapeCsv(ans.normalized_score !== null ? String(ans.normalized_score) : '')
        ];
        
        csvContent += row.join(',') + '\n';
      }
    }

    if (submissions.length === 50000) {
      csvContent += '"---","WARNING: Data truncated at 50,000 limits. The oldest records have been omitted."\n';
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="feedback_export_${new Date().toISOString().slice(0, 10)}.csv"`
      }
    });
  } catch (error) {
    console.error('CSV Export Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
