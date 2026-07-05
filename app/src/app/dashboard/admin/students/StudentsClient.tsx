"use client";

import { useState } from 'react';
import { Plus, Trash2, Loader2, X, Upload, Edit2 } from 'lucide-react';

type Batch = { id: string; name: string };
type User = { id: string; name: string; email: string };
type StudentProfile = { id: string; roll_number: string; batch_id: string; batch: Batch; user_id: string; user: User };

export default function StudentsClient({ initialData, batches }: { initialData: StudentProfile[], batches: Batch[] }) {
  const [students, setStudents] = useState<StudentProfile[]>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [filterBatch, setFilterBatch] = useState('ALL');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [batchId, setBatchId] = useState(batches[0]?.id || '');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const filteredStudents = filterBatch === 'ALL' 
    ? students 
    : students.filter(s => s.batch_id === filterBatch);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        const header = lines[0].toLowerCase();
        const startIndex = header.includes('name') || header.includes('email') ? 1 : 0;
        
        let added = 0;
        const newStudents = [];
        for (let i = startIndex; i < lines.length; i++) {
          const row = lines[i].split(',').map(cell => cell.replace(/^["']|["']$/g, '').trim());
          if (row.length < 5) continue; // Expect Name, Email, Roll No, Batch, Password
          
          const [sName, sEmail, sRoll, sBatch, sPass] = row;
          if (!sName || !sEmail || !sRoll || !sBatch || !sPass) continue;

          // Find batch id
          const batch = batches.find(b => b.name.toLowerCase() === sBatch.toLowerCase());
          if (!batch) {
            console.warn(`Batch ${sBatch} not found for student ${sName}`);
            continue;
          }

          const res = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: sName, email: sEmail, roll_number: sRoll, batch_id: batch.id, password: sPass })
          });
          
          if (res.ok) {
            added++;
            const newStudent = await res.json();
            newStudents.push(newStudent);
          } else {
            const errData = await res.json();
            console.error(`Failed to add student ${sName}:`, errData);
            setError(prev => prev ? prev + ` | Failed to add ${sName}` : `Failed to add ${sName}`);
          }
        }
        
        setStudents(prev => [...newStudents.reverse(), ...prev]);
        setSuccessMsg(`Successfully imported ${added} students!`);
      } catch (err: any) {
        setError('Failed to parse CSV: ' + err.message);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const openModal = (student?: StudentProfile) => {
    setError('');
    if (student) {
      setEditingStudentId(student.id);
      setName(student.user.name);
      setEmail(student.user.email);
      setRollNumber(student.roll_number);
      setBatchId(student.batch_id);
      setPassword(''); // keep blank unless resetting
    } else {
      setEditingStudentId(null);
      setName('');
      setEmail('');
      setRollNumber('');
      setPassword('');
      setBatchId(batches[0]?.id || '');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editingStudentId ? `/api/students/${editingStudentId}` : '/api/students';
      const method = editingStudentId ? 'PATCH' : 'POST';
      const bodyPayload: any = { name, email, roll_number: rollNumber, batch_id: batchId };
      
      if (!editingStudentId || password) {
        bodyPayload.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) {
        const data = await res.json();
        let errorMsg = data.error?.message || 'Operation failed';
        if (data.error?.details && Array.isArray(data.error.details)) {
          errorMsg += ': ' + data.error.details.map((d: any) => d.message).join(', ');
        }
        throw new Error(errorMsg);
      }

      if (editingStudentId) {
        setStudents(students.map(s => {
          if (s.id === editingStudentId) {
            return {
              ...s, roll_number: rollNumber, batch_id: batchId,
              batch: batches.find(b => b.id === batchId) || s.batch,
              user: { ...s.user, name, email }
            };
          }
          return s;
        }));
        setSuccessMsg('Student updated successfully.');
      } else {
        const savedStudent = await res.json();
        setStudents([savedStudent, ...students]);
        setSuccessMsg('Student added successfully.');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this student?')) return;
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to deactivate');
      setStudents(students.filter(s => s.id !== id));
    } catch (err) {
      alert('Error deactivating student.');
    }
  };

  const handleBatchDelete = async () => {
    if (filterBatch === 'ALL') return;
    
    const batchName = batches.find(b => b.id === filterBatch)?.name || 'this batch';
    if (!confirm(`WARNING: Are you sure you want to delete ALL students in ${batchName}? This action cannot be undone.`)) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/students/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: filterBatch })
      });
      
      if (!res.ok) {
        throw new Error('Failed to delete batch');
      }
      
      const data = await res.json();
      setStudents(students.filter(s => s.batch_id !== filterBatch));
      setSuccessMsg(`Successfully deleted ${data.hardDeleted + data.archived + data.purged} students from ${batchName}.`);
      setFilterBatch('ALL');
    } catch (err: any) {
      setError(err.message || 'Error deleting batch.');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Name,Email,Roll No,Batch Name,Password\nJohn Doe,john@example.com,101,MBBS2026,password123";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "students_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {successMsg && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex justify-between items-center">
          {successMsg}
          <button onClick={() => setSuccessMsg('')} className="text-green-500 hover:text-green-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <select 
          value={filterBatch}
          onChange={(e) => setFilterBatch(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800 text-sm w-full sm:w-auto"
        >
          <option value="ALL">All Batches</option>
          {batches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <div className="flex gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          {filterBatch !== 'ALL' && (
            <button 
              onClick={handleBatchDelete}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl shadow-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-medium text-sm whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Batch
            </button>
          )}
          <button 
            onClick={downloadTemplate}
            className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm whitespace-nowrap"
          >
            Download Template
          </button>
        <label className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm cursor-pointer">
          <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={loading} />
          {loading ? 'Importing...' : <><Upload className="w-4 h-4 mr-2" /> Import CSV</>}
        </label>
        <button 
          onClick={() => openModal()}
          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl shadow-sm hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No students found.</td>
              </tr>
            ) : (
              filteredStudents.map((profile) => (
                <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{profile.user.name}</div>
                    <div className="text-sm text-gray-500">{profile.user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600 dark:text-gray-300">
                    {profile.roll_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                      {profile.batch?.name || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openModal(profile)} className="text-gray-400 hover:text-primary mr-3">
                      <Edit2 className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => handleDelete(profile.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingStudentId ? 'Edit Student' : 'New Student'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                <input
                  type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Roll No</label>
                  <input
                    type="text" required value={rollNumber} onChange={(e) => setRollNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch</label>
                  <select
                    required value={batchId} onChange={(e) => setBatchId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                  >
                    <option value="" disabled>Select Batch</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password {editingStudentId && <span className="text-gray-400 font-normal">(Leave blank to keep unchanged)</span>}
                </label>
                <input
                  type="password" required={!editingStudentId} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-700 rounded-xl disabled:opacity-50">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
