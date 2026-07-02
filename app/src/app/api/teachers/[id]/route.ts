import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { teacherSchema } from '@/lib/validations/master';
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
    const data = teacherSchema.parse(body);

    const existing = await prisma.teacher.findFirst({
      where: {
        id: { not: id },
        email: data.email,
        archived: false,
      }
    });

    if (existing) {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Teacher email already exists' } }, { status: 409 });
    }

    const teacher = await prisma.teacher.update({
      where: { id },
      data
    });

    await prisma.auditLog.create({
      data: {
        actor_user_id: session.userId,
        action: 'TEACHER_UPDATED',
        entity: 'TEACHER',
        entity_id: teacher.id,
      }
    });

    return NextResponse.json(teacher);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update teacher' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;

    // Check if teacher has feedback
    const submissionsCount = await prisma.submission.count({ where: { teacher_id: id } });
    
    if (submissionsCount === 0) {
      // Hard delete
      await prisma.teacher.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'TEACHER_DELETED',
          entity: 'TEACHER',
          entity_id: id,
          metadata: { mode: 'HARD_DELETE' }
        }
      });
    } else {
      // Archive
      await prisma.teacher.update({
        where: { id },
        data: {
          archived: true,
          archived_at: new Date(),
          archived_by: session.userId
        }
      });
      await prisma.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'TEACHER_ARCHIVED',
          entity: 'TEACHER',
          entity_id: id,
          metadata: { mode: 'ARCHIVE', submissions: submissionsCount }
        }
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete teacher' } }, { status: 500 });
  }
}
