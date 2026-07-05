import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { studentBulkImportSchema } from '@/lib/validations/user';
import { z } from 'zod';
import { getSession, hashPassword } from '@/lib/auth';

const importRequestSchema = z.object({
  rows: z.array(studentBulkImportSchema).min(1).max(10000),
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

    // Pre-fetch all batches
    const batches = await prisma.batch.findMany({ select: { id: true, name: true } });
    const batchMap = new Map(batches.map(b => [b.name, b.id]));

    // Check existing active emails
    const activeUsers = await prisma.user.findMany({ where: { is_active: true }, select: { email: true } });
    const existingEmails = new Set(activeUsers.map(u => u.email));
    
    // Check existing active roll numbers
    const activeProfiles = await prisma.studentProfile.findMany({ where: { archived: false }, select: { roll_number: true } });
    const existingRolls = new Set(activeProfiles.map(p => p.roll_number));

    // Check for duplicates within file
    const fileEmails = new Set<string>();
    const fileRolls = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (!batchMap.has(row.batch_name)) {
        errors.push({ row: i + 1, error: `Batch name '${row.batch_name}' not found` });
        continue;
      }

      if (existingEmails.has(row.login_email)) {
        errors.push({ row: i + 1, error: `Email '${row.login_email}' already in use` });
        continue;
      }

      if (existingRolls.has(row.roll_number)) {
        errors.push({ row: i + 1, error: `Roll number '${row.roll_number}' already exists` });
        continue;
      }

      if (fileEmails.has(row.login_email)) {
        errors.push({ row: i + 1, error: `Duplicate email '${row.login_email}' within file` });
        continue;
      }

      if (fileRolls.has(row.roll_number)) {
        errors.push({ row: i + 1, error: `Duplicate roll number '${row.roll_number}' within file` });
        continue;
      }

      fileEmails.add(row.login_email);
      fileRolls.add(row.roll_number);

      validRows.push({
        ...row,
        batch_id: batchMap.get(row.batch_name)!,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 422 });
    }

    if (dryRun) {
      return NextResponse.json({ success: true, message: `Dry run successful. ${validRows.length} rows ready.` });
    }

    // Pre-hash passwords outside the transaction to prevent holding long DB locks (argon2 is CPU bound)
    const hashedRows: any[] = [];
    for (const row of validRows) {
      const passwordHash = await hashPassword(row.password);
      hashedRows.push({ ...row, passwordHash });
    }

    // Atomic insertion of User + StudentProfile pairs is hard with createMany, so loop with transaction
    await prisma.$transaction(async (tx) => {
      for (const row of hashedRows) {
        const user = await tx.user.create({
          data: {
            role: 'STUDENT',
            email: row.login_email,
            name: row.name,
            password_hash: row.passwordHash,
            must_change_password: true,
            is_active: true,
          }
        });

        await tx.studentProfile.create({
          data: {
            user_id: user.id,
            roll_number: row.roll_number,
            batch_id: row.batch_id,
            contact: row.contact,
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actor_user_id: session.userId,
          action: 'STUDENT_CSV_IMPORTED',
          entity: 'STUDENT',
          metadata: { rowsImported: validRows.length }
        }
      });
    });

    return NextResponse.json({ success: true, message: `Imported ${validRows.length} students.` }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to import students' } }, { status: 500 });
  }
}
