import { PrismaClient } from '@prisma/client';
import { getTeacherAnalytics } from '../src/lib/analytics';
import fs from 'fs';
import path from 'path';

// Re-use prisma client initialization logic
let connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres_password@localhost:5432/feedback_db?schema=public';
if (connectionString.startsWith('prisma+postgres://')) {
  try {
    const urlObj = new URL(connectionString);
    const apiKey = urlObj.searchParams.get('api_key');
    if (apiKey) {
      const decoded = JSON.parse(Buffer.from(apiKey, 'base64').toString('utf-8'));
      if (decoded.databaseUrl) {
        connectionString = decoded.databaseUrl.replace('template1', 'postgres');
      }
    }
  } catch (e) {}
}

const prisma = new PrismaClient({
  datasourceUrl: connectionString
});

async function processExportJob(job: any) {
  const { teacher_id, format } = job.payload as { teacher_id: string, format: 'CSV' | 'PDF' };
  
  await prisma.job.update({ where: { id: job.id }, data: { status: 'RUNNING', started_at: new Date() } });

  try {
    const analytics = await getTeacherAnalytics(teacher_id);
    if (!analytics) throw new Error("Teacher not found");

    const reportsDir = path.join(process.cwd(), 'public', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    let fileName = '';
    if (format === 'CSV') {
      fileName = `teacher_${teacher_id}_${Date.now()}.csv`;
      const csvData = [
        "Teacher Name,Department,Designation,Overall Score,Total Submissions",
        `${analytics.teacher.name},${analytics.teacher.department.name},${analytics.teacher.designation},${analytics.overallScore || 0},${analytics.totalSubmissions}`
      ].join('\n');
      
      fs.writeFileSync(path.join(reportsDir, fileName), csvData);
    } else {
      // Stub for PDF generation via worker (using basic txt for now as full jsPDF in node requires canvas)
      // Usually, PDF generation is better done on the client side with jspdf, but if requested as background:
      fileName = `teacher_${teacher_id}_${Date.now()}.txt`;
      const txtData = `Teacher Report\nName: ${analytics.teacher.name}\nScore: ${analytics.overallScore}\nSubmissions: ${analytics.totalSubmissions}`;
      fs.writeFileSync(path.join(reportsDir, fileName), txtData);
    }

    const resultPath = `/reports/${fileName}`;

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completed_at: new Date(), result_path: resultPath }
    });
    console.log(`Processed job ${job.id} -> ${resultPath}`);

  } catch (error: any) {
    console.error(`Job ${job.id} failed:`, error);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'FAILED', completed_at: new Date(), error: error.message }
    });
  }
}

async function startWorker() {
  console.log("Background worker started. Polling for jobs...");
  
  while (true) {
    try {
      const job = await prisma.job.findFirst({
        where: { status: 'PENDING', type: 'EXPORT' },
        orderBy: { created_at: 'asc' }
      });

      if (job) {
        await processExportJob(job);
      } else {
        // Wait 5 seconds before polling again
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (err) {
      console.error("Worker error:", err);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

startWorker();
