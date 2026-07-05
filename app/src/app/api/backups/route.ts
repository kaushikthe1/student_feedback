import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { createBackupInternal } from '@/lib/backup-utils';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backups = await prisma.backup.findMany({
      orderBy: { created_at: 'desc' },
    });

    // Convert BigInt to string for JSON serialization
    const serializedBackups = backups.map(b => ({
      ...b,
      size_bytes: b.size_bytes?.toString() || null
    }));

    return NextResponse.json(serializedBackups);
  } catch (error) {
    console.error('Failed to fetch backups:', error);
    return NextResponse.json({ error: 'Failed to fetch backups' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Trigger dual-mode backup
    const backupResult = await createBackupInternal();

    const newBackup = await prisma.backup.create({
      data: {
        filename: backupResult.filename,
        created_by: session.userId,
        size_bytes: backupResult.sizeBytes,
        is_encrypted: true,
      },
    });

    await logAudit(session.userId, 'TRIGGER_BACKUP', 'Backup', newBackup.id, { type: backupResult.type });

    const serializedBackup = {
      ...newBackup,
      size_bytes: newBackup.size_bytes?.toString() || null
    };

    return NextResponse.json({ success: true, backup: serializedBackup });
  } catch (error) {
    console.error('Failed to trigger backup:', error);
    return NextResponse.json({ error: 'Failed to trigger backup' }, { status: 500 });
  }
}
