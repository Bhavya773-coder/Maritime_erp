import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { createTask } from '../../api/tasks';
import { fetchActiveUsers } from '../../api/users';
import type { UserSummary } from '../../api/users';
import { X, AlertCircle } from 'lucide-react';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<'PERSONAL' | 'ASSIGNED'>('PERSONAL');
  const [assignedToId, setAssignedToId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isOwnerOrManager = user?.role === 'OWNER' || user?.role === 'MANAGER';

  useEffect(() => {
    if (isOpen && isOwnerOrManager) {
      const loadUsers = async () => {
        setLoadingUsers(true);
        try {
          const res = await fetchActiveUsers();
          if (res.status === 'success') {
            setUsers(res.data.users);
          }
        } catch (err) {
          console.error('Failed to load active users:', err);
        } finally {
          setLoadingUsers(false);
        }
      };
      loadUsers();
    }
  }, [isOpen, isOwnerOrManager]);

  useEffect(() => {
    if (taskType === 'PERSONAL') {
      setAssignedToId('');
    }
  }, [taskType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload: any = {
        title,
        description: description || undefined,
        taskType,
        priority,
        assignedToId: taskType === 'ASSIGNED' ? assignedToId : null,
        dueDate: dueDate ? dueDate : null,
      };

      await createTask(payload);
      onSuccess();
      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setTaskType('PERSONAL');
      setAssignedToId('');
      setDueDate('');
      setPriority('MEDIUM');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.message ||
        err.message ||
        'Failed to create task.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden text-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <h3 className="text-base font-bold text-white">Create New Task</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-all cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 flex items-start space-x-3 text-red-400 text-xs">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Task Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Task Type</label>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setTaskType('PERSONAL')}
                className={`flex-1 py-2 px-3 rounded-lg border text-center font-semibold transition-all cursor-pointer ${
                  taskType === 'PERSONAL'
                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 font-bold'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-950/80'
                }`}
              >
                Personal Task
              </button>
              {isOwnerOrManager && (
                <button
                  type="button"
                  onClick={() => setTaskType('ASSIGNED')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-center font-semibold transition-all cursor-pointer ${
                    taskType === 'ASSIGNED'
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-950/80'
                  }`}
                >
                  Assigned Task
                </button>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="task-title" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Title</label>
            <input
              type="text"
              id="task-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full rounded-lg bg-slate-950 border border-slate-800 py-2.5 px-3 text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g. Inspect Tug 2 engine block"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="task-desc" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description (Optional)</label>
            <textarea
              id="task-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-lg bg-slate-950 border border-slate-800 py-2.5 px-3 text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Provide detailed instructions..."
            />
          </div>

          {/* Row details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-priority" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Priority</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-duedate" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Due Date {taskType === 'ASSIGNED' ? '(Required)' : '(Optional)'}
              </label>
              <input
                type="date"
                id="task-duedate"
                required={taskType === 'ASSIGNED'}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="block w-full rounded-lg bg-slate-950 border border-slate-800 py-2.5 px-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Assignee dropdown */}
          {taskType === 'ASSIGNED' && (
            <div>
              <label htmlFor="task-assignee" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Assignee</label>
              {loadingUsers ? (
                <div className="py-2 text-slate-400 text-xs animate-pulse">Loading active personnel...</div>
              ) : (
                <select
                  id="task-assignee"
                  required
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="block w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="">Select Assignee</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="flex space-x-3 border-t border-slate-800/80 pt-6 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-slate-800 text-slate-400 font-semibold rounded-lg hover:bg-slate-800 hover:text-white transition-all cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-lg transition-all cursor-pointer text-center glow-hover flex items-center justify-center"
            >
              {submitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                'Create Task'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
