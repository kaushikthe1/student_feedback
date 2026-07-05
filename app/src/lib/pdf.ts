import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function generateTeacherReportPDF(
  reportData: any, 
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Title
      doc.fontSize(20).text('Teacher Analytics Report', { align: 'center' });
      doc.moveDown();
      
      // Teacher Info
      doc.fontSize(14).text(`Teacher: ${reportData.teacher.name}`);
      doc.fontSize(12).text(`Department: ${reportData.teacher.department.name}`);
      doc.text(`Designation: ${reportData.teacher.designation}`);
      doc.moveDown();

      // Overall Score
      doc.fontSize(16).text(`Overall Score: ${reportData.overallScore !== null ? reportData.overallScore.toFixed(1) : 'N/A'} / 100`);
      doc.fontSize(12).text(`Total Submissions: ${reportData.totalSubmissions}`);
      doc.moveDown(2);

      // Form Breakdowns
      reportData.formsBreakdown.forEach((form: any) => {
        doc.fontSize(14).text(`Form: ${form.title}`, { underline: true });
        doc.moveDown();

        form.questions.forEach((q: any) => {
          doc.fontSize(12).text(q.text);
          const tScore = q.score !== null ? q.score.toFixed(1) : 'N/A';
          const dScore = q.departmentScore !== null && q.departmentScore !== undefined ? q.departmentScore.toFixed(1) : 'N/A';
          const iScore = q.instituteScore !== null && q.instituteScore !== undefined ? q.instituteScore.toFixed(1) : 'N/A';
          
          doc.fontSize(10).fillColor('gray').text(
            `Teacher: ${tScore}  |  Department Avg: ${dScore}  |  Institute Avg: ${iScore}`
          );
          doc.fillColor('black').moveDown(0.5);
        });
        doc.moveDown();
      });

      doc.end();

      stream.on('finish', () => resolve());
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}
