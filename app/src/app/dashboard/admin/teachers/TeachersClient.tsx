"use client";

import { useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, X, Upload } from 'lucide-react';

type Department = { id: string; name: string };
type Teacher = { id: string; name: string; email: string; designation: string; department_id: string; department: Department };

export default function TeachersClient({ initialData, departments }: { initialData: Teacher[], departments: Department[] }) {
  const [teachers, setTeachers] = useState<Teacher[]>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
        const newTeachers = [];
        for (let i = startIndex; i < lines.length; i++) {
          const row = lines[i].split(',').map(cell => cell.replace(/^["']|["']$/g, '').trim());
          if (row.length < 4) continue; // Expect Name, Email, Designation, Department
          
          const [tName, tEmail, tDesignation, tDepartment] = row;
          if (!tName || !tEmail || !tDesignation || !tDepartment) continue;

          // Find department id by matching name closely
          const dept = departments.find(d => d.name.toLowerCase() === tDepartment.toLowerCase());
          if (!dept) {
            console.warn(`Department ${tDepartment} not found for teacher ${tName}`);
            continue;
          }

          const res = await fetch('/api/teachers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: tName, email: tEmail, designation: tDesignation, department_id: dept.id })
          });
          
          if (res.ok) {
            added++;
            const newTeacher = await res.json();
            newTeachers.push(newTeacher);
          } else {
            const errData = await res.json();
            console.error(`Failed to add teacher ${tName}:`, errData);
            setError(prev => prev ? prev + ` | Failed to add ${tName}` : `Failed to add ${tName}`);
          }
        }
        
        setTeachers(prev => [...newTeachers.reverse(), ...prev]);
        setSuccessMsg(`Successfully imported ${added} teachers!`);
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

  const openModal = (teacher?: Teacher) => {
    setError('');
    if (teacher) {
      setEditingTeacher(teacher);
      setName(teacher.name);
      setEmail(teacher.email);
      setDesignation(teacher.designation);
      setDepartmentId(teacher.department_id);
    } else {
      setEditingTeacher(null);
      setName('');
      setEmail('');
      setDesignation('');
      setDepartmentId(departments[0]?.id || '');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editingTeacher ? `/api/teachers/${editingTeacher.id}` : '/api/teachers';
      const method = editingTeacher ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, designation, department_id: departmentId })
      });

      if (!res.ok) {
        const data = await res.json();
        let errorMsg = data.error?.message || 'Operation failed';
        if (data.error?.details && Array.isArray(data.error.details)) {
          errorMsg += ': ' + data.error.details.map((d: any) => d.message).join(', ');
        }
        throw new Error(errorMsg);
      }

      const savedTeacher = await res.json();

      if (editingTeacher) {
        setTeachers(teachers.map(t => t.id === savedTeacher.id ? savedTeacher : t));
      } else {
        setTeachers([savedTeacher, ...teachers]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to archive this teacher? (Safe deletion)')) return;
    try {
      const res = await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setTeachers(teachers.filter(t => t.id !== id));
    } catch (err) {
      alert('Error archiving teacher.');
    }
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Name,Email,Designation,Department Name\nJane Doe,jane@example.com,FACULTY,Anatomy";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "teachers_template.csv");
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

      <div className="flex justify-end gap-3 mb-4">
        <button 
          onClick={downloadTemplate}
          className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
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
          Add Teacher
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {teachers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No teachers found.</td>
              </tr>
            ) : (
              teachers.map((teacher) => (
                <tr key={teacher.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{teacher.name}</div>
                    <div className="text-sm text-gray-500">{teacher.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {teacher.designation}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {teacher.department?.name || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openModal(teacher)} className="text-primary hover:text-blue-700 mr-4">
                      <Edit2 className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => handleDelete(teacher.id)} className="text-red-500 hover:text-red-700">
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
                {editingTeacher ? 'Edit Teacher' : 'New Teacher'}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Designation</label>
                <input
                  type="text" required value={designation} onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                <select
                  required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
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
