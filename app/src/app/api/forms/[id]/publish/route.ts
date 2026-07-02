import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;

    const existingForm = await prisma.form.findUnique({
      where: { id },
      include: { questions: true }
    });

    if (!existingForm) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Form not found' } }, { status: 404 });
    }

    if (existingForm.questions.length === 0) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Cannot publish a form without questions' } }, { status: 400 });
    }

    if (existingForm.is_template) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Templates cannot be published' } }, { status: 400 });
    }

    const updatedForm = await prisma.form.update({
      where: { id },
      data: { status: 'PUBLISHED' }
    });

    await prisma.auditLog.create({
      data: {
        actor_user_id: session.userId,
        action: 'FORM_PUBLISHED',
        entity: 'FORM',
        entity_id: id,
      }
    });

    return NextResponse.json(updatedForm);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to publish form' } }, { status: 500 });
  }
}
