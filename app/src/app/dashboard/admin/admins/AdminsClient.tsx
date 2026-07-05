'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Edit2, Ban, Trash2, CheckCircle } from 'lucide-react';

export default function AdminsClient({ initialData, isSuperadmin }: { initialData: any[], isSuperadmin: boolean }) {
  const [admins, setAdmins] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<any>(null);
  const router = useRouter();

  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'ADMIN' });
  const [editFormData, setEditFormData] = useState({ name: '', password: '' });

  const filteredAdmins = admins.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setIsAdding(false);
      setFormData({ name: '', email: '', password: '', role: 'ADMIN' });
      router.refresh();
      // Optimistic update omitted for brevity, reload handles it
      window.location.reload(); 
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to create admin');
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admins/${isEditing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editFormData),
    });
    if (res.ok) {
      setIsEditing(null);
      setEditFormData({ name: '', password: '' });
      window.location.reload();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to edit admin');
    }
  }

  async function toggleSuspend(id: string, currentStatus: boolean) {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'suspend' : 'activate'} this admin?`)) return;
    const res = await fetch(`/api/admins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentStatus }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update admin');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to permanently delete this admin? This action cannot be undone.')) return;
    const res = await fetch(`/api/admins/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete admin');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search admins..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Admin</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Email</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Role</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAdmins.map((admin) => (
              <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 font-medium dark:text-gray-200">
                  {admin.name} {admin.is_hidden && <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Hidden</span>}
                </td>
                <td className="px-6 py-4 dark:text-gray-300">{admin.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${admin.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                    {admin.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${admin.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {admin.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => { setIsEditing(admin); setEditFormData({ name: admin.name, password: '' }); }}
                      className="text-gray-400 hover:text-blue-500 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {isSuperadmin && !admin.is_hidden && (
                      <>
                        <button
                          onClick={() => toggleSuspend(admin.id, admin.is_active)}
                          className="text-gray-400 hover:text-orange-500 transition-colors"
                          title={admin.is_active ? 'Suspend' : 'Activate'}
                        >
                          {admin.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(admin.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Add New Admin</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Name</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Email</label>
                <input required type="email" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Initial Password</label>
                <input required type="password" minLength={8} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              {isSuperadmin && (
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Role</label>
                  <select className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPERADMIN">SUPERADMIN</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Edit Admin</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Name</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Reset Password (Optional)</label>
                <input type="password" minLength={8} placeholder="Leave blank to keep current" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" value={editFormData.password} onChange={e => setEditFormData({...editFormData, password: e.target.value})} />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setIsEditing(null)} className="px-4 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
