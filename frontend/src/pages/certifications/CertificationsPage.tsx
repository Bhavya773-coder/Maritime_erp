import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  fetchCertifications, 
  recalculateCertificationStatuses, 
  checkCertificationAlerts
} from '../../api/certifications';
import type { Certification, VesselSummary } from '../../api/certifications';
import { fetchVessels } from '../../api/vessels';
import Sidebar from '../../components/Sidebar';
import { ComplianceSummaryCards } from '../../components/certifications/ComplianceSummaryCards';
import { CertificationFilters } from '../../components/certifications/CertificationFilters';
import { CertificationCard } from '../../components/certifications/CertificationCard';
import { CreateCertificationModal } from '../../components/certifications/CreateCertificationModal';
import { 
  Plus, AlertCircle, ShieldAlert, RefreshCw as RecalcIcon, Terminal, BellRing
} from 'lucide-react';

const CertificationsPage: React.FC = () => {
  const { user } = useAuth();

  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [vessels, setVessels] = useState<VesselSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    status: 'all',
    certType: 'all',
    vesselId: 'all',
    assetType: 'all',
    expiringWithinDays: 'all',
    search: '',
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isOwnerOrManager = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const isOwner = user?.role === 'OWNER';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch matching certs
      const certsQuery: any = {};
      if (filters.status !== 'all') certsQuery.status = filters.status;
      if (filters.certType !== 'all') certsQuery.certType = filters.certType;
      if (filters.vesselId !== 'all') certsQuery.vesselId = filters.vesselId;
      if (filters.assetType !== 'all') certsQuery.assetType = filters.assetType;
      if (filters.expiringWithinDays !== 'all') certsQuery.expiringWithinDays = Number(filters.expiringWithinDays);
      if (filters.search.trim()) certsQuery.search = filters.search;

      const certsRes = await fetchCertifications(certsQuery);
      setCertifications(certsRes.data.certs || certsRes.data || []);

      // Fetch vessels (only if not loaded)
      if (vessels.length === 0) {
        const vesselsRes = await fetchVessels({});
        setVessels(vesselsRes.data.vessels || vesselsRes.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load certifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleRecalculateStatuses = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await recalculateCertificationStatuses();
      const info = res.data;
      setActionMessage({
        type: 'success',
        text: `Successfully recalculated! Valid: ${info.valid}, Expiring Soon: ${info.expiringSoon}, Expired: ${info.expired}. (Updated ${info.updated} certificate statuses in database).`
      });
      loadData();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to recalculate statuses.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckAlerts = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await checkCertificationAlerts();
      const info = res.data;
      if (info.alertsCreated === 0) {
        setActionMessage({
          type: 'success',
          text: `Alert check completed. Checked ${info.checked} certificates. All matching warnings are already logged (deduplicated). 0 new alerts created.`
        });
      } else {
        setActionMessage({
          type: 'success',
          text: `Alert check completed! Checked ${info.checked} certificates. Registered ${info.alertsCreated} new warning logs to the database.`
        });
      }
      loadData();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to check alerts.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Shared Sidebar */}
      <Sidebar activePage="certifications" />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-md sticky top-0 z-20">
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <span>Compliance & Certifications</span>
          </h1>
          
          <div className="flex items-center space-x-3">
            {/* Owner Administrative Actions */}
            {isOwner && (
              <div className="flex items-center space-x-2 border-r border-slate-800 pr-3 mr-1">
                <button
                  onClick={handleRecalculateStatuses}
                  disabled={loading || actionLoading}
                  className="py-2 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 select-none flex items-center space-x-1"
                  title="Recalculate all certificate statuses based on today's date"
                >
                  <RecalcIcon className={`h-3.5 w-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Recalculate Status</span>
                </button>
                
                <button
                  onClick={handleCheckAlerts}
                  disabled={loading || actionLoading}
                  className="py-2 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 select-none flex items-center space-x-1"
                  title="Scan for exact 90, 30, and 7 day offsets and log alerts"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Check Alerts</span>
                </button>
              </div>
            )}

            {/* Add Certificate Trigger */}
            {isOwnerOrManager && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-all flex items-center space-x-1.5 cursor-pointer glow-hover select-none"
              >
                <Plus className="h-4 w-4" />
                <span>Add Certificate</span>
              </button>
            )}
          </div>
        </header>

        {/* Content View */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6 flex-1 overflow-y-auto">
          
          {/* Action Status Output Display */}
          {actionMessage && (
            <div className={`rounded-lg p-4 flex items-start space-x-3 text-xs border ${
              actionMessage.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            } animate-fade-in`}>
              <Terminal className="h-5 w-5 shrink-0 text-current" />
              <div className="flex-1 flex justify-between items-center">
                <span>{actionMessage.text}</span>
                <button 
                  onClick={() => setActionMessage(null)}
                  className="ml-3 text-slate-500 hover:text-white cursor-pointer select-none font-bold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 flex items-start space-x-3 text-red-400 animate-fade-in text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Compliance summary totals cards */}
          {!loading && <ComplianceSummaryCards certifications={certifications} />}

          {/* Filters Bar */}
          <CertificationFilters filters={filters} setFilters={setFilters} vessels={vessels} />

          {/* Listing Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></div>
              <p className="text-slate-400 text-xs animate-pulse">Querying compliance database...</p>
            </div>
          ) : (
            <>
              {certifications.length === 0 ? (
                <div className="glassmorphism p-16 text-center rounded-xl border border-slate-800/60 max-w-lg mx-auto mt-6">
                  <ShieldAlert className="h-14 w-14 text-slate-700 mx-auto mb-4" />
                  <h3 className="text-slate-300 font-bold text-base mb-1">No Certificates Found</h3>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
                    No compliance certificates match your filters. Expand your expiring window, search values, or filters to find records.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {certifications.map(cert => (
                    <CertificationCard key={cert.id} cert={cert} />
                  ))}
                </div>
              )}
            </>
          )}

        </main>
      </div>

      {/* Add Certificate Modal */}
      <CreateCertificationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadData}
      />

    </div>
  );
};

export default CertificationsPage;
