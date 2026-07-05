"use server";

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function toggleFlag(submissionId: string, currentStatus: boolean) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    throw new Error('Unauthorized');
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: { is_flagged: !currentStatus }
  });

  revalidatePath('/dashboard/admin/reports/language-review');
}
