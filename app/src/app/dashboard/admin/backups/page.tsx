import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import BackupsClient from './BackupsClient';

export default async function BackupsPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/auth/login');
  }

  const isSuperadmin = session.role === 'SUPERADMIN';

  const rawBackups = await prisma.backup.findMany({
    orderBy: { created_at: 'desc' },
  });

  const initialBackups = rawBackups.map(b => ({
    ...b,
    size_bytes: b.size_bytes?.toString() || null
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Database Backups</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage encrypted database backups.</p>
      </div>

      <BackupsClient initialData={initialBackups} isSuperadmin={isSuperadmin} />
    </div>
  );
}
