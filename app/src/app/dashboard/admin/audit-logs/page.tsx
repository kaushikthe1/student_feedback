import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import AuditLogsClient from './AuditLogsClient';

export default async function AuditLogsPage() {
  const session = await getSession();
  
  if (!session || session.role !== 'SUPERADMIN') {
    // Only SUPERADMIN can view this page
    redirect('/dashboard/admin');
  }

  const initialLogs = await prisma.auditLog.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Audit Logs</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">System-wide security and access auditing (Superadmin exclusive).</p>
      </div>

      <AuditLogsClient initialData={initialLogs} />
    </div>
  );
}
