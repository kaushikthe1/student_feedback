"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { User, CheckCircle2, ChevronRight, ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';

export default function FormFlow({ assignment, teachers, completedTeacherIds }: { assignment: any, teachers: any[], completedTeacherIds: string[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  
  // Form State
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [subjectTopic, setSubjectTopic] = useState('');
  
  const handleNext = () => {
    if (selectedTeacherId) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const formattedResponses = Object.entries(responses).map(([question_id, value]) => {
        const question = assignment.form.questions.find((q: any) => q.id === question_id);
        const res: any = { question_id };

        if (question.type === 'RATING') {
          res.rating_value = Number(value);
        } else if (question.type === 'MCQ' || question.type === 'DROPDOWN') {
          res.selected_option_id = value;
        } else if (question.type === 'OPEN_ENDED') {
          res.text_response = value;
        }
        return res;
      });

      const payload = {
        form_id: assignment.form_id,
        teacher_id: selectedTeacherId,
        subject_topic: subjectTopic || undefined,
        responses: formattedResponses,
        consent_given: consentGiven
      };

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to submit feedback');

      setSuccess(true);
      setTimeout(() => {
        router.refresh();
        router.push('/dashboard/student');
      }, 2000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
      >
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Feedback Submitted!</h2>
        <p className="text-gray-500 text-center">Thank you for your valuable feedback. Your responses have been securely recorded.</p>
      </motion.div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm space-y-8">
              <div>
                <h2 className="text-xl font-bold mb-4">Select a Teacher to Evaluate</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {teachers.map(teacher => (
                    <button
                      key={teacher.id}
                      onClick={() => setSelectedTeacherId(teacher.id)}
                      className={`relative flex items-center p-4 rounded-xl border transition-all text-left overflow-hidden ${selectedTeacherId === teacher.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-gray-200 dark:border-gray-800 hover:border-primary/50'}`}
                    >
                      {completedTeacherIds.includes(teacher.id) && (
                        <div className="absolute top-0 right-0 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          EVALUATED
                        </div>
                      )}
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-semibold">{teacher.name}</div>
                        <div className="text-xs text-gray-500">{teacher.designation} • {teacher.department.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTeacherId && (
                <div className="pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-4 duration-300">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Subject / Topic (Optional)</h3>
                  <p className="text-xs text-gray-500 mb-3">If you are evaluating this teacher for a specific class or topic, enter it here.</p>
                  <input
                    type="text"
                    placeholder="e.g. Anatomy 101 - Week 3 Lab"
                    value={subjectTopic}
                    onChange={(e) => setSubjectTopic(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleNext}
                  disabled={!selectedTeacherId}
                  className="flex items-center px-6 py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                >
                  Continue to Feedback
                  <ChevronRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors text-sm font-medium mb-6"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Teacher Selection
              </button>

              <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm space-y-12">
                
                {assignment.form.questions.map((q: any, idx: number) => (
                  <div key={q.id} className="space-y-4">
                    <label className="block text-lg font-medium">
                      {idx + 1}. {q.text}
                      {q.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {q.type === 'OPEN_ENDED' && (
                      <textarea
                        required={q.required}
                        rows={4}
                        className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all resize-none"
                        placeholder="Write your answer here..."
                        value={responses[q.id] || ''}
                        onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                      />
                    )}

                    {q.type === 'RATING' && (
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: (q.scale_max - q.scale_min + 1) }).map((_, i) => {
                          const val = q.scale_min + i;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setResponses({ ...responses, [q.id]: val })}
                              className={`w-12 h-12 rounded-xl border text-lg font-medium transition-all ${responses[q.id] === val ? 'bg-primary text-white border-primary shadow-md scale-105' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5'}`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'MCQ' && (
                      <div className="space-y-2">
                        {q.options.map((opt: any) => (
                          <label key={opt.id} className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${responses[q.id] === opt.id ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-800 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                            <input
                              type="radio"
                              name={q.id}
                              value={opt.id}
                              required={q.required}
                              checked={responses[q.id] === opt.id}
                              onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                              className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
                            />
                            <span className="ml-3 font-medium">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {q.type === 'DROPDOWN' && (
                      <select
                        required={q.required}
                        value={responses[q.id] || ''}
                        onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                        className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all appearance-none"
                      >
                        <option value="" disabled>Select an option...</option>
                        {q.options.map((opt: any) => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              {/* Privacy Notice */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-100 dark:border-blue-900/50">
                <div className="flex items-start">
                  <ShieldAlert className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                  <div className="ml-4">
                    <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2">Privacy & Anonymity Guarantee</h4>
                    <p className="text-blue-700 dark:text-blue-400 text-sm mb-4">
                      Your responses are entirely anonymous. Teachers and administrators cannot link your feedback back to you. The system only tracks that you have completed the form to prevent duplicates.
                    </p>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={consentGiven}
                        onChange={(e) => setConsentGiven(e.target.checked)}
                        className="w-5 h-5 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        I understand and consent to submit this feedback anonymously.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50 font-medium">
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !consentGiven}
                  className="flex items-center px-8 py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:hover:shadow-lg disabled:cursor-not-allowed hover:bg-blue-700 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Submitting...</>
                  ) : (
                    'Submit Feedback Securely'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
