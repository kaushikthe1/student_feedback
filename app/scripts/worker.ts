import { PrismaClient } from '@prisma/client';
import { getTeacherAnalytics, getDepartmentAverages, getInstituteAverages } from '../src/lib/analytics';
import { prisma } from '../src/lib/prisma';
import { generateTeacherReportPDF } from '../src/lib/pdf';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

async function processReportJob(job: any) {
  const { teacherId, formId, sendEmail, selectedQuestions, startDate, endDate } = job.payload as any;
  
  await prisma.job.update({ where: { id: job.id }, data: { status: 'RUNNING', started_at: new Date() } });

  try {
    const analytics = await getTeacherAnalytics(teacherId, startDate, endDate);
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

    if (analytics.formsBreakdown.length === 0 && formId) {
      const form = await prisma.form.findUnique({ where: { id: formId }, include: { questions: true } });
      if (form) {
        const qns = form.questions
          .filter(q => selectedQuestions ? selectedQuestions.includes(q.id) : true)
          .map(q => ({
            id: q.id,
            text: q.text,
            order: q.order,
            score: 0
          }));
        if (qns.length > 0) {
          analytics.formsBreakdown = [{
            id: form.id,
            title: form.title,
            questions: qns
          }];
          analytics.overallScore = 0;
        }
      }
    }

    if (analytics.overallScore === null) analytics.overallScore = 0;
    
    analytics.formsBreakdown.forEach((form: any) => {
      form.questions.forEach((q: any) => {
        if (q.score === null) q.score = 0;
      });
    });

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

    let periodStr = undefined;
    if (startDate || endDate) {
      periodStr = `${startDate || 'Start'} to ${endDate || 'Present'}`;
    }

    await generateTeacherReportPDF(analytics, outputPath, periodStr);

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

    let emailText = 'Please find your requested document attached.';
    if (type === 'REPORT') {
      emailText = `Dear Faculty,

Please find attached your student feedback report. The Academic Section maintains strict confidentiality; this feedback will never be shared with others, including your HOD. 

For any queries or comments, please fill out this form: https://forms.gle/E64mmxynMp1byRpB8

(Please do not reply to this automated email)

Best regards,
Academic Section, AIIMS Kalyani`;
    }

    const mailOptions: any = {
      from: process.env.SMTP_FROM || 'noreply@institute.edu',
      to,
      subject,
      text: emailText,
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
