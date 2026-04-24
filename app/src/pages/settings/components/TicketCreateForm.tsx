import React, { memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertCircle, MessageSquare, Send, X } from 'lucide-react';

const ticketSchema = z.object({
  title: z.string().min(5, 'Subject must be at least 5 characters').max(200, 'Subject is too long'),
  category: z.enum(['bug', 'feature', 'performance', 'account', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(20, 'Please provide more details (min 20 characters)').max(5000, 'Description is too long'),
});

type TicketFormData = z.infer<typeof ticketSchema>;

interface TicketCreateFormProps {
  onSubmit: (data: TicketFormData) => void;
  onCancel: () => void;
}

export const TicketCreateForm = memo(({ onSubmit, onCancel }: TicketCreateFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      category: 'bug',
      priority: 'medium',
    }
  });

  return (
    <div className="flex-1 p-4 md:p-8 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto scroll-smooth h-full">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950 sticky top-0 z-10">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Create Support Ticket</h2>
              <p className="text-sm text-slate-500 mt-1 font-medium">How can our support team help you today?</p>
            </div>
            <button 
              onClick={onCancel}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form className="p-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Subject Field */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                Subject
                <span className="text-red-500">*</span>
              </label>
              <input 
                {...register('title')}
                type="text" 
                placeholder="Brief description of the issue"
                className={`w-full px-4 py-3 text-base bg-white dark:bg-slate-900 border ${errors.title ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-800'} rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm placeholder:text-slate-400`}
              />
              {errors.title && (
                <p className="text-xs font-semibold text-red-500 flex items-center gap-1.5 mt-1 anim-fade-in">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* Grid for Category and Priority - FIXED LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                  Category
                </label>
                <div className="relative group">
                  <select 
                    {...register('category')}
                    className="w-full px-4 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer shadow-sm group-hover:border-slate-300 dark:group-hover:border-slate-700"
                  >
                    <option value="bug">Bug / Error</option>
                    <option value="feature">Feature Request</option>
                    <option value="performance">Performance Issue</option>
                    <option value="account">Account Issue</option>
                    <option value="other">Other</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-slate-600 transition-colors">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                  Priority
                </label>
                <div className="relative group">
                  <select 
                    {...register('priority')}
                    className="w-full px-4 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer shadow-sm group-hover:border-slate-300 dark:group-hover:border-slate-700"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-slate-600 transition-colors">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                Description
                <span className="text-red-500">*</span>
              </label>
              <textarea 
                {...register('description')}
                rows={8}
                placeholder="Please provide as much detail as possible (steps to reproduce, expected vs actual behavior, etc.)..."
                className={`w-full px-4 py-3 text-sm bg-white dark:bg-slate-900 border ${errors.description ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-800'} rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm leading-relaxed placeholder:text-slate-400`}
              />
              {errors.description && (
                <p className="text-xs font-semibold text-red-500 flex items-center gap-1.5 mt-1 anim-fade-in">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
              <button 
                type="button"
                onClick={onCancel}
                className="px-6 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 text-center"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-8 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Ticket
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

TicketCreateForm.displayName = 'TicketCreateForm';
