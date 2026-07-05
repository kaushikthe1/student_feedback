import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { getBackupFilePath } from '@/lib/backup-utils';
import fs from 'fs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return new NextResponse('Unauthorized', { status: 403 });
    }

    const backup = await prisma.backup.findUnique({
      where: { id },
    });

    if (!backup) {
      return new NextResponse('Backup not found', { status: 404 });
    }

    const filePath = getBackupFilePath(backup.filename);
    
    if (!fs.existsSync(filePath)) {
      return new NextResponse('Backup file missing from disk', { status: 404 });
    }

    // Read file and send it
    const fileBuffer = fs.readFileSync(filePath);
    
    await logAudit(session.userId, 'DOWNLOAD_BACKUP', 'Backup', backup.id);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Disposition': `attachment; filename="${backup.filename}"`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Failed to download backup:', error);
    return new NextResponse('Failed to download backup', { status: 500 });
  }
}
