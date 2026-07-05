import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: { message: 'Token and new password are required' } }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: { message: 'Password must be at least 8 characters' } }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token_hash: tokenHash,
        used_at: null,
        expires_at: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (!resetToken || !resetToken.user || !resetToken.user.is_active) {
      return NextResponse.json({ error: { message: 'Invalid or expired token' } }, { status: 400 });
    }

    const newPasswordHash = await hashPassword(password);

    // Update user and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.user_id },
        data: {
          password_hash: newPasswordHash,
          token_version: { increment: 1 }, // Revokes all existing sessions!
          must_change_password: false // They just changed it!
        }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          used_at: new Date()
        }
      })
    ]);

    // Audit log the password reset
    await prisma.auditLog.create({
      data: {
        actor_user_id: resetToken.user_id,
        action: 'PASSWORD_RESET_VIA_TOKEN',
        entity: 'USER',
        entity_id: resetToken.user_id,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}
