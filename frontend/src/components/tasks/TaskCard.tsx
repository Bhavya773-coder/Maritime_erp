import React from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { Calendar, User, MessageSquare, ArrowRight, UserCheck } from 'lucide-react';

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    taskType: 'ASSIGNED' | 'PERSONAL';
    status: 'PENDING' | 'IN_PROGRESS' | 'DELEGATED' | 'COMPLETED' | 'OVERDUE';
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    creator: { name: string; email: string };
    assignee?: { name: string; email: string } | null;
    latestHolder?: string;
    dueDate: string;
    delegationCount?: number;
    commentsCount?: number;
  };
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const isAssigned = task.taskType === 'ASSIGNED';
  const displayHolder = task.latestHolder || (isAssigned ? task.assignee?.name : task.creator.name) || 'Unassigned';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm">
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${
            isAssigned ? 'bg-indigo-500/10 text-indigo-400' : 'bg-sky-500/10 text-sky-400'
          }`}>
            {task.taskType}
          </span>
          <div className="flex items-center space-x-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
        </div>

        {/* Title */}
        <div>
          <h4 className="text-base font-bold text-white leading-snug group-hover:text-brand-400 transition-all truncate" title={task.title}>
            {task.title}
          </h4>
        </div>

        {/* Details list */}
        <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/60 pt-3">
          <div className="flex items-center space-x-2">
            <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="truncate">Creator: <strong className="text-slate-300 font-semibold">{task.creator.name}</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            <UserCheck className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="truncate">Holder: <strong className="text-slate-300 font-semibold">{displayHolder}</strong></span>
          </div>
        </div>

        {/* Due date */}
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span>Due: <strong className="text-slate-300 font-semibold">{new Date(task.dueDate).toLocaleDateString()}</strong></span>
        </div>
      </div>

      {/* Action footer */}
      <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-4">
        <div className="flex items-center space-x-4 text-xs text-slate-400">
          <div className="flex items-center space-x-1.5" title="Comments">
            <MessageSquare className="h-4 w-4 text-slate-500" />
            <span>{task.commentsCount ?? 0}</span>
          </div>
          {isAssigned && (
            <div className="flex items-center space-x-1" title="Delegation Count">
              <span className="text-[10px] font-bold text-slate-500">Chain:</span>
              <span className="font-semibold text-slate-300">{task.delegationCount ?? 0}</span>
            </div>
          )}
        </div>
        
        <Link 
          to={`/tasks/${task.id}`}
          className="flex items-center space-x-1 text-xs font-bold text-brand-400 group-hover:text-brand-300 transition-all"
        >
          <span>View Details</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>
    </div>
  );
};
