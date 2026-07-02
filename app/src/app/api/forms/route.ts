import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formSchema } from '@/lib/validations/form';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const isTemplate = searchParams.get('is_template') === 'true';

    const forms = await prisma.form.findMany({
      where: {
        archived: false,
        is_template: isTemplate,
      },
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json(forms);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch forms' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const body = await request.json();
    const data = formSchema.parse(body);

    const form = await prisma.$transaction(async (tx) => {
      const newForm = await tx.form.create({
        data: {
          title: data.title,
          description: data.description,
          status: 'DRAFT',
          created_by: session.userId,
        }
      });

      for (const q of data.questions) {
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
          action: 'FORM_CREATED',
          entity: 'FORM',
          entity_id: newForm.id,
        }
      });

      return newForm;
    });

    return NextResponse.json(form, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create form' } }, { status: 500 });
  }
}
