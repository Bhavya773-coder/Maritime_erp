import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasks, fetchAllTasks, markOverdue } from '../../api/tasks';
import { TaskFilters } from '../../components/tasks/TaskFilters';
import { TaskCard } from '../../components/tasks/TaskCard';
import { CreateTaskModal } from '../../components/tasks/CreateTaskModal';
import { Plus, AlertCircle } from 'lucide-react';
import Sidebar from '../../components/Sidebar';

const TasksPage: React.FC = () => {
  const { user } = useAuth();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewScope, setViewScope] = useState<'my' | 'all'>(user?.role === 'OWNER' ? 'all' : 'my');
  
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    priority: 'all',
    overdue: false,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [overdueLoading, setOverdueLoading] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      if (viewScope === 'all') {
        const res = await fetchAllTasks();
        if (res.status === 'success') {
          let filtered = res.data.tasks;
          
          if (filters.type !== 'all') {
            filtered = filtered.filter((t: any) => t.taskType.toLowerCase() === filters.type);
          }
          if (filters.status !== 'all') {
            filtered = filtered.filter((t: any) => t.status.toLowerCase() === filters.status);
          }
          if (filters.priority !== 'all') {
            filtered = filtered.filter((t: any) => t.priority.toLowerCase() === filters.priority);
          }
          if (filters.overdue) {
            filtered = filtered.filter((t: any) => t.status === 'OVERDUE');
          }
          setTasks(filtered);
        }
      } else {
        const apiFilters: any = {};
        if (filters.type !== 'all') apiFilters.type = filters.type;
        if (filters.status !== 'all') apiFilters.status = filters.status;
        if (filters.priority !== 'all') apiFilters.priority = filters.priority;
        if (filters.overdue) apiFilters.overdue = true;

        const res = await fetchTasks(apiFilters);
        if (res.status === 'success') {
          setTasks(res.data.tasks);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [viewScope, filters]);

  const handleMarkOverdue = async () => {
    setOverdueLoading(true);
    try {
      await markOverdue();
      loadTasks();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to mark tasks overdue');
    } finally {
      setOverdueLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Sidebar */}
      <Sidebar activePage="tasks" />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-md sticky top-0 z-20">
          <h1 className="text-xl font-bold text-white">Tasks Management</h1>
          <div className="flex items-center space-x-3">
            {user?.role === 'OWNER' && (
              <button
                onClick={handleMarkOverdue}
                disabled={overdueLoading}
                className="py-2 px-4 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 select-none"
              >
                {overdueLoading ? 'Processing...' : 'Mark Overdue'}
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-all flex items-center space-x-1.5 cursor-pointer glow-hover select-none"
            >
              <Plus className="h-4 w-4" />
              <span>Create Task</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6 flex-1">
          
          {/* Owner Tab options */}
          {user?.role === 'OWNER' && (
            <div className="border-b border-slate-800 flex space-x-6 text-sm font-semibold select-none">
              <button
                onClick={() => setViewScope('all')}
                className={`pb-3 border-b-2 transition-all cursor-pointer ${
                  viewScope === 'all'
                    ? 'border-brand-500 text-brand-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                All System Tasks
              </button>
              <button
                onClick={() => setViewScope('my')}
                className={`pb-3 border-b-2 transition-all cursor-pointer ${
                  viewScope === 'my'
                    ? 'border-brand-500 text-brand-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                My Tasks & Chains
              </button>
            </div>
          )}

          {/* Filters bar */}
          <TaskFilters filters={filters} setFilters={setFilters} />

          {/* Cards listing */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 flex items-start space-x-3 text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></div>
              <p className="text-slate-400 text-xs animate-pulse">Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="glassmorphism p-12 text-center rounded-xl border border-slate-800/60">
              <Plus className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-slate-300 font-bold text-base mb-1">No Tasks Found</h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                No tasks match your selection. Click "Create Task" to assign a new inspection or to-do.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}

        </main>
      </div>

      {/* Create Modal */}
      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadTasks}
      />
    </div>
  );
};

export default TasksPage;
