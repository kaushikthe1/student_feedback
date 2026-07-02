import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import StudentsClient from './StudentsClient';

export default async function StudentsPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/auth/login');
  }

  const initialProfiles = await prisma.studentProfile.findMany({
    where: { archived: false, user: { is_active: true } },
    include: { user: true, batch: true },
    orderBy: { user: { name: 'asc' } }
  });

  const batches = await prisma.batch.findMany({
    orderBy: { year: 'desc' }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Students Management</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage student accounts and batch assignments.</p>
      </div>

      <StudentsClient initialData={initialProfiles} batches={batches} />
    </div>
  );
}
