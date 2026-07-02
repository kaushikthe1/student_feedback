import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

const jobSchema = z.object({
  type: z.enum(['EXPORT', 'REPORT']),
  payload: z.any()
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const body = await request.json();
    const data = jobSchema.parse(body);

    const job = await prisma.job.create({
      data: {
        type: data.type,
        status: 'PENDING',
        payload: data.payload,
        created_by: session.userId,
      }
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to queue job' } }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const job = await prisma.job.findUnique({ where: { id } });
      if (!job) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Job not found' } }, { status: 404 });
      return NextResponse.json(job);
    }

    const jobs = await prisma.job.findMany({
      orderBy: { created_at: 'desc' },
      take: 20
    });

    return NextResponse.json(jobs);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch jobs' } }, { status: 500 });
  }
}
