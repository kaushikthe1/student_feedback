import { PrismaClient } from '@prisma/client';
import { getTeacherAnalytics, getDepartmentAverages, getInstituteAverages } from '../src/lib/analytics';
import { prisma } from '../src/lib/prisma';
import { generateTeacherReportPDF } from '../src/lib/pdf';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

async function processReportJob(job: any) {
  const { teacherId, formId, sendEmail, selectedQuestions } = job.payload as any;
  
  await prisma.job.update({ where: { id: job.id }, data: { status: 'RUNNING', started_at: new Date() } });

  try {
    const analytics = await getTeacherAnalytics(teacherId);
    if (!analytics) throw new Error("Teacher not found");

    if (formId) {
      analytics.formsBreakdown = analytics.formsBreakdown.filter((f: any) => f.id === formId);
    }

    if (selectedQuestions && Array.isArray(selectedQuestions)) {
      analytics.formsBreakdown.forEach((form: any) => {
        form.questions = form.questions.filter((q: any) => selectedQuestions.includes(q.id));
      });
      analytics.formsBreakdown = analytics.formsBreakdown.filter((f: any) => f.questions.length > 0);
    }

    const deptAvgs = await getDepartmentAverages(analytics.teacher.department_id);
    const instAvgs = await getInstituteAverages();

    analytics.formsBreakdown.forEach((form: any) => {
      form.questions.forEach((q: any) => {
        q.departmentScore = deptAvgs.questions[q.id] ?? null;
        q.instituteScore = instAvgs.questions[q.id] ?? null;
      });
    });

    const reportsDir = path.join(process.cwd(), 'public', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const fileName = `teacher_${teacherId}_${Date.now()}.pdf`;
    const outputPath = path.join(reportsDir, fileName);

    await generateTeacherReportPDF(analytics, outputPath);

    const resultPath = `/reports/${fileName}`;

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completed_at: new Date(), result_path: resultPath }
    });
    
    // Attempt to extract a formId if not provided
    const resolvedFormId = formId || (analytics.formsBreakdown.length > 0 ? analytics.formsBreakdown[0].id : null);

    if (resolvedFormId) {
      await prisma.report.create({
        data: {
          teacher_id: teacherId,
          form_id: resolvedFormId,
          generated_by: job.created_by,
          file_path: resultPath,
          job_id: job.id
        }
      });
    }

    if (sendEmail && analytics.teacher.email) {
      await prisma.job.create({
        data: {
          type: 'EMAIL',
          status: 'PENDING',
          payload: { 
            to: analytics.teacher.email, 
            type: 'REPORT', 
            subject: 'Your Teacher Analytics Report',
            attachmentPath: resultPath
          },
          created_by: job.created_by
        }
      });
    }

    console.log(`Processed REPORT job ${job.id} -> ${resultPath}`);
  } catch (error: any) {
    console.error(`REPORT Job ${job.id} failed:`, error);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'FAILED', completed_at: new Date(), error: error.message }
    });
  }
}

async function processEmailJob(job: any) {
  const { to, type, subject, attachmentPath } = job.payload as any;
  
  await prisma.job.update({ where: { id: job.id }, data: { status: 'RUNNING', started_at: new Date() } });

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });

    const mailOptions: any = {
      from: process.env.SMTP_FROM || 'noreply@institute.edu',
      to,
      subject,
      text: 'Please find your requested document attached.',
    };

    if (attachmentPath) {
      // attachmentPath is a public URL path like /reports/filename.pdf
      // We need to point to the actual disk location in the public directory
      const cleanPath = attachmentPath.startsWith('/') ? attachmentPath.substring(1) : attachmentPath;
      const fullPath = path.join(process.cwd(), 'public', cleanPath);
      if (fs.existsSync(fullPath)) {
        mailOptions.attachments = [{ path: fullPath }];
      } else {
        console.error(`Attachment not found at: ${fullPath}`);
      }
    }

    await transporter.sendMail(mailOptions);
    
    await prisma.emailMessage.create({
      data: {
        to,
        type: type || 'REPORT',
        subject: subject || '',
        status: 'SENT',
        sent_at: new Date(),
        job_id: job.id
      }
    });

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completed_at: new Date() }
    });
    
    console.log(`Processed EMAIL job ${job.id} to ${to}`);
  } catch (error: any) {
    console.error(`EMAIL Job ${job.id} failed:`, error);
    
    await prisma.emailMessage.create({
      data: {
        to,
        type: type || 'REPORT',
        subject: subject || '',
        status: 'FAILED',
        error: error.message,
        job_id: job.id
      }
    });

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
        where: { status: 'PENDING', type: { in: ['REPORT', 'EMAIL'] } },
        orderBy: { created_at: 'asc' }
      });

      if (job) {
        if (job.type === 'REPORT') {
          await processReportJob(job);
        } else if (job.type === 'EMAIL') {
          await processEmailJob(job);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (err) {
      console.error("Worker error:", err);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

startWorker();
