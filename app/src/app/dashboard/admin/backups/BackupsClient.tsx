'use client';

import { useState } from 'react';
import { Download, RefreshCw, Database } from 'lucide-react';

export default function BackupsClient({ initialData, isSuperadmin }: { initialData: any[], isSuperadmin: boolean }) {
  const [backups, setBackups] = useState(initialData);
  const [isTriggering, setIsTriggering] = useState(false);

  async function triggerBackup() {
    setIsTriggering(true);
    const res = await fetch('/api/backups', { method: 'POST' });
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to trigger backup');
      setIsTriggering(false);
    }
  }

  async function handleDownload(id: string) {
    if (!isSuperadmin) return;
    window.location.href = `/api/backups/${id}/download`;
  }

  async function handleRestore(id: string) {
    if (!isSuperadmin) return;
    if (!confirm('Are you absolutely sure you want to restore the database to this state? All current data will be overwritten. This action CANNOT be undone!')) return;
    
    try {
      const res = await fetch(`/api/backups/${id}/restore`, { method: 'POST' });
      if (res.ok) {
        alert('Database restored successfully!');
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to restore database');
      }
    } catch (e) {
      alert('Failed to connect to restore endpoint');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={triggerBackup}
          disabled={isTriggering}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {isTriggering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          <span>Trigger New Backup</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Timestamp</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Filename</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
              {isSuperadmin && <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {backups.map((backup) => (
              <tr key={backup.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td suppressHydrationWarning className="px-6 py-4 dark:text-gray-300">
                  {new Date(backup.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 font-mono text-sm dark:text-gray-300">
                  {backup.filename}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-medium">
                    COMPLETED
                  </span>
                </td>
                {isSuperadmin && (
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleDownload(backup.id)}
                        className="text-gray-400 hover:text-blue-500 transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRestore(backup.id)}
                        className="text-gray-400 hover:text-orange-500 transition-colors"
                        title="Restore"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {backups.length === 0 && (
              <tr>
                <td colSpan={isSuperadmin ? 4 : 3} className="px-6 py-8 text-center text-gray-500">
                  No backups found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
