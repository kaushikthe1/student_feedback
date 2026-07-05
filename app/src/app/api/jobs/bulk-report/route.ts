import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { formId, questionIds, filterType, departmentId, teacherId } = await request.json();

    if (!formId || !questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return new NextResponse('Invalid input', { status: 400 });
    }

    let whereClause: any = { archived: false };

    if (filterType === 'DEPARTMENT' && departmentId) {
      whereClause.department_id = departmentId;
    } else if (filterType === 'TEACHER' && teacherId) {
      whereClause.id = teacherId;
    } else if (filterType !== 'ALL') {
      return new NextResponse('Invalid filter type', { status: 400 });
    }

    const teachers = await prisma.teacher.findMany({
      where: whereClause,
      select: { id: true }
    });

    if (teachers.length === 0) {
      return new NextResponse(JSON.stringify({ count: 0, message: "No teachers found for this filter" }), { status: 404 });
    }

    const jobs = teachers.map(t => ({
      type: 'REPORT' as const,
      status: 'PENDING' as const,
      payload: {
        teacherId: t.id,
        formId,
        selectedQuestions: questionIds,
        sendEmail: true
      },
      created_by: session.userId,
    }));

    await prisma.job.createMany({
      data: jobs
    });

    await prisma.auditLog.create({
      data: {
        actor_user_id: session.userId,
        action: 'BULK_REPORT_QUEUED',
        entity: 'Job',
        metadata: { formId, filterType, departmentId, teacherId, count: jobs.length },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown'
      }
    });

    return NextResponse.json({ count: jobs.length });

  } catch (error) {
    console.error('Bulk Report Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
