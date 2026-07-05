"use client";

import { useState } from 'react';
import { Download, FileText, Loader2, CheckCircle2 } from 'lucide-react';

export default function ExportButtons({ teacherId }: { teacherId: string }) {
  const [loading, setLoading] = useState<'CSV' | 'PDF' | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExportCSV = () => {
    // Generate a quick CSV for just this teacher for the last year
    const to = new Date().toISOString().slice(0, 10);
    const fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - 1);
    const from = fromDate.toISOString().slice(0, 10);
    
    window.location.href = `/api/export/csv?from=${from}&to=${to}&teacherId=${teacherId}`;
  };

  const handleGeneratePDF = async () => {
    setLoading('PDF');
    setSuccess(null);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId, sendEmail: false }) 
        // Note: Admin can download it. sendEmail can be true if we want to mail it to teacher.
      });

      if (!res.ok) throw new Error('Failed to queue report job');
      const data = await res.json();
      
      // Poll for completion
      const interval = setInterval(async () => {
        const check = await fetch(`/api/jobs?id=${data.jobId}`);
        const status = await check.json();
        
        if (status.status === 'COMPLETED') {
          clearInterval(interval);
          setLoading(null);
          setSuccess(`Successfully generated PDF`);
          // Trigger download
          if (status.result_path) {
            const link = document.createElement('a');
            link.href = status.result_path;
            link.download = `teacher_report.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          setTimeout(() => setSuccess(null), 3000);
        } else if (status.status === 'FAILED') {
          clearInterval(interval);
          setLoading(null);
          alert('PDF generation failed: ' + status.error);
        }
      }, 2000);

    } catch (err) {
      console.error(err);
      setLoading(null);
      alert('Failed to start PDF generation');
    }
  };

  return (
    <div className="flex items-center gap-3 relative">
      {success && (
        <div className="absolute -top-10 left-0 right-0 text-center">
          <span className="inline-flex items-center text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            {success}
          </span>
        </div>
      )}
      <button 
        onClick={handleExportCSV}
        disabled={loading !== null}
        className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {loading === 'CSV' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
        Export CSV
      </button>
      <button 
        onClick={handleGeneratePDF}
        disabled={loading !== null}
        className="inline-flex items-center px-4 py-2 bg-primary border border-transparent rounded-xl shadow-sm text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {loading === 'PDF' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
        Generate PDF
      </button>
    </div>
  );
}
