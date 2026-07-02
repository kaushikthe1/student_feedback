import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { batchSchema } from '@/lib/validations/master';
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
    const data = batchSchema.parse(body);

    const existing = await prisma.batch.findFirst({
      where: {
        id: { not: id },
        name: data.name
      }
    });

    if (existing) {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Batch name already exists' } }, { status: 409 });
    }

    const batch = await prisma.batch.update({
      where: { id },
      data
    });

    return NextResponse.json(batch);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update batch' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;

    // Check if batch is in use
    const studentCount = await prisma.studentProfile.count({ where: { batch_id: id } });
    if (studentCount > 0) {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Cannot delete batch with assigned students' } }, { status: 409 });
    }

    await prisma.batch.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete batch' } }, { status: 500 });
  }
}
