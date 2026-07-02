import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession } from '@/lib/auth';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findFirst({
      where: { email, is_active: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (user.locked_until && user.locked_until > new Date()) {
      return NextResponse.json(
        { error: { code: 'LOCKED_OUT', message: 'Account is temporarily locked due to too many failed attempts' } },
        { status: 429 }
      );
    }

    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      // Increment failed login count
      const newFailedCount = user.failed_login_count + 1;
      let lockedUntil = null;

      if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failed_login_count: newFailedCount,
          locked_until: lockedUntil,
        },
      });

      // Log FAILED_LOGIN
      await prisma.auditLog.create({
        data: {
          actor_user_id: user.id,
          action: 'FAILED_LOGIN',
          entity: 'USER',
          entity_id: user.id,
          ip_address: request.headers.get('x-forwarded-for') || null,
        }
      });

      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
        { status: 401 }
      );
    }

    // Success - reset counters and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failed_login_count: 0,
        locked_until: null,
        last_login_at: new Date(),
      },
    });

    // Create session tokens
    await createSession({
      userId: user.id,
      role: user.role,
      tokenVersion: user.token_version,
    });

    // Log LOGIN
    await prisma.auditLog.create({
      data: {
        actor_user_id: user.id,
        action: 'LOGIN',
        entity: 'USER',
        entity_id: user.id,
        ip_address: request.headers.get('x-forwarded-for') || null,
      }
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        must_change_password: user.must_change_password,
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } },
        { status: 400 }
      );
    }
    console.error('Login error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
