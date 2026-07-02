import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import BatchesClient from './BatchesClient';

export default async function BatchesPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/auth/login');
  }

  const initialBatches = await prisma.batch.findMany({
    orderBy: { year: 'desc' }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Batches Management</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage student batches (e.g., 2021-2025, CS Section A).</p>
      </div>

      <BatchesClient initialData={initialBatches} />
    </div>
  );
}
