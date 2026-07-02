'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, Clock, Calendar, Users, X, Loader2, CheckCircle2 } from 'lucide-react';

export default function FormAssignmentsClient({ form, initialAssignments, batches }: any) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [batchId, setBatchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [weekdays, setWeekdays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const ALL_WEEKDAYS = [
    { label: 'Sun', value: 'SUN' },
    { label: 'Mon', value: 'MON' },
    { label: 'Tue', value: 'TUE' },
    { label: 'Wed', value: 'WED' },
    { label: 'Thu', value: 'THU' },
    { label: 'Fri', value: 'FRI' },
    { label: 'Sat', value: 'SAT' }
  ];

  const handleToggleWeekday = (val: string) => {
    if (weekdays.includes(val)) {
      setWeekdays(weekdays.filter(w => w !== val));
    } else {
      setWeekdays([...weekdays, val]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !startDate || !endDate || !startTime || !endTime || weekdays.length === 0) {
      setError('Please fill in all fields and select at least one weekday.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        batch_id: batchId,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        daily_start_time: startTime,
        daily_end_time: endTime,
        allowed_weekdays: weekdays
      };

      const res = await fetch(`/api/forms/${form.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Failed to assign form');
      }

      const newAssignment = await res.json();
      // To display the batch name, find it from the batches array
      const assignedBatch = batches.find((b: any) => b.id === batchId);
      setAssignments([{ ...newAssignment, batch: assignedBatch }, ...assignments]);
      
      setSuccess('Form assigned successfully!');
      setIsModalOpen(false);
      // Reset form
      setBatchId('');
      setStartDate('');
      setEndDate('');
      setStartTime('09:00');
      setEndTime('17:00');
      setWeekdays(['MON', 'TUE', 'WED', 'THU', 'FRI']);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/admin/forms" className="flex items-center hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Forms
        </Link>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Assignments</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Managing assignments for <span className="font-semibold">{form.title}</span>
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl shadow-sm hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <CalendarPlus className="w-4 h-4 mr-2" />
          Assign to Batch
        </button>
      </div>

      {success && (
        <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            {success}
          </div>
          <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Assignments List */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Window</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weekdays</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No assignments found for this form.</td>
              </tr>
            ) : (
              assignments.map((assignment: any) => {
                const isExpired = new Date(assignment.end_date) < new Date();
                const isUpcoming = new Date(assignment.start_date) > new Date();
                const isActive = !isExpired && !isUpcoming;

                return (
                  <tr key={assignment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm font-medium text-gray-900 dark:text-white">
                        <Users className="w-4 h-4 mr-2 text-gray-400" />
                        {assignment.batch?.name || 'Unknown Batch'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-2" />
                        {new Date(assignment.start_date).toLocaleDateString()} - {new Date(assignment.end_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="w-4 h-4 mr-2" />
                        {assignment.daily_start_time} - {assignment.daily_end_time}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex gap-1">
                        {ALL_WEEKDAYS.map(w => (
                          <span key={w.value} className={`text-xs ${assignment.allowed_weekdays.includes(w.value) ? 'text-primary font-medium' : 'text-gray-300 dark:text-gray-700'}`}>
                            {w.label.charAt(0)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isActive ? 'bg-green-100 text-green-800' : isUpcoming ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {isActive ? 'Active' : isUpcoming ? 'Scheduled' : 'Expired'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Assignment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Assignment</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Batch</label>
                <select 
                  required
                  value={batchId} onChange={e => setBatchId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                >
                  <option value="">Select a batch...</option>
                  {batches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input 
                    type="date" required value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input 
                    type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily Start Time</label>
                  <input 
                    type="time" required value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily End Time</label>
                  <input 
                    type="time" required value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Allowed Weekdays</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_WEEKDAYS.map(w => (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => handleToggleWeekday(w.value)}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        weekdays.includes(w.value) 
                          ? 'bg-primary border-primary text-white'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Assign Form
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
