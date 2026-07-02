import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

const bulkDeleteSchema = z.object({
  teacherIds: z.array(z.string().uuid()).min(1),
  permanentPurge: z.boolean().default(false), // true is super-admin only
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const body = await request.json();
    const { teacherIds, permanentPurge } = bulkDeleteSchema.parse(body);

    if (permanentPurge && session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Permanent purge requires super-admin' } }, { status: 403 });
    }

    let hardDeleted = 0;
    let archived = 0;
    let purged = 0;

    // We do this inside a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      for (const id of teacherIds) {
        const teacher = await tx.teacher.findUnique({ where: { id } });
        if (!teacher) continue;

        const submissionsCount = await tx.submission.count({ where: { teacher_id: id } });

        if (permanentPurge) {
          // Super-admin purge - deletes regardless of feedback
          await tx.teacher.delete({ where: { id } });
          purged++;
        } else if (submissionsCount === 0) {
          // Hard delete
          await tx.teacher.delete({ where: { id } });
          hardDeleted++;
        } else {
          // Archive
          await tx.teacher.update({
            where: { id },
            data: {
              archived: true,
              archived_at: new Date(),
              archived_by: session.userId,
            }
          });
          archived++;
        }
      }

      await tx.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'TEACHER_BULK_DELETED',
          entity: 'TEACHER',
          metadata: { hardDeleted, archived, purged, totalRequested: teacherIds.length, permanentPurge }
        }
      });
    });

    return NextResponse.json({ success: true, hardDeleted, archived, purged });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to bulk delete teachers' } }, { status: 500 });
  }
}
