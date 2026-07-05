import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import { prisma } from './prisma';
import crypto from 'crypto';
import zlib from 'zlib';

const execAsync = util.promisify(exec);

// Make sure backups dir exists
const BACKUPS_DIR = path.join(process.cwd(), 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function getEncryptionKey(): Buffer {
  const secret = process.env.BACKUP_ENCRYPTION_KEY || 'default-secret-key-must-be-32bytes!';
  // Hash to ensure it's exactly 32 bytes for AES-256
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptBuffer(buffer: Buffer): Buffer {
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Format: [iv(16)] [authTag(16)] [encryptedData]
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBuffer(buffer: Buffer): Buffer {
  const iv = buffer.subarray(0, 16);
  const authTag = buffer.subarray(16, 32);
  const encryptedData = buffer.subarray(32);
  const key = getEncryptionKey();
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

export async function createBackupInternal(): Promise<{ filename: string, sizeBytes: number, type: 'SQL' | 'JSON' }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  try {
    // Attempt pg_dump
    const sqlFilename = `backup_${timestamp}.sql.enc`;
    const sqlPath = path.join(BACKUPS_DIR, sqlFilename);
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) throw new Error("No DATABASE_URL found");

    // We dump to a temp file, then read, encrypt, write. 
    // In production we could pipe, but this is safer across platforms.
    const tempSqlPath = path.join(BACKUPS_DIR, `temp_${timestamp}.sql`);
    await execAsync(`pg_dump "${dbUrl}" -F p -f "${tempSqlPath}"`);
    
    const sqlData = fs.readFileSync(tempSqlPath);
    const encryptedSqlData = encryptBuffer(sqlData);
    fs.writeFileSync(sqlPath, encryptedSqlData);
    
    // Clean up
    fs.unlinkSync(tempSqlPath);
    
    return { filename: sqlFilename, sizeBytes: encryptedSqlData.length, type: 'SQL' };
  } catch (error) {
    console.warn("pg_dump failed, falling back to JSON backup. Error:", error);
    
    // JSON Fallback
    const jsonFilename = `backup_${timestamp}.json.enc`;
    const jsonPath = path.join(BACKUPS_DIR, jsonFilename);
    
    // Fetch all critical data
    const users = await prisma.user.findMany();
    const departments = await prisma.department.findMany();
    const teachers = await prisma.teacher.findMany();
    const batches = await prisma.batch.findMany();
    const studentProfiles = await prisma.studentProfile.findMany();
    const forms = await prisma.form.findMany();
    const questions = await prisma.question.findMany();
    const questionOptions = await prisma.questionOption.findMany();
    const formAssignments = await prisma.formAssignment.findMany();
    const submissions = await prisma.submission.findMany();
    const answers = await prisma.answer.findMany();

    const dumpData = {
      users, departments, teachers, batches, studentProfiles, forms, questions, questionOptions, formAssignments, submissions, answers
    };

    // Serialize, ignoring BigInt issues by converting
    const jsonString = JSON.stringify(dumpData, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
    
    // Compress
    const compressed = zlib.gzipSync(jsonString);
    
    // Encrypt
    const encryptedJsonData = encryptBuffer(compressed);
    fs.writeFileSync(jsonPath, encryptedJsonData);
    
    return { filename: jsonFilename, sizeBytes: encryptedJsonData.length, type: 'JSON' };
  }
}

export function getBackupFilePath(filename: string): string {
  return path.join(BACKUPS_DIR, filename);
}
