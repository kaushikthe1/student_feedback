"use client";

import { useState, useTransition } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { toggleFlag } from './actions';

export default function LanguageReviewClient({ submissions }: { submissions: any[] }) {
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<'ALL' | 'FLAGGED'>('ALL');

  const filtered = filter === 'FLAGGED' ? submissions.filter(s => s.is_flagged) : submissions;

  return (
    <div className="space-y-6">
      <div className="flex space-x-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'ALL' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All Recent
        </button>
        <button
          onClick={() => setFilter('FLAGGED')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
            filter === 'FLAGGED' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-red-50 hover:text-red-600'
          }`}
        >
          <Flag className="w-4 h-4 mr-2" />
          Flagged Only
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-800">
          <p className="text-gray-500 dark:text-gray-400">No submissions found matching this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(sub => (
            <div key={sub.id} className={`bg-white dark:bg-gray-900 rounded-2xl p-6 border shadow-sm transition-all ${
              sub.is_flagged ? 'border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-800'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="inline-block px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-md mb-2">
                    {sub.form.title}
                  </span>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Student: {sub.student.user.name} <span className="text-gray-500 font-mono">({sub.student.roll_number})</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Teacher: {sub.teacher.name}
                  </div>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => startTransition(() => toggleFlag(sub.id, sub.is_flagged))}
                  className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sub.is_flagged 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Flag className="w-4 h-4 mr-2" />}
                  {sub.is_flagged ? 'Unflag' : 'Flag'}
                </button>
              </div>

              <div className="space-y-3">
                {sub.answers.map((ans: any, idx: number) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-medium text-gray-500 mb-1">{ans.question.text}</p>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{ans.text_value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
