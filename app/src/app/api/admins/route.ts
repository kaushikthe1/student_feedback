import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSuperadmin = session.role === 'SUPERADMIN';

    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'SUPERADMIN'] },
        // Regular admins cannot see hidden admins (superadmin)
        ...(isSuperadmin ? {} : { is_hidden: false }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        is_hidden: true,
        last_login_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(admins);
  } catch (error) {
    console.error('Failed to fetch admins:', error);
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Only SUPERADMIN can create SUPERADMIN
    const targetRole = role === 'SUPERADMIN' && session.role === 'SUPERADMIN' ? 'SUPERADMIN' : 'ADMIN';

    // Check existing email
    const existing = await prisma.user.findUnique({
      where: { active_email: { email, is_active: true } },
    });

    if (existing) {
      return NextResponse.json({ error: 'This email cannot be used' }, { status: 400 }); // generic error
    }

    const password_hash = await hashPassword(password);

    const newAdmin = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: targetRole,
        is_active: true,
        must_change_password: true,
        is_hidden: false,
      },
    });

    await logAudit(session.userId, 'CREATE_ADMIN', 'User', newAdmin.id);

    return NextResponse.json({ success: true, id: newAdmin.id });
  } catch (error) {
    console.error('Failed to create admin:', error);
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 });
  }
}
