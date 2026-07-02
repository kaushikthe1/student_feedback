import { z } from 'zod';

export const studentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'), // Optional for edit, but required for create
  roll_number: z.string().min(1),
  batch_id: z.string().uuid(),
  contact: z.string().optional(),
});

export const studentEditSchema = studentSchema.extend({
  password: z.string().optional(),
});

export const studentBulkImportSchema = z.object({
  name: z.string().min(1),
  roll_number: z.string().min(1),
  batch_name: z.string().min(1), // Use batch_name for easier CSV mapping
  login_email: z.string().email(),
  password: z.string().min(6),
  contact: z.string().optional(),
});

export const studentMoveBatchSchema = z.object({
  new_batch_id: z.string().uuid(),
});
