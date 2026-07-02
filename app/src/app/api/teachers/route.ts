import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { teacherSchema } from '@/lib/validations/master';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');

    const teachers = await prisma.teacher.findMany({
      where: {
        archived: false,
        ...(departmentId ? { department_id: departmentId } : {})
      },
      include: {
        department: true,
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(teachers);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch teachers' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const body = await request.json();
    const data = teacherSchema.parse(body);

    const existing = await prisma.teacher.findFirst({
      where: { email: data.email, archived: false }
    });

    if (existing) {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Teacher email already exists' } }, { status: 409 });
    }

    const teacher = await prisma.teacher.create({
      data,
      include: {
        department: true
      }
    });

    await prisma.auditLog.create({
      data: {
        actor_user_id: session.userId,
        action: 'TEACHER_CREATED',
        entity: 'TEACHER',
        entity_id: teacher.id,
      }
    });

    return NextResponse.json(teacher, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create teacher' } }, { status: 500 });
  }
}
