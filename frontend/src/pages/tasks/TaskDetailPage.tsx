import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  fetchTaskById, 
  updateTaskStatus, 
  delegateTask, 
  fetchTaskChain, 
  deleteTask 
} from '../../api/tasks';
import { fetchActiveUsers } from '../../api/users';
import type { UserSummary } from '../../api/users';
import { StatusBadge } from '../../components/tasks/StatusBadge';
import { PriorityBadge } from '../../components/tasks/PriorityBadge';
import { DelegationChain } from '../../components/tasks/DelegationChain';
import { TaskComments } from '../../components/tasks/TaskComments';
import { 
  ArrowLeft, Calendar, User, UserCheck, 
  Trash2, Send, AlertCircle
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';

const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [task, setTask] = useState<any>(null);
  const [chain, setChain] = useState<any>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [statusInput, setStatusInput] = useState('');
  const [delegateUser, setDelegateUser] = useState('');
  const [delegateNote, setDelegateNote] = useState('');
  
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [submittingDelegate, setSubmittingDelegate] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAssigned = task?.taskType === 'ASSIGNED';
  const isCreator = task?.createdById === user?.id;
  const isOwner = user?.role === 'OWNER';
  const canDelete = !isAssigned && (isCreator || isOwner);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [taskRes, chainRes] = await Promise.all([
        fetchTaskById(id),
        fetchTaskChain(id)
      ]);
      
      if (taskRes.status === 'success') {
        setTask(taskRes.data.task);
        setStatusInput(taskRes.data.task.status);
      }
      if (chainRes.status === 'success') {
        setChain(chainRes.data.chain);
      }
      
      if (user?.role === 'OWNER' || user?.role === 'MANAGER') {
        const usersRes = await fetchActiveUsers();
        if (usersRes.status === 'success') {
          setUsers(usersRes.data.users);
        }
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to load task details.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (!id || !newStatus) return;
    
    setSubmittingStatus(true);
    setError(null);
    try {
      await updateTaskStatus(id, newStatus);
      setStatusInput(newStatus);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update task status.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleDelegateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !delegateUser) return;

    setSubmittingDelegate(true);
    setError(null);
    try {
      await delegateTask(id, {
        assignedToId: delegateUser,
        note: delegateNote.trim() || undefined
      });
      setDelegateUser('');
      setDelegateNote('');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delegate task.');
    } finally {
      setSubmittingDelegate(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this personal task?')) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteTask(id);
      navigate('/tasks');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete task.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-950 items-center justify-center text-slate-100">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent mx-auto"></div>
          <p className="text-slate-400 text-xs animate-pulse">Loading task workspace...</p>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="flex min-h-screen bg-slate-950 items-center justify-center p-6 text-slate-100">
        <div className="glassmorphism max-w-md w-full p-8 text-center rounded-2xl border border-red-500/10">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-white font-bold text-lg mb-2">Error Loading Task</h3>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <Link to="/tasks" className="inline-flex items-center space-x-2 text-brand-400 font-bold hover:text-brand-300">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Tasks</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Sidebar */}
      <Sidebar activePage="tasks" />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center space-x-4">
            <Link to="/tasks" className="text-slate-400 hover:text-white transition-all cursor-pointer">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-bold text-white truncate max-w-xs md:max-w-lg">Task Details</h1>
          </div>

          {canDelete ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 font-semibold py-2 px-4 rounded-lg text-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 select-none animate-fade-in"
            >
              <Trash2 className="h-4 w-4" />
              <span>{deleting ? 'Deleting...' : 'Delete Task'}</span>
            </button>
          ) : (
            isAssigned && (
              <span className="text-slate-550 text-xs italic hidden sm:inline-block">
                Assigned tasks cannot be deleted. Mark as completed instead.
              </span>
            )
          )}
        </header>

        {/* Content */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-8 flex-1 overflow-y-auto">
          
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 flex items-start space-x-3 text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="glassmorphism p-6 rounded-2xl border border-slate-800 space-y-6">
                
                {/* Header detail */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${
                      isAssigned ? 'bg-indigo-500/10 text-indigo-400' : 'bg-sky-500/10 text-sky-400'
                    }`}>
                      {task.taskType}
                    </span>
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">{task.title}</h2>
                </div>

                {/* Description info */}
                {task.description && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</h4>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap bg-slate-950/35 border border-slate-800 p-4 rounded-xl leading-relaxed">
                      {task.description}
                    </p>
                  </div>
                )}

                {/* Facts grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800/80 pt-6 text-xs text-slate-400">
                  <div className="flex items-center space-x-3">
                    <User className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-[10px] text-slate-550 uppercase tracking-wider font-semibold">Creator</p>
                      <p className="text-slate-200 font-semibold">{task.creator.name} ({task.creator.role.replace('_', ' ')})</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <UserCheck className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-[10px] text-slate-550 uppercase tracking-wider font-semibold">Current Holder</p>
                      <p className="text-slate-200 font-semibold">
                        {task.latestHolder || (isAssigned ? task.assignee?.name : task.creator.name)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-[10px] text-slate-550 uppercase tracking-wider font-semibold">Due Date</p>
                      <p className="text-slate-200 font-semibold">{new Date(task.dueDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {task.completedAt && (
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-emerald-500" />
                      <div>
                        <p className="text-[10px] text-slate-555 uppercase tracking-wider font-semibold">Completed At</p>
                        <p className="text-emerald-400 font-semibold">{new Date(task.completedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Chain */}
              {isAssigned && chain && (
                <DelegationChain chain={chain} />
              )}

              {/* Comments */}
              <TaskComments taskId={task.id} comments={task.comments || []} onCommentAdded={loadData} />

            </div>

            {/* Right Column */}
            <div className="space-y-6">
              
              {/* Status Update panel */}
              <div className="glassmorphism p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Update Status</h3>
                
                <div className="space-y-3">
                  <select
                    value={statusInput}
                    onChange={handleStatusChange}
                    disabled={submittingStatus}
                    className="block w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer disabled:opacity-50 text-xs"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    {isOwner && <option value="OVERDUE">Overdue</option>}
                  </select>
                  {submittingStatus && (
                    <p className="text-[10px] text-slate-500 animate-pulse">Syncing status changes...</p>
                  )}
                </div>
              </div>

              {/* Delegation Form (assigned tasks only) */}
              {isAssigned && (
                <div className="glassmorphism p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delegate Task</h3>
                  
                  <form onSubmit={handleDelegateSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="del-assignee" className="block text-[10px] text-slate-550 uppercase tracking-wider mb-1.5 font-semibold">New Assignee</label>
                      <select
                        id="del-assignee"
                        required
                        value={delegateUser}
                        onChange={(e) => setDelegateUser(e.target.value)}
                        className="block w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer text-xs"
                      >
                        <option value="">Select Assignee</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="del-note" className="block text-[10px] text-slate-550 uppercase tracking-wider mb-1.5 font-semibold">Delegation Note</label>
                      <textarea
                        id="del-note"
                        rows={2}
                        value={delegateNote}
                        onChange={(e) => setDelegateNote(e.target.value)}
                        className="block w-full rounded-lg bg-slate-950 border border-slate-800 py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs placeholder-slate-650"
                        placeholder="Add reason/special comments..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingDelegate || !delegateUser}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-850 disabled:text-slate-500 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer glow-hover select-none"
                    >
                      {submittingDelegate ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Delegate Task</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

            </div>

          </div>

        </main>
      </div>
    </div>
  );
};

export default TaskDetailPage;
