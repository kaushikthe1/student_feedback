import { z } from 'zod';

export const questionOptionSchema = z.object({
  order: z.number().int().min(0),
  label: z.string().min(1),
  weight: z.number().nullable().optional(),
});

export const questionSchema = z.object({
  order: z.number().int().min(0),
  text: z.string().min(1),
  type: z.enum(['RATING', 'MCQ', 'DROPDOWN', 'OPEN_ENDED']),
  required: z.boolean().default(true),
  is_scored: z.boolean().default(true),
  scale_min: z.number().int().nullable().optional(),
  scale_max: z.number().int().nullable().optional(),
  options: z.array(questionOptionSchema).optional(),
}).refine(data => {
  if (data.type === 'RATING') {
    return data.scale_min !== undefined && data.scale_min !== null && 
           data.scale_max !== undefined && data.scale_max !== null && 
           data.scale_max > data.scale_min;
  }
  return true;
}, {
  message: "Rating questions must have scale_max > scale_min",
  path: ['scale_max']
});

export const formSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(questionSchema).min(1, 'At least one question is required'),
});

export const formAssignmentSchema = z.object({
  batch_id: z.string().uuid(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  daily_start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Must be HH:mm'),
  daily_end_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Must be HH:mm'),
  allowed_weekdays: z.array(z.enum(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'])).min(1),
}).refine(data => data.end_date >= data.start_date, {
  message: "End date must be on or after start date",
  path: ['end_date']
}).refine(data => data.daily_end_time > data.daily_start_time, {
  message: "Daily end time must be after daily start time",
  path: ['daily_end_time']
});
