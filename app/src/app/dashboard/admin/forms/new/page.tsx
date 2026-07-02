import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import FormBuilder from './FormBuilder';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function NewFormPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/auth/login');
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/admin/forms" className="flex items-center hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Forms
        </Link>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Form Builder</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Create a new feedback form template.</p>
      </div>

      <FormBuilder />
    </div>
  );
}
