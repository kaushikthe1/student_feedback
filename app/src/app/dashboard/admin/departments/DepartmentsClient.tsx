"use client";

import { useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, X } from 'lucide-react';

type Department = { id: string; name: string; created_at: Date };

export default function DepartmentsClient({ initialData }: { initialData: Department[] }) {
  const [departments, setDepartments] = useState<Department[]>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
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
        
        // Skip header if it exists
        const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;
        
        let added = 0;
        for (let i = startIndex; i < lines.length; i++) {
          const row = lines[i].split(',');
          let deptName = row[0].replace(/^["']|["']$/g, '').trim(); // Handle basic quotes
          
          if (!deptName) continue;

          // Make API call for each
          const res = await fetch('/api/departments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: deptName, code: deptName.substring(0,4).toUpperCase() + Math.random().toString(36).substring(2,5) })
          });
          
          if (res.ok) {
            added++;
            const newDept = await res.json();
            setDepartments(prev => [...prev, newDept]);
          }
        }
        
        setSuccessMsg(`Successfully imported ${added} departments!`);
      } catch (err: any) {
        setError('Failed to parse CSV: ' + err.message);
      } finally {
        setLoading(false);
        e.target.value = ''; // Reset input
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const openModal = (dept?: Department) => {
    setError('');
    if (dept) {
      setEditingDept(dept);
      setName(dept.name);
    } else {
      setEditingDept(null);
      setName('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editingDept ? `/api/departments/${editingDept.id}` : '/api/departments';
      const method = editingDept ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Operation failed');
      }

      const savedDept = await res.json();

      if (editingDept) {
        setDepartments(departments.map(d => d.id === savedDept.id ? savedDept : d));
      } else {
        setDepartments([...departments, savedDept]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setDepartments(departments.filter(d => d.id !== id));
    } catch (err) {
      alert('Cannot delete department because it is in use.');
    }
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Name\nAnaesthesia\nAnatomy";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "departments_template.csv");
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

      <div className="flex justify-end mb-4 gap-3">
        <button 
          onClick={downloadTemplate}
          className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
        >
          Download Template
        </button>
        <label className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm cursor-pointer">
          <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={loading} />
          {loading ? 'Importing...' : 'Upload CSV'}
        </label>
        <button 
          onClick={() => openModal()}
          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl shadow-sm hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {departments.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center text-sm text-gray-500">No departments found.</td>
              </tr>
            ) : (
              departments.map((dept) => (
                <tr key={dept.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {dept.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openModal(dept)} className="text-primary hover:text-blue-700 mr-4">
                      <Edit2 className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => handleDelete(dept.id)} className="text-red-500 hover:text-red-700">
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
                {editingDept ? 'Edit Department' : 'New Department'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-700 rounded-xl disabled:opacity-50"
                >
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
