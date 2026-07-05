import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import FormsClient from './FormsClient';

export default async function FormsPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/auth/login');
  }

  const forms = await prisma.form.findMany({
    where: { archived: false },
    orderBy: { created_at: 'desc' },
    include: {
      _count: {
        select: { assignments: true, submissions: true }
      }
    }
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Forms</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Manage feedback templates and assignments.</p>
        </div>
        <Link 
          href="/dashboard/admin/forms/new"
          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl shadow-sm hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Form
        </Link>
      </div>

      <FormsClient initialForms={forms} />
    </div>
  );
}
