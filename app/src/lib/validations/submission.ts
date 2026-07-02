import { z } from 'zod';

export const responseSchema = z.object({
  question_id: z.string().uuid(),
  selected_option_id: z.string().uuid().optional(),
  text_response: z.string().optional(),
  rating_value: z.number().int().optional(),
});

export const submissionSchema = z.object({
  form_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
  responses: z.array(responseSchema).min(1),
  consent_given: z.boolean().refine(val => val === true, {
    message: "You must give consent to submit this form",
  }),
});
