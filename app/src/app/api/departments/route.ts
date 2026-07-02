import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { departmentSchema } from '@/lib/validations/master';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(departments);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch departments' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const body = await request.json();
    const data = departmentSchema.parse(body);

    const existing = await prisma.department.findFirst({
      where: {
        OR: [
          { name: data.name },
          { code: data.code }
        ]
      }
    });

    if (existing) {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Department name or code already exists' } }, { status: 409 });
    }

    const department = await prisma.department.create({
      data
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create department' } }, { status: 500 });
  }
}
