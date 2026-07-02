import { z } from 'zod';

export const departmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  code: z.string().min(1, 'Code is required').max(20),
});

export const batchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  program: z.string().optional(),
  year: z.number().int().min(2000).max(2100).optional(),
});

export const teacherSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email(),
  phone: z.string().optional(),
  designation: z.enum(['FACULTY', 'RESIDENT']),
  department_id: z.string().uuid(),
});

export const teacherBulkImportSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email(),
  phone: z.string().optional(),
  designation: z.enum(['faculty', 'resident']).transform(v => v.toUpperCase() as 'FACULTY' | 'RESIDENT'),
  department_code: z.string().min(1),
});
