import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { studentMoveBatchSchema } from '@/lib/validations/user';
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
    const { new_batch_id } = studentMoveBatchSchema.parse(body);

    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Student not found' } }, { status: 404 });
    }

    if (profile.batch_id === new_batch_id) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Student is already in this batch' } }, { status: 400 });
    }

    const newBatch = await prisma.batch.findUnique({ where: { id: new_batch_id } });
    if (!newBatch) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'New batch not found' } }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Record history
      await tx.batchHistory.create({
        data: {
          student_profile_id: id,
          from_batch_id: profile.batch_id,
          to_batch_id: new_batch_id,
          moved_by: session.userId,
        }
      });

      // Update batch
      await tx.studentProfile.update({
        where: { id },
        data: { batch_id: new_batch_id }
      });

      await tx.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'STUDENT_MOVED',
          entity: 'STUDENT',
          entity_id: id,
          metadata: { from_batch_id: profile.batch_id, to_batch_id: new_batch_id }
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to move student' } }, { status: 500 });
  }
}
