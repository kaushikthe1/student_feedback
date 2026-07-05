import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { getBackupFilePath, decryptBuffer } from '@/lib/backup-utils';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const backup = await prisma.backup.findUnique({
      where: { id },
    });

    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    if (backup.filename.includes('.json')) {
      return NextResponse.json({ 
        error: 'JSON backups are for export/download only. Restoring requires an SQL backup file generated in the Docker environment.' 
      }, { status: 400 });
    }

    const filePath = getBackupFilePath(backup.filename);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Backup file missing from disk' }, { status: 404 });
    }

    // Read and decrypt
    const encryptedData = fs.readFileSync(filePath);
    const decryptedSql = decryptBuffer(encryptedData);
    
    // Write decrypted to temp file
    const tempSqlPath = path.join(process.cwd(), 'backups', `restore_temp_${Date.now()}.sql`);
    fs.writeFileSync(tempSqlPath, decryptedSql);

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("No DATABASE_URL found");

    const maintenancePath = path.join(process.cwd(), '.maintenance');
    const epochPath = path.join(process.cwd(), 'session-epoch.txt');

    try {
      // Enter maintenance mode and log start
      fs.writeFileSync(maintenancePath, 'RESTORING');
      await logAudit(session.id, 'RESTORE_STARTED', 'Backup', backup.id);

      // Execute psql to restore (note: this requires psql in PATH)
      await execAsync(`psql "${dbUrl}" -f "${tempSqlPath}"`);
      
      // Clean up temp sql file
      if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
      
      // Bump epoch to invalidate all old sessions
      fs.writeFileSync(epochPath, Date.now().toString());

      // Log completion and exit maintenance mode
      await logAudit(session.id, 'RESTORE_COMPLETED', 'Backup', backup.id);
      if (fs.existsSync(maintenancePath)) fs.unlinkSync(maintenancePath);

      return NextResponse.json({ success: true });
    } catch (execError) {
      if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
      if (fs.existsSync(maintenancePath)) fs.unlinkSync(maintenancePath);
      console.error('psql execution failed:', execError);
      return NextResponse.json({ 
        error: 'Failed to execute psql. Ensure you are running in the Docker production environment where PostgreSQL client tools are installed.' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Failed to restore backup:', error);
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 });
  }
}
