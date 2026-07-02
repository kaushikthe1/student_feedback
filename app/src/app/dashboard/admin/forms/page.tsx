import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Settings, FileText, CheckCircle2, ClipboardList } from 'lucide-react';

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
            {forms.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No forms found. Create one to get started.</td>
              </tr>
            ) : (
              forms.map((form) => (
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
                    {form.status === 'DRAFT' && !form.locked ? (
                      <Link href={`/dashboard/admin/forms/${form.id}/edit`} className="text-gray-400 hover:text-primary transition-colors inline-block" title="Edit Draft">
                        <Settings className="w-5 h-5 inline" />
                      </Link>
                    ) : form.status === 'PUBLISHED' ? (
                      <>
                        <button className="text-gray-300 cursor-not-allowed inline-block mr-3" title="Published forms cannot be edited directly">
                          <Settings className="w-5 h-5 inline" />
                        </button>
                        <Link href={`/dashboard/admin/forms/${form.id}`} className="text-primary hover:text-blue-700 transition-colors inline-block" title="Manage Assignments">
                          <ClipboardList className="w-5 h-5 inline" />
                        </Link>
                      </>
                    ) : (
                      <button className="text-gray-300 cursor-not-allowed inline-block" title="Published forms cannot be edited directly">
                        <Settings className="w-5 h-5 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
