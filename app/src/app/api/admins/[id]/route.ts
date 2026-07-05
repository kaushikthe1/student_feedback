import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, password, is_active } = await req.json();

    const targetAdmin = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Admins cannot edit superadmin
    if (targetAdmin.is_hidden && session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only SUPERADMIN can suspend (is_active = false)
    if (is_active === false && session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Only SUPERADMIN can suspend admins' }, { status: 403 });
    }

    // Cannot suspend superadmin
    if (is_active === false && targetAdmin.role === 'SUPERADMIN') {
      return NextResponse.json({ error: 'Cannot suspend SUPERADMIN' }, { status: 403 });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (password) {
      updateData.password_hash = await hashPassword(password);
      // Optional: revoke sessions
      updateData.token_version = { increment: 1 };
    }
    if (typeof is_active === 'boolean') {
      updateData.is_active = is_active;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    await logAudit(session.id, 'UPDATE_ADMIN', 'User', updated.id, updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update admin:', error);
    return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Only SUPERADMIN can delete admins' }, { status: 403 });
    }

    const targetAdmin = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if (targetAdmin.role === 'SUPERADMIN') {
      return NextResponse.json({ error: 'Cannot delete SUPERADMIN' }, { status: 403 });
    }

    await prisma.user.delete({
      where: { id },
    });

    await logAudit(session.id, 'DELETE_ADMIN', 'User', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete admin:', error);
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 });
  }
}
