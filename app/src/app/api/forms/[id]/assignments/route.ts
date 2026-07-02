import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formAssignmentSchema } from '@/lib/validations/form';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;

    const assignments = await prisma.formAssignment.findMany({
      where: { form_id: id },
      include: { batch: true },
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json(assignments);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch assignments' } }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const data = formAssignmentSchema.parse(body);

    const form = await prisma.form.findUnique({ where: { id } });
    if (!form || form.status !== 'PUBLISHED' || form.is_template) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Can only assign published non-template forms' } }, { status: 400 });
    }

    const assignment = await prisma.formAssignment.create({
      data: {
        form_id: id,
        batch_id: data.batch_id,
        start_date: data.start_date,
        end_date: data.end_date,
        daily_start_time: data.daily_start_time,
        daily_end_time: data.daily_end_time,
        allowed_weekdays: data.allowed_weekdays,
        timezone: 'Asia/Kolkata', // fixed per spec v1
      }
    });

    await prisma.auditLog.create({
      data: {
        actor_user_id: session.userId,
        action: 'ASSIGNMENT_CREATED',
        entity: 'FORM_ASSIGNMENT',
        entity_id: assignment.id,
        metadata: { form_id: id, batch_id: data.batch_id }
      }
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to assign form' } }, { status: 500 });
  }
}
