"use client";

import { useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, X } from 'lucide-react';

type Batch = { id: string; name: string; year: number | null; program: string | null };

export default function BatchesClient({ initialData }: { initialData: Batch[] }) {
  const [batches, setBatches] = useState<Batch[]>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  
  const [name, setName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [program, setProgram] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openModal = (batch?: Batch) => {
    setError('');
    if (batch) {
      setEditingBatch(batch);
      setName(batch.name);
      setYear(batch.year || new Date().getFullYear());
      setProgram(batch.program || '');
    } else {
      setEditingBatch(null);
      setName('');
      setYear(new Date().getFullYear());
      setProgram('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editingBatch ? `/api/batches/${editingBatch.id}` : '/api/batches';
      const method = editingBatch ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, year, program: program || undefined })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Operation failed');
      }

      const savedBatch = await res.json();

      if (editingBatch) {
        setBatches(batches.map(b => b.id === savedBatch.id ? savedBatch : b));
      } else {
        setBatches([savedBatch, ...batches]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this batch?')) return;
    try {
      const res = await fetch(`/api/batches/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setBatches(batches.filter(b => b.id !== id));
    } catch (err) {
      alert('Cannot delete batch because it is in use.');
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => openModal()}
          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl shadow-sm hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Batch
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {batches.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No batches found.</td>
              </tr>
            ) : (
              batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {batch.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {batch.program || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {batch.year || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openModal(batch)} className="text-primary hover:text-blue-700 mr-4">
                      <Edit2 className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => handleDelete(batch.id)} className="text-red-500 hover:text-red-700">
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
                {editingBatch ? 'Edit Batch' : 'New Batch'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Batch Name (e.g., CS Section A)
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program</label>
                  <input
                    type="text"
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                    placeholder="e.g. B.Tech"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700"
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
