import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formSchema } from '@/lib/validations/form';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;

    const form = await prisma.form.findUnique({
      where: { id },
      include: {
        questions: {
          include: { options: true },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!form) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Form not found' } }, { status: 404 });
    }

    return NextResponse.json(form);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch form' } }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const data = formSchema.parse(body);

    const existing = await prisma.form.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Form not found' } }, { status: 404 });
    }

    if (existing.locked) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Cannot edit a locked form. Duplicate it as a new version instead.' } }, { status: 403 });
    }

    const form = await prisma.$transaction(async (tx) => {
      const updatedForm = await tx.form.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
        }
      });

      // Simple approach: delete all questions and recreate them
      // This is safe since the form is unlocked (no responses yet)
      await tx.question.deleteMany({ where: { form_id: id } });

      for (const q of data.questions) {
        const question = await tx.question.create({
          data: {
            form_id: id,
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
          action: 'FORM_UPDATED',
          entity: 'FORM',
          entity_id: id,
        }
      });

      return updatedForm;
    });

    return NextResponse.json(form);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update form' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const { id } = await context.params;

    const existing = await prisma.form.findUnique({ where: { id } });
    if (!existing) {
      return new NextResponse(null, { status: 204 });
    }

    const submissionsCount = await prisma.submission.count({ where: { form_id: id } });

    if (submissionsCount === 0) {
      // Hard delete
      await prisma.form.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'FORM_DELETED',
          entity: 'FORM',
          entity_id: id,
          metadata: { mode: 'HARD_DELETE' }
        }
      });
    } else {
      // Archive
      await prisma.form.update({
        where: { id },
        data: {
          archived: true,
          archived_at: new Date(),
          archived_by: session.userId
        }
      });
      await prisma.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'FORM_ARCHIVED',
          entity: 'FORM',
          entity_id: id,
          metadata: { mode: 'ARCHIVE', submissions: submissionsCount }
        }
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete form' } }, { status: 500 });
  }
}
