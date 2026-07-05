"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, CheckCircle2, ClipboardList, Edit, Copy, Loader2 } from 'lucide-react';

type FormSummary = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  locked: boolean;
  _count: {
    assignments: number;
    submissions: number;
  };
};

export default function FormsClient({ initialForms }: { initialForms: FormSummary[] }) {
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const router = useRouter();

  const handleDuplicate = async (formId: string) => {
    try {
      setIsDuplicating(formId);
      const res = await fetch(`/api/forms/${formId}/duplicate`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to duplicate form');
      }
      router.refresh();
    } catch (error) {
      alert('Error duplicating form. Please try again.');
    } finally {
      setIsDuplicating(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form Title</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Assignments</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Submissions</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {initialForms.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No forms found. Create one to get started.</td>
            </tr>
          ) : (
            initialForms.map((form) => (
              <tr key={form.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{form.title}</div>
                      {form.description && <div className="text-xs text-gray-500">{form.description.substring(0, 50)}...</div>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    form.status === 'PUBLISHED' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {form.status === 'PUBLISHED' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {form.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  {form._count.assignments}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  {form._count.submissions}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {isDuplicating === form.id ? (
                    <span className="inline-block mr-4 text-gray-400">
                      <Loader2 className="w-5 h-5 inline animate-spin" />
                    </span>
                  ) : (
                    <button onClick={() => handleDuplicate(form.id)} className="text-gray-400 hover:text-primary transition-colors inline-block mr-4" title="Duplicate Form">
                      <Copy className="w-5 h-5 inline" />
                    </button>
                  )}
                  
                  {form.status === 'DRAFT' && !form.locked ? (
                    <Link href={`/dashboard/admin/forms/${form.id}/edit`} className="text-gray-400 hover:text-primary transition-colors inline-block" title="Edit Draft">
                      <Edit className="w-5 h-5 inline" />
                    </Link>
                  ) : form.status === 'PUBLISHED' ? (
                    <>
                      <button className="text-gray-300 cursor-not-allowed inline-block mr-3" title="Published forms cannot be edited directly">
                        <Edit className="w-5 h-5 inline" />
                      </button>
                      <Link href={`/dashboard/admin/forms/${form.id}`} className="text-primary hover:text-blue-700 transition-colors inline-block" title="Manage Assignments">
                        <ClipboardList className="w-5 h-5 inline" />
                      </Link>
                    </>
                  ) : (
                    <button className="text-gray-300 cursor-not-allowed inline-block" title="Published forms cannot be edited directly">
                      <Edit className="w-5 h-5 inline" />
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
