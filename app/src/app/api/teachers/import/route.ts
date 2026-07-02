import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { teacherBulkImportSchema } from '@/lib/validations/master';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

const importRequestSchema = z.object({
  rows: z.array(teacherBulkImportSchema).min(1).max(10000),
  dryRun: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const body = await request.json();
    const { rows, dryRun } = importRequestSchema.parse(body);

    const errors: { row: number; error: string }[] = [];
    const validRows: any[] = [];

    // Pre-fetch all departments for validation
    const departments = await prisma.department.findMany({ select: { id: true, code: true } });
    const deptMap = new Map(departments.map(d => [d.code, d.id]));

    // Check existing active emails
    const activeTeachers = await prisma.teacher.findMany({ where: { archived: false }, select: { email: true } });
    const existingEmails = new Set(activeTeachers.map(t => t.email));
    
    // Check for duplicates within the uploaded file
    const fileEmails = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (!deptMap.has(row.department_code)) {
        errors.push({ row: i + 1, error: `Department code '${row.department_code}' not found` });
        continue;
      }

      if (existingEmails.has(row.email)) {
        errors.push({ row: i + 1, error: `Email '${row.email}' already exists for an active teacher` });
        continue;
      }

      if (fileEmails.has(row.email)) {
        errors.push({ row: i + 1, error: `Duplicate email '${row.email}' within the uploaded file` });
        continue;
      }

      fileEmails.add(row.email);
      validRows.push({
        name: row.name,
        email: row.email,
        phone: row.phone || null,
        designation: row.designation,
        department_id: deptMap.get(row.department_code)!,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 422 });
    }

    if (dryRun) {
      return NextResponse.json({ success: true, message: `Dry run successful. ${validRows.length} rows ready to import.` });
    }

    // Perform atomic insert
    await prisma.$transaction(async (tx) => {
      await tx.teacher.createMany({
        data: validRows
      });

      await tx.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'TEACHER_CSV_IMPORTED',
          entity: 'TEACHER',
          metadata: { rowsImported: validRows.length }
        }
      });
    });

    return NextResponse.json({ success: true, message: `Successfully imported ${validRows.length} teachers.` }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to import teachers' } }, { status: 500 });
  }
}
