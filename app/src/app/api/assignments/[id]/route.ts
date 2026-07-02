import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formAssignmentSchema } from '@/lib/validations/form';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const data = formAssignmentSchema.parse(body);

    const existing = await prisma.formAssignment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } }, { status: 404 });
    }

    const assignment = await prisma.formAssignment.update({
      where: { id },
      data: {
        batch_id: data.batch_id,
        start_date: data.start_date,
        end_date: data.end_date,
        daily_start_time: data.daily_start_time,
        daily_end_time: data.daily_end_time,
        allowed_weekdays: data.allowed_weekdays,
      }
    });

    await prisma.auditLog.create({
      data: {
        actor_user_id: session.userId,
        action: 'ASSIGNMENT_UPDATED',
        entity: 'FORM_ASSIGNMENT',
        entity_id: id,
      }
    });

    return NextResponse.json(assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update assignment' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;
    
    await prisma.formAssignment.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actor_user_id: session.userId,
        action: 'ASSIGNMENT_DELETED',
        entity: 'FORM_ASSIGNMENT',
        entity_id: id,
      }
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete assignment' } }, { status: 500 });
  }
}
