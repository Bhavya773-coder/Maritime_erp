import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  Ship, CheckSquare, FileText, ShieldAlert, 
  LogOut, User as UserIcon, Bell, ChevronRight, BarChart3, Settings
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const placeholderStats = {
    tasks: { pending: 12, inProgress: 4, overdue: 2 },
    fleet: { total: 8, active: 3, inPort: 5, maintenance: 0 },
    certs: { valid: 24, expiring: 3, expired: 1 },
    vouchers: { pending: 5, approved: 42, rejected: 3 },
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800 space-x-3 text-brand-500">
            <Ship className="h-6 w-6" />
            <span className="font-bold text-lg text-white tracking-wide">Sagar Shipping</span>
          </div>

          {/* Navigation links */}
          <nav className="mt-6 px-4 space-y-1">
            <Link to="/dashboard" className="flex items-center space-x-3 px-4 py-3 rounded-lg bg-brand-600/10 text-brand-400 font-medium transition-all">
              <BarChart3 className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            <Link to="/tasks" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 font-medium transition-all">
              <CheckSquare className="h-5 w-5" />
              <span>Tasks</span>
            </Link>
            <a href="#" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 font-medium transition-all">
              <Ship className="h-5 w-5" />
              <span>Fleet Manager</span>
            </a>
            <a href="#" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 font-medium transition-all">
              <ShieldAlert className="h-5 w-5" />
              <span>Certificates</span>
            </a>
            <a href="#" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 font-medium transition-all">
              <FileText className="h-5 w-5" />
              <span>Expense Vouchers</span>
            </a>
            <a href="#" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 font-medium transition-all">
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
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role.toLowerCase().replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-2.5 w-full rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-medium text-sm transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Topbar */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-white">Dashboard Overview</h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* Notification bell */}
            <button className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand-500 animate-ping"></span>
            </button>

            {/* Department info */}
            {user?.department && (
              <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                {user.department} Dept
              </span>
            )}
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-8 flex-1">
          {/* Welcome banner */}
          <div className="relative p-6 rounded-2xl overflow-hidden glassmorphism shadow-xl bg-gradient-to-r from-brand-900/40 via-brand-800/10 to-transparent border border-slate-800">
            <div className="absolute top-0 right-0 h-full w-1/3 bg-radial-gradient from-brand-500/10 to-transparent blur-2xl pointer-events-none"></div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome Back, {user?.name}!</h2>
            <p className="text-slate-400 text-sm max-w-xl">
              You are signed in as an <span className="text-brand-400 font-semibold">{user?.role}</span>. Here is your current operations status across fleet management, task chains, certifications, and approvals.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 1: Task Management */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                    <CheckSquare className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-semibold text-indigo-400 tracking-wider uppercase bg-indigo-500/5 px-2.5 py-1 rounded-md">Tasks Tracker</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Task Accountability</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Track assigned work delegations and personal items. Ensure clear ownership chains.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-xl font-bold text-white">{placeholderStats.tasks.pending}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Pending</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-xl font-bold text-brand-400">{placeholderStats.tasks.inProgress}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Active</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-xl font-bold text-red-500">{placeholderStats.tasks.overdue}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Overdue</div>
                  </div>
                </div>
              </div>
              <Link to="/tasks" className="mt-6 flex items-center justify-center space-x-2 text-sm font-semibold text-brand-400 group-hover:text-brand-300 transition-all cursor-pointer">
                <span>Manage Tasks</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Card 2: Fleet Location Tracker */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400">
                    <Ship className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-semibold text-sky-400 tracking-wider uppercase bg-sky-500/5 px-2.5 py-1 rounded-md">Vessel Map</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Fleet Operations</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Monitor barge and tug locations, coordinate ports, and trace historical movements.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-lg font-bold text-white">{placeholderStats.fleet.total}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Total</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-lg font-bold text-green-400">{placeholderStats.fleet.active}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Active</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-lg font-bold text-sky-400">{placeholderStats.fleet.inPort}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mt-1">In Port</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-lg font-bold text-slate-400">{placeholderStats.fleet.maintenance}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Maint.</div>
                  </div>
                </div>
              </div>
              <button className="mt-6 flex items-center justify-center space-x-2 text-sm font-semibold text-brand-400 group-hover:text-brand-300 transition-all cursor-pointer">
                <span>View Fleet Map</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Card 3: Compliance & Certificates */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-semibold text-amber-400 tracking-wider uppercase bg-amber-500/5 px-2.5 py-1 rounded-md">Compliance</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Certification Tracker</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Ensure all regulatory documentations are active. Prevent vessel expiration halts.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-xl font-bold text-green-400">{placeholderStats.certs.valid}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Valid</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-xl font-bold text-amber-400">{placeholderStats.certs.expiring}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Expiring</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-xl font-bold text-red-500">{placeholderStats.certs.expired}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Expired</div>
                  </div>
                </div>
              </div>
              <button className="mt-6 flex items-center justify-center space-x-2 text-sm font-semibold text-brand-400 group-hover:text-brand-300 transition-all cursor-pointer">
                <span>View Compliance Status</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Card 4: Expense Vouchers */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <FileText className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase bg-emerald-500/5 px-2.5 py-1 rounded-md">Voucher Inbox</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Digital Expense Vouchers</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Submit field receipts digitally and manage approval workflows remotely.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-xl font-bold text-brand-400">{placeholderStats.vouchers.pending}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Pending</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-xl font-bold text-green-400">{placeholderStats.vouchers.approved}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Approved</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60 text-center">
                    <div className="text-xl font-bold text-red-400">{placeholderStats.vouchers.rejected}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Rejected</div>
                  </div>
                </div>
              </div>
              <button className="mt-6 flex items-center justify-center space-x-2 text-sm font-semibold text-brand-400 group-hover:text-brand-300 transition-all cursor-pointer">
                <span>Go to Approvals</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
