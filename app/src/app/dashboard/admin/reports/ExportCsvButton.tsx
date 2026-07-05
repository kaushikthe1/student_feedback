"use client";

import { useState } from 'react';
import { Download, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExportCsvButton({ 
  departments = [], 
  teachers = [], 
  batches = [] 
}: { 
  departments?: any[], 
  teachers?: any[], 
  batches?: any[] 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [error, setError] = useState('');

  // Filter teachers based on selected department
  const filteredTeachers = departmentId 
    ? teachers.filter(t => t.department_id === departmentId) 
    : teachers;

  const handleExport = () => {
    if (!fromDate || !toDate) {
      setError('Both Date From and Date To are required.');
      return;
    }
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    if (to.getTime() - from.getTime() > 1000 * 60 * 60 * 24 * 365) {
      setError('Date range cannot exceed 1 year.');
      return;
    }

    if (to.getTime() < from.getTime()) {
      setError('End date must be after start date.');
      return;
    }

    let url = `/api/export/csv?from=${fromDate}&to=${toDate}`;
    if (departmentId) url += `&departmentId=${departmentId}`;
    if (teacherId) url += `&teacherId=${teacherId}`;
    if (batchId) url += `&batchId=${batchId}`;

    // Trigger download
    window.location.href = url;
    setIsOpen(false);
    setError('');
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <Download className="w-4 h-4 mr-2" />
        Export CSV
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Export Analytics Data</h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-center text-sm">
                    <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    {error}
                  </div>
                )}
                
                <p className="text-sm text-gray-500">
                  Select a date range (max 1 year) to download raw feedback submissions. Apply optional filters to narrow down the dataset.
                </p>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date From *</label>
                      <input 
                        type="date" 
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-primary outline-none bg-white dark:bg-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date To *</label>
                      <input 
                        type="date" 
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-primary outline-none bg-white dark:bg-gray-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                    <select 
                      value={departmentId}
                      onChange={(e) => {
                        setDepartmentId(e.target.value);
                        setTeacherId(''); // reset teacher on department change
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-primary outline-none bg-white dark:bg-gray-800"
                    >
                      <option value="">All Departments</option>
                      {departments.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teacher</label>
                    <select 
                      value={teacherId}
                      onChange={(e) => setTeacherId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-primary outline-none bg-white dark:bg-gray-800 disabled:opacity-50"
                      disabled={filteredTeachers.length === 0}
                    >
                      <option value="">All Teachers</option>
                      {filteredTeachers.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch (Year)</label>
                    <select 
                      value={batchId}
                      onChange={(e) => setBatchId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-primary outline-none bg-white dark:bg-gray-800"
                    >
                      <option value="">All Batches</option>
                      {batches.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-end space-x-3">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleExport}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-700"
                >
                  Download CSV
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
