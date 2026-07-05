import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: { message: 'Email is required' } }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email, is_active: true }
    });

    // We always return success to avoid leaking which emails exist
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt
      }
    });

    // Base URL for the reset link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (req.headers.get('host') ? `http://${req.headers.get('host')}` : 'http://localhost:3000');
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    // Queue email job
    await prisma.job.create({
      data: {
        type: 'EMAIL',
        status: 'PENDING',
        payload: {
          to: user.email,
          type: 'PASSWORD_RESET',
          subject: 'Password Reset Request',
          resetLink: resetLink
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}
