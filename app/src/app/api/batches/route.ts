import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { batchSchema } from '@/lib/validations/master';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const batches = await prisma.batch.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(batches);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch batches' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const body = await request.json();
    const data = batchSchema.parse(body);

    const existing = await prisma.batch.findFirst({
      where: { name: data.name }
    });

    if (existing) {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Batch name already exists' } }, { status: 409 });
    }

    const batch = await prisma.batch.create({
      data
    });

    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create batch' } }, { status: 500 });
  }
}
