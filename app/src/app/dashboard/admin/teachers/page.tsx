import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import TeachersClient from './TeachersClient';

export default async function TeachersPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  const initialTeachers = await prisma.teacher.findMany({
    where: { archived: false },
    include: { department: true },
    orderBy: { name: 'asc' }
  });

  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Teachers Management</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage teaching staff and their department allocations.</p>
      </div>

      <TeachersClient initialData={initialTeachers} departments={departments} />
    </div>
  );
}
