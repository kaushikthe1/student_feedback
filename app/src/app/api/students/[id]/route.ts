import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { studentEditSchema } from '@/lib/validations/user';
import { z } from 'zod';
import { getSession, hashPassword } from '@/lib/auth';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const data = studentEditSchema.parse(body);

    const profile = await prisma.studentProfile.findUnique({ where: { id }, include: { user: true } });
    if (!profile) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Student not found' } }, { status: 404 });
    }

    // Check unique email among active users
    if (data.email !== profile.user.email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: data.email, is_active: true }
      });
      if (existingEmail) {
        return NextResponse.json({ error: { code: 'CONFLICT', message: 'Email already in use' } }, { status: 409 });
      }
    }

    // Check unique roll number among active profiles
    if (data.roll_number !== profile.roll_number) {
      const existingRoll = await prisma.studentProfile.findFirst({
        where: { roll_number: data.roll_number, archived: false }
      });
      if (existingRoll) {
        return NextResponse.json({ error: { code: 'CONFLICT', message: 'Roll number already exists' } }, { status: 409 });
      }
    }

    await prisma.$transaction(async (tx) => {
      const updateData: any = {
        email: data.email,
        name: data.name,
      };

      if (data.password) {
        updateData.password_hash = await hashPassword(data.password);
        updateData.token_version = { increment: 1 }; // Logout existing sessions
        updateData.must_change_password = true;
      }

      await tx.user.update({
        where: { id: profile.user_id },
        data: updateData,
      });

      await tx.studentProfile.update({
        where: { id },
        data: {
          roll_number: data.roll_number,
          contact: data.contact,
        }
      });

      await tx.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'STUDENT_UPDATED',
          entity: 'STUDENT',
          entity_id: id,
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update student' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) return new NextResponse(null, { status: 204 });

    const submissionsCount = await prisma.submission.count({ where: { student_id: profile.user_id } });

    await prisma.$transaction(async (tx) => {
      if (submissionsCount === 0) {
        // Hard delete
        await tx.studentProfile.delete({ where: { id } });
        await tx.user.delete({ where: { id: profile.user_id } });
        await tx.auditLog.create({
          data: {
            actor_user_id: session.userId,
            action: 'STUDENT_DELETED',
            entity: 'STUDENT',
            entity_id: id,
            metadata: { mode: 'HARD_DELETE' }
          }
        });
      } else {
        // Archive
        await tx.studentProfile.update({
          where: { id },
          data: { archived: true }
        });
        // Cascade to user.is_active = false
        await tx.user.update({
          where: { id: profile.user_id },
          data: { 
            is_active: false,
            token_version: { increment: 1 } // revoke sessions
          }
        });
        await tx.auditLog.create({
          data: {
            actor_user_id: session.userId,
            action: 'STUDENT_ARCHIVED',
            entity: 'STUDENT',
            entity_id: id,
            metadata: { mode: 'ARCHIVE', submissions: submissionsCount }
          }
        });
      }
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete student' } }, { status: 500 });
  }
}
