"use client";

import { useState } from 'react';
import { Plus, Trash2, GripVertical, Save, Loader2, List, AlignLeft, CheckSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

type QuestionType = 'RATING' | 'MCQ' | 'DROPDOWN' | 'OPEN_ENDED';

interface Option {
  id: string; // temp id for UI
  text: string;
  weight: number | null;
}

interface Question {
  id: string; // temp id
  text: string;
  type: QuestionType;
  is_mandatory: boolean;
  is_scored: boolean;
  scale_min: number | null;
  scale_max: number | null;
  options: Option[];
}

export default function FormBuilder() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addQuestion = (type: QuestionType) => {
    const newQ: Question = {
      id: Date.now().toString(),
      text: '',
      type,
      is_mandatory: true,
      is_scored: type !== 'OPEN_ENDED',
      scale_min: type === 'RATING' ? 1 : null,
      scale_max: type === 'RATING' ? 5 : null,
      options: (type === 'MCQ' || type === 'DROPDOWN') ? [
        { id: Date.now().toString() + '1', text: 'Option 1', weight: 1 }
      ] : []
    };
    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const addOption = (qId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        return {
          ...q,
          options: [...q.options, { id: Date.now().toString(), text: `Option ${q.options.length + 1}`, weight: q.options.length + 1 }]
        };
      }
      return q;
    }));
  };

  const updateOption = (qId: string, optId: string, updates: Partial<Option>) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        return {
          ...q,
          options: q.options.map(o => o.id === optId ? { ...o, ...updates } : o)
        };
      }
      return q;
    }));
  };

  const removeOption = (qId: string, optId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        return { ...q, options: q.options.filter(o => o.id !== optId) };
      }
      return q;
    }));
  };

  const handleSave = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!title) {
      setError('Title is required');
      return;
    }
    if (questions.length === 0) {
      setError('Add at least one question');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Map to API format (strip temp IDs)
      const payload = {
        title,
        description,
        status,
        questions: questions.map((q, index) => ({
          text: q.text,
          type: q.type,
          is_mandatory: q.is_mandatory,
          is_scored: q.is_scored,
          order: index,
          scale_min: q.scale_min,
          scale_max: q.scale_max,
          options: q.options.map((o, oIndex) => ({
            text: o.text,
            weight: o.weight,
            order: oIndex
          }))
        }))
      };

      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save form');
      
      router.push('/dashboard/admin/forms');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl">{error}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Form Title</label>
          <input
            type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full text-lg px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
            placeholder="e.g. End of Semester Feedback"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
            placeholder="Provide instructions for students..."
          />
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((q, index) => (
          <div key={q.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex gap-4 group">
            <div className="pt-2 cursor-grab text-gray-400 hover:text-gray-600">
              <GripVertical className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text" required value={q.text} onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                    className="w-full px-4 py-2 font-medium border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800"
                    placeholder="Question Text"
                  />
                </div>
                <div className="w-48">
                  <select
                    value={q.type} onChange={(e) => updateQuestion(q.id, { type: e.target.value as QuestionType })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800"
                  >
                    <option value="RATING">Rating Scale</option>
                    <option value="MCQ">Multiple Choice</option>
                    <option value="DROPDOWN">Dropdown</option>
                    <option value="OPEN_ENDED">Open Text</option>
                  </select>
                </div>
                <button onClick={() => removeQuestion(q.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {(q.type === 'MCQ' || q.type === 'DROPDOWN') && (
                <div className="pl-4 space-y-2 border-l-2 border-gray-100 dark:border-gray-800">
                  {q.options.map((opt, oIndex) => (
                    <div key={opt.id} className="flex gap-2 items-center">
                      <div className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-xs text-gray-400">{oIndex + 1}</div>
                      <input
                        type="text" required value={opt.text} onChange={(e) => updateOption(q.id, opt.id, { text: e.target.value })}
                        className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800"
                        placeholder="Option Text"
                      />
                      <input
                        type="number" title="Weight/Score" value={opt.weight || 0} onChange={(e) => updateOption(q.id, opt.id, { weight: parseFloat(e.target.value) })}
                        className="w-20 px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800"
                        placeholder="Wt"
                      />
                      <button onClick={() => removeOption(q.id, opt.id)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => addOption(q.id)} className="text-sm text-primary font-medium hover:underline flex items-center mt-2">
                    <Plus className="w-3 h-3 mr-1" /> Add Option
                  </button>
                </div>
              )}

              {q.type === 'RATING' && (
                <div className="pl-4 border-l-2 border-gray-100 dark:border-gray-800 flex items-center gap-4 text-sm">
                  <label className="text-gray-500">Min:</label>
                  <input type="number" value={q.scale_min || 1} onChange={e => updateQuestion(q.id, { scale_min: parseInt(e.target.value) })} className="w-16 px-2 py-1 border rounded" />
                  <label className="text-gray-500">Max:</label>
                  <input type="number" value={q.scale_max || 5} onChange={e => updateQuestion(q.id, { scale_max: parseInt(e.target.value) })} className="w-16 px-2 py-1 border rounded" />
                </div>
              )}

              <div className="flex items-center gap-6 pt-2 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={q.is_mandatory} onChange={(e) => updateQuestion(q.id, { is_mandatory: e.target.checked })} className="rounded text-primary" />
                  <span className="text-gray-600 dark:text-gray-400">Required</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={q.is_scored} onChange={(e) => updateQuestion(q.id, { is_scored: e.target.checked })} className="rounded text-primary" disabled={q.type === 'OPEN_ENDED'} />
                  <span className="text-gray-600 dark:text-gray-400">Include in Analytics</span>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 items-center justify-center py-4">
        <button onClick={() => addQuestion('RATING')} className="flex flex-col items-center p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:bg-primary/5 hover:border-primary hover:text-primary transition-colors text-gray-500">
          <List className="w-6 h-6 mb-2" />
          <span className="text-sm font-medium">Rating</span>
        </button>
        <button onClick={() => addQuestion('MCQ')} className="flex flex-col items-center p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:bg-primary/5 hover:border-primary hover:text-primary transition-colors text-gray-500">
          <CheckSquare className="w-6 h-6 mb-2" />
          <span className="text-sm font-medium">MCQ</span>
        </button>
        <button onClick={() => addQuestion('OPEN_ENDED')} className="flex flex-col items-center p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:bg-primary/5 hover:border-primary hover:text-primary transition-colors text-gray-500">
          <AlignLeft className="w-6 h-6 mb-2" />
          <span className="text-sm font-medium">Text</span>
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 px-8 flex justify-between items-center z-10 shadow-lg">
        <div className="text-sm text-gray-500">
          {questions.length} questions added
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => handleSave('DRAFT')}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 rounded-xl disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button 
            onClick={() => handleSave('PUBLISHED')}
            disabled={loading}
            className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Publish Form
          </button>
        </div>
      </div>
    </div>
  );
}
