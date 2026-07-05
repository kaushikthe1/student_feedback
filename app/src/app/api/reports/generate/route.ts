import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { teacherId, formId, sendEmail } = body;

    if (!teacherId) {
      return NextResponse.json({ error: 'teacherId is required' }, { status: 400 });
    }

    const job = await prisma.job.create({
      data: {
        type: 'REPORT',
        status: 'PENDING',
        payload: { teacherId, formId, sendEmail },
        created_by: session.userId
      }
    });

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    console.error('Report Generation Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
