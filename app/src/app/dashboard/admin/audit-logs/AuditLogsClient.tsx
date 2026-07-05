'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';

export default function AuditLogsClient({ initialData }: { initialData: any[] }) {
  const [logs, setLogs] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (log.actor_user_id && log.actor_user_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
    log.entity.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by action, actor, or entity..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Time</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Action</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Actor ID</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Entity</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Entity ID</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">IP Address</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td suppressHydrationWarning className="px-6 py-4 dark:text-gray-300">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-blue-600 dark:text-blue-400">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">
                    {log.actor_user_id || '-'}
                  </td>
                  <td className="px-6 py-4 dark:text-gray-300">
                    {log.entity}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">
                    {log.entity_id || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {log.ip_address || '-'}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-gray-500 max-w-xs overflow-hidden text-ellipsis">
                    {log.metadata ? JSON.stringify(log.metadata) : '-'}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No audit logs found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
