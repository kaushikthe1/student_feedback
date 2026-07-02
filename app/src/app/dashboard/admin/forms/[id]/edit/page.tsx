import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import FormBuilder from '../../new/FormBuilder';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/auth/login');
  }

  const { id } = await params;
  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      questions: {
        include: { options: true },
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!form) {
    notFound();
  }

  if (form.locked) {
    // Should not normally reach here if UI hides the edit button
    redirect('/dashboard/admin/forms');
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
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Edit Form</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Modify your draft form template.</p>
      </div>

      <FormBuilder initialData={form} />
    </div>
  );
}
