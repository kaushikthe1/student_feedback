import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import DepartmentsClient from './DepartmentsClient';

export default async function DepartmentsPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  const initialDepartments = await prisma.department.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Departments Management</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage the departments within the institution.</p>
      </div>

      <DepartmentsClient initialData={initialDepartments} />
    </div>
  );
}
