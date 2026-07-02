import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { studentSchema } from '@/lib/validations/user';
import { z } from 'zod';
import { getSession, hashPassword } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batch_id');

    const students = await prisma.studentProfile.findMany({
      where: {
        archived: false,
        ...(batchId ? { batch_id: batchId } : {})
      },
      include: {
        user: {
          select: { name: true, email: true, is_active: true }
        },
        batch: true,
      },
      orderBy: { roll_number: 'asc' }
    });

    return NextResponse.json(students);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch students' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const body = await request.json();
    const data = studentSchema.parse(body);

    // Check unique email among active users
    const existingEmail = await prisma.user.findFirst({
      where: { email: data.email, is_active: true }
    });

    if (existingEmail) {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Email already in use' } }, { status: 409 });
    }

    // Check unique roll number among active profiles
    const existingRoll = await prisma.studentProfile.findFirst({
      where: { roll_number: data.roll_number, archived: false }
    });

    if (existingRoll) {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Roll number already exists' } }, { status: 409 });
    }

    const passwordHash = await hashPassword(data.password);

    const student = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: 'STUDENT',
          email: data.email,
          name: data.name,
          password_hash: passwordHash,
          must_change_password: true, // forced on first login
          is_active: true,
        }
      });

      const profile = await tx.studentProfile.create({
        data: {
          user_id: user.id,
          roll_number: data.roll_number,
          batch_id: data.batch_id,
          contact: data.contact,
        },
        include: {
          user: {
            select: { name: true, email: true, is_active: true }
          },
          batch: true,
        }
      });

      await tx.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'STUDENT_CREATED',
          entity: 'STUDENT',
          entity_id: profile.id,
        }
      });

      return profile;
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create student' } }, { status: 500 });
  }
}
