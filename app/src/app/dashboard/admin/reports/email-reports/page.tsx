import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import EmailReportsClient from './EmailReportsClient';

export default async function EmailReportsPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  const forms = await prisma.form.findMany({
    where: { status: 'PUBLISHED' },
    include: { questions: { orderBy: { order: 'asc' } } },
    orderBy: { created_at: 'desc' }
  });

  const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } });
  const teachers = await prisma.teacher.findMany({
    where: { archived: false },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Bulk Email Reports</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Send PDF analytics reports directly to teachers.</p>
      </div>

      <EmailReportsClient 
        forms={forms} 
        departments={departments} 
        teachers={teachers} 
      />
    </div>
  );
}
