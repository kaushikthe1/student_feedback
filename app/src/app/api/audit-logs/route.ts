import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    // Exclusive to SUPERADMIN
    if (!session || session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Superadmin exclusive feature.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const action = searchParams.get('action');

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(action ? { action } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
