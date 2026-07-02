import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

const bulkDeleteSchema = z.object({
  studentIds: z.array(z.string().uuid()).optional(),
  batchId: z.string().uuid().optional(),
  permanentPurge: z.boolean().default(false), // true is super-admin only
}).refine(data => data.studentIds || data.batchId, {
  message: "Either studentIds or batchId must be provided"
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const body = await request.json();
    const { studentIds, batchId, permanentPurge } = bulkDeleteSchema.parse(body);

    if (permanentPurge && session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Permanent purge requires super-admin' } }, { status: 403 });
    }

    let targetIds: string[] = [];

    if (studentIds && studentIds.length > 0) {
      targetIds = studentIds;
    } else if (batchId) {
      const profiles = await prisma.studentProfile.findMany({ where: { batch_id: batchId } });
      targetIds = profiles.map(p => p.id);
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ success: true, message: 'No students found to delete' });
    }

    let hardDeleted = 0;
    let archived = 0;
    let purged = 0;

    await prisma.$transaction(async (tx) => {
      for (const id of targetIds) {
        const profile = await tx.studentProfile.findUnique({ where: { id } });
        if (!profile) continue;

        const submissionsCount = await tx.submission.count({ where: { student_id: profile.user_id } });

        if (permanentPurge) {
          await tx.studentProfile.delete({ where: { id } });
          await tx.user.delete({ where: { id: profile.user_id } });
          purged++;
        } else if (submissionsCount === 0) {
          // Hard delete
          await tx.studentProfile.delete({ where: { id } });
          await tx.user.delete({ where: { id: profile.user_id } });
          hardDeleted++;
        } else {
          // Archive
          await tx.studentProfile.update({
            where: { id },
            data: { archived: true }
          });
          await tx.user.update({
            where: { id: profile.user_id },
            data: { 
              is_active: false,
              token_version: { increment: 1 }
            }
          });
          archived++;
        }
      }

      await tx.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'STUDENT_BULK_DELETED',
          entity: 'STUDENT',
          metadata: { hardDeleted, archived, purged, totalRequested: targetIds.length, permanentPurge, batchId }
        }
      });
    });

    return NextResponse.json({ success: true, hardDeleted, archived, purged });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to bulk delete students' } }, { status: 500 });
  }
}
