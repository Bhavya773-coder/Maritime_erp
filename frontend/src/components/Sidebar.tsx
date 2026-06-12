import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  Ship, CheckSquare, FileText, ShieldAlert, 
  LogOut, User as UserIcon, BarChart3, Settings 
} from 'lucide-react';

interface SidebarProps {
  activePage: 'dashboard' | 'tasks' | 'fleet' | 'certifications' | 'vouchers' | 'settings';
}

const Sidebar: React.FC<SidebarProps> = ({ activePage }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const getLinkClass = (page: typeof activePage) => {
    const baseClass = "flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-all select-none";
    if (activePage === page) {
      return `${baseClass} bg-brand-600/10 text-brand-400`;
    }
    return `${baseClass} text-slate-400 hover:text-white hover:bg-slate-800/50`;
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 hidden md:flex">
      <div>
        {/* Brand header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 space-x-3 text-brand-500">
          <Ship className="h-6 w-6" />
          <span className="font-bold text-lg text-white tracking-wide">Sagar Shipping</span>
        </div>

        {/* Navigation links */}
        <nav className="mt-6 px-4 space-y-1">
          <Link to="/dashboard" className={getLinkClass('dashboard')}>
            <BarChart3 className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>
          <Link to="/tasks" className={getLinkClass('tasks')}>
            <CheckSquare className="h-5 w-5" />
            <span>Tasks</span>
          </Link>
          <Link to="/fleet" className={getLinkClass('fleet')}>
            <Ship className="h-5 w-5" />
            <span>Fleet Manager</span>
          </Link>
          <Link to="/certifications" className={getLinkClass('certifications')}>
            <ShieldAlert className="h-5 w-5" />
            <span>Certifications</span>
          </Link>
          <a href="#" className={getLinkClass('vouchers')}>
            <FileText className="h-5 w-5" />
            <span>Expense Vouchers</span>
          </a >
          <a href="#" className={getLinkClass('settings')}>
            <Settings className="h-5 w-5" />
            <span>Admin Settings</span>
          </a>
        </nav>
      </div>

      {/* User profile actions */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center space-x-3 px-2 mb-4">
          <div className="h-10 w-10 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400">
            <UserIcon className="h-5 w-5" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate text-white">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate capitalize">
              {user?.role.toLowerCase().replace('_', ' ')}
            </p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-2.5 w-full rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-medium text-sm transition-all cursor-pointer select-none"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
