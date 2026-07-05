import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquareWarning } from 'lucide-react';
import LanguageReviewClient from './LanguageReviewClient';

export default async function LanguageReviewPage() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/auth/login');
  }

  // Fetch submissions that contain text answers
  const submissionsWithText = await prisma.submission.findMany({
    where: {
      answers: {
        some: { text_value: { not: null } }
      }
    },
    include: {
      student: { select: { roll_number: true, user: { select: { name: true } } } },
      teacher: { select: { name: true } },
      form: { select: { title: true } },
      answers: {
        where: { text_value: { not: null } },
        select: { text_value: true, question: { select: { text: true } } }
      }
    },
    orderBy: { submitted_at: 'desc' },
    take: 100 // Limiting to latest 100 for performance
  });

  // Log the audit event for viewing raw feedback
  if (submissionsWithText.length > 0) {
    await prisma.auditLog.create({
      data: {
        actor_user_id: session.userId,
        action: 'RAW_FEEDBACK_VIEWED',
        entity: 'System',
        metadata: { context: 'Language Review Page', limit: 100 },
        ip_address: 'internal'
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/admin/reports" className="flex items-center hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Reports
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
          <MessageSquareWarning className="w-8 h-8 text-red-500" />
          Language Review
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Review recent open-ended feedback and flag inappropriate language. This action has been securely logged.
        </p>
      </div>

      <LanguageReviewClient submissions={submissionsWithText} />
    </div>
  );
}
