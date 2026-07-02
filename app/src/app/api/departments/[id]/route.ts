import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { departmentSchema } from '@/lib/validations/master';
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
    const data = departmentSchema.parse(body);

    const existing = await prisma.department.findFirst({
      where: {
        id: { not: id },
        OR: [
          { name: data.name },
          { code: data.code }
        ]
      }
    });

    if (existing) {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Department name or code already exists' } }, { status: 409 });
    }

    const department = await prisma.department.update({
      where: { id },
      data
    });

    return NextResponse.json(department);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update department' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;

    // Check if department is in use
    const teachersCount = await prisma.teacher.count({ where: { department_id: id } });
    if (teachersCount > 0) {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Cannot delete department with assigned teachers' } }, { status: 409 });
    }

    await prisma.department.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete department' } }, { status: 500 });
  }
}
