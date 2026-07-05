import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import AdminsClient from './AdminsClient';

export default async function AdminsPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/auth/login');
  }

  const isSuperadmin = session.role === 'SUPERADMIN';

  const initialAdmins = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'SUPERADMIN'] },
      ...(isSuperadmin ? {} : { is_hidden: false }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      is_active: true,
      is_hidden: true,
      last_login_at: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Admin Management</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage administrative users and their access.</p>
      </div>

      <AdminsClient initialData={initialAdmins} isSuperadmin={isSuperadmin} />
    </div>
  );
}
