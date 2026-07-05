import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import FormAssignmentsClient from './FormAssignmentsClient';

export default async function FormDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  const { id } = await params;

  const form = await prisma.form.findUnique({
    where: { id },
  });

  if (!form) {
    notFound();
  }

  if (form.status !== 'PUBLISHED') {
    redirect(`/dashboard/admin/forms`);
  }

  const assignments = await prisma.formAssignment.findMany({
    where: { form_id: id },
    include: { batch: true },
    orderBy: { created_at: 'desc' }
  });

  const batches = await prisma.batch.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <FormAssignmentsClient 
      form={form} 
      initialAssignments={assignments} 
      batches={batches} 
    />
  );
}
