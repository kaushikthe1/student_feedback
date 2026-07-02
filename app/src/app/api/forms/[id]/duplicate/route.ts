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
      include: {
        questions: {
          include: { options: true }
        }
      }
    });

    if (!existingForm) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Form not found' } }, { status: 404 });
    }

    const duplicatedForm = await prisma.$transaction(async (tx) => {
      const newForm = await tx.form.create({
        data: {
          title: `${existingForm.title} (Copy)`,
          description: existingForm.description,
          status: 'DRAFT',
          created_by: session.userId,
        }
      });

      for (const q of existingForm.questions) {
        const question = await tx.question.create({
          data: {
            form_id: newForm.id,
            order: q.order,
            text: q.text,
            type: q.type,
            required: q.required,
            is_scored: q.is_scored,
            scale_min: q.scale_min,
            scale_max: q.scale_max,
          }
        });

        if (q.options && q.options.length > 0) {
          await tx.questionOption.createMany({
            data: q.options.map(opt => ({
              question_id: question.id,
              order: opt.order,
              label: opt.label,
              weight: opt.weight,
            }))
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'FORM_DUPLICATED',
          entity: 'FORM',
          entity_id: newForm.id,
          metadata: { original_form_id: id }
        }
      });

      return newForm;
    });

    return NextResponse.json(duplicatedForm, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to duplicate form' } }, { status: 500 });
  }
}
