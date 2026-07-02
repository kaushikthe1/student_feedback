import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getSession, hashPassword } from '@/lib/auth';

const resetSchema = z.object({
  new_password: z.string().min(12, 'Password must be at least 12 characters'),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { new_password } = resetSchema.parse(body);

    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Student not found' } }, { status: 404 });
    }

    const passwordHash = await hashPassword(new_password);

    await prisma.user.update({
      where: { id: profile.user_id },
      data: {
        password_hash: passwordHash,
        token_version: { increment: 1 },
        must_change_password: true,
        failed_login_count: 0,
        locked_until: null,
      }
    });

    await prisma.auditLog.create({
      data: {
        actor_user_id: session.userId,
        action: 'PASSWORD_RESET',
        entity: 'USER',
        entity_id: profile.user_id,
        metadata: { method: 'ADMIN_FORCED' }
      }
    });

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to reset password' } }, { status: 500 });
  }
}
