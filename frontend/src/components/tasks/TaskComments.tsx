import React, { useState } from 'react';
import { Send, User } from 'lucide-react';
import { addTaskComment } from '../../api/tasks';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { name: string; email: string; role: string };
}

interface TaskCommentsProps {
  taskId: string;
  comments: Comment[];
  onCommentAdded: () => void;
}

export const TaskComments: React.FC<TaskCommentsProps> = ({ taskId, comments, onCommentAdded }) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setError(null);
    setSubmitting(true);
    try {
      await addTaskComment(taskId, content.trim());
      setContent('');
      onCommentAdded();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Comments Thread</h3>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
        
        {/* Comment List */}
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
          {comments.length === 0 ? (
            <p className="text-slate-550 text-xs italic text-center py-4">No comments posted yet. Start the thread below.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex items-start space-x-3 bg-slate-950/20 border border-slate-800 p-3 rounded-lg text-xs">
                <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 select-none">
                  <User className="h-4 w-4" />
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-slate-200 font-bold">{comment.user.name}</span>
                    <span className="text-[10px] text-slate-550">{new Date(comment.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed break-words">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment Form */}
        <form onSubmit={handleSubmit} className="border-t border-slate-800/80 pt-4 space-y-3">
          {error && <p className="text-red-400 text-xs">{error}</p>}
          
          <div className="flex items-center space-x-2">
            <input
              type="text"
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 bg-slate-950 border border-slate-850 rounded-lg py-2.5 px-3.5 text-xs text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold p-2.5 rounded-lg transition-all shrink-0 cursor-pointer flex items-center justify-center"
            >
              {submitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
