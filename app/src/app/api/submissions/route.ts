import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { submissionSchema } from '@/lib/validations/submission';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Only students can submit forms' } }, { status: 403 });
    }

    const body = await request.json();
    const data = submissionSchema.parse(body);

    const profile = await prisma.studentProfile.findUnique({
      where: { user_id: session.userId }
    });

    if (!profile) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Student profile not found' } }, { status: 404 });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: data.teacher_id } });
    if (!teacher) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Teacher not found' } }, { status: 404 });
    }

    // Check if form is published and assigned to student's current batch
    const assignment = await prisma.formAssignment.findFirst({
      where: {
        form_id: data.form_id,
        batch_id: profile.batch_id,
      },
      include: { form: true }
    });

    if (!assignment || assignment.form.status !== 'PUBLISHED') {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Form is not actively assigned to you' } }, { status: 400 });
    }

    // Check if already submitted for this teacher
    const existing = await prisma.submission.findFirst({
      where: {
        form_id: data.form_id,
        student_id: session.userId,
        teacher_id: data.teacher_id,
      }
    });

    if (existing) {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'You have already submitted feedback for this teacher' } }, { status: 409 });
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: data.responses.map(r => r.question_id) } },
      include: { options: true }
    });

    // Submit form and lock it if it is the first response
    const submission = await prisma.$transaction(async (tx) => {
      if (!assignment.form.locked) {
        await tx.form.update({
          where: { id: data.form_id },
          data: { locked: true }
        });
      }

      const sub = await tx.submission.create({
        data: {
          form_id: data.form_id,
          student_id: session.userId,
          teacher_id: teacher.id,
          department_id: teacher.department_id,
          designation_snapshot: teacher.designation,
          batch_id_snapshot: profile.batch_id,
        }
      });

      for (const resp of data.responses) {
        const question = questions.find(q => q.id === resp.question_id);
        let normalized: number | null = null;
        
        if (question && question.is_scored) {
           if (question.type === 'RATING' && resp.rating_value !== undefined && resp.rating_value !== null) {
              const max = question.scale_max ?? 5;
              const min = question.scale_min ?? 1;
              if (max > min) {
                normalized = ((resp.rating_value - min) / (max - min)) * 100;
              }
           } else if ((question.type === 'MCQ' || question.type === 'DROPDOWN') && resp.selected_option_id) {
              const option = question.options.find(o => o.id === resp.selected_option_id);
              if (option && option.weight !== null && option.weight !== undefined) {
                 const weights = question.options.map(o => o.weight).filter(w => w !== null) as number[];
                 if (weights.length > 0) {
                    const maxWeight = Math.max(...weights);
                    const minWeight = Math.min(...weights);
                    if (maxWeight > minWeight) {
                       normalized = ((option.weight - minWeight) / (maxWeight - minWeight)) * 100;
                    } else if (maxWeight === minWeight) {
                       normalized = 100;
                    }
                 }
              }
           }
        }

        await tx.answer.create({
          data: {
            submission_id: sub.id,
            question_id: resp.question_id,
            option_id: resp.selected_option_id || null,
            text_value: resp.text_response || null,
            numeric_value: resp.rating_value || null,
            normalized_score: normalized,
          }
        });
      }

      return sub;
    });

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to submit form' } }, { status: 500 });
  }
}
