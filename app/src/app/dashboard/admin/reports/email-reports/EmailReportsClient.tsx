"use client";

import { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function EmailReportsClient({ 
  forms, 
  departments, 
  teachers 
}: { 
  forms: any[], 
  departments: any[], 
  teachers: any[] 
}) {
  const router = useRouter();
  
  const [selectedFormId, setSelectedFormId] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  
  const [filterType, setFilterType] = useState<'ALL' | 'DEPARTMENT' | 'TEACHER'>('ALL');
  const [departmentId, setDepartmentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState('');

  const selectedForm = forms.find(f => f.id === selectedFormId);
  
  // Teachers filtered by department (for UI dropdown)
  const filteredTeachers = departmentId 
    ? teachers.filter(t => t.department_id === departmentId)
    : teachers;

  const toggleQuestion = (qId: string) => {
    setSelectedQuestionIds(prev => 
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  const selectAllQuestions = () => {
    if (selectedForm) {
      setSelectedQuestionIds(selectedForm.questions.map((q: any) => q.id));
    }
  };

  const deselectAllQuestions = () => {
    setSelectedQuestionIds([]);
  };

  const handleSend = async () => {
    if (!selectedFormId) {
      setMessage('Please select a form first.');
      setStatus('ERROR');
      return;
    }

    if (selectedQuestionIds.length === 0) {
      setMessage('Please select at least one question.');
      setStatus('ERROR');
      return;
    }

    if (filterType === 'DEPARTMENT' && !departmentId) {
      setMessage('Please select a department.');
      setStatus('ERROR');
      return;
    }

    if (filterType === 'TEACHER' && !teacherId) {
      setMessage('Please select a teacher.');
      setStatus('ERROR');
      return;
    }

    setStatus('LOADING');
    setMessage('');

    try {
      const res = await fetch('/api/jobs/bulk-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: selectedFormId,
          questionIds: selectedQuestionIds,
          filterType,
          departmentId: filterType === 'DEPARTMENT' ? departmentId : undefined,
          teacherId: filterType === 'TEACHER' ? teacherId : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setStatus('SUCCESS');
      setMessage(`Successfully queued emails to ${data.count} teacher(s).`);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setStatus('IDLE');
        setMessage('');
        router.push('/dashboard/admin/reports');
      }, 3000);
      
    } catch (err: any) {
      setStatus('ERROR');
      setMessage(err.message || 'Failed to queue reports.');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
      <div className="p-6 md:p-8 space-y-8">
        
        {/* Step 1: Select Form */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
            1. Choose Form
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Form</label>
            <select 
              value={selectedFormId}
              onChange={(e) => {
                setSelectedFormId(e.target.value);
                setSelectedQuestionIds([]); // Reset questions on form change
              }}
              className="w-full md:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-primary outline-none bg-white dark:bg-gray-800"
            >
              <option value="">Select a form...</option>
              {forms.map(f => (
                <option key={f.id} value={f.id}>{f.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 2: Select Questions */}
        {selectedForm && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                2. Choose Questions to Include
              </h2>
              <div className="space-x-2">
                <button onClick={selectAllQuestions} className="text-sm text-primary hover:underline">Select All</button>
                <span className="text-gray-300">|</span>
                <button onClick={deselectAllQuestions} className="text-sm text-gray-500 hover:underline">Deselect All</button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
              {selectedForm.questions.map((q: any) => (
                <label key={q.id} className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedQuestionIds.includes(q.id)}
                    onChange={() => toggleQuestion(q.id)}
                    className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">{q.text}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{q.type} {q.is_scored ? '(Scored)' : ''}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Optional: Select Period */}
        {selectedForm && selectedQuestionIds.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-75">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
              3. Select Period (Optional)
            </h2>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-primary outline-none bg-white dark:bg-gray-800"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-primary outline-none bg-white dark:bg-gray-800"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">Leaving these blank will include all time data. Teachers with no feedback in the period will show as 0.</p>
          </div>
        )}

        {/* Step 4: Target Filter */}
        {selectedForm && selectedQuestionIds.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
              4. Select Recipients
            </h2>
            
            <div className="flex space-x-4 mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={filterType === 'ALL'} 
                  onChange={() => setFilterType('ALL')}
                  className="text-primary focus:ring-primary" 
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">All Teachers</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={filterType === 'DEPARTMENT'} 
                  onChange={() => setFilterType('DEPARTMENT')}
                  className="text-primary focus:ring-primary" 
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">By Department</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={filterType === 'TEACHER'} 
                  onChange={() => setFilterType('TEACHER')}
                  className="text-primary focus:ring-primary" 
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Specific Teacher</span>
              </label>
            </div>

            {(filterType === 'DEPARTMENT' || filterType === 'TEACHER') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
                <select 
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    setTeacherId('');
                  }}
                  className="w-full md:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-primary outline-none bg-white dark:bg-gray-800"
                >
                  <option value="">Select a department...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {filterType === 'TEACHER' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Teacher</label>
                <select 
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  disabled={!departmentId}
                  className="w-full md:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-primary outline-none bg-white dark:bg-gray-800 disabled:opacity-50"
                >
                  <option value="">Select a teacher...</option>
                  {filteredTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

      </div>

      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex-1">
          {status === 'ERROR' && (
            <p className="text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{message}</p>
          )}
          {status === 'SUCCESS' && (
            <p className="text-sm text-green-600 flex items-center"><CheckCircle2 className="w-4 h-4 mr-2" />{message}</p>
          )}
        </div>
        <button 
          onClick={handleSend}
          disabled={status === 'LOADING' || !selectedFormId || selectedQuestionIds.length === 0}
          className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {status === 'LOADING' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
          Send Mail
        </button>
      </div>
    </div>
  );
}
