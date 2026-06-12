import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  fetchVesselById, 
  fetchVesselHistory, 
} from '../../api/vessels';
import type { Vessel, LocationHistory } from '../../api/vessels';
import { VesselStatusBadge } from '../../components/fleet/VesselStatusBadge';
import { FleetMap } from '../../components/fleet/FleetMap';
import { VesselHistoryTable } from '../../components/fleet/VesselHistoryTable';
import { UpdateLocationModal } from '../../components/fleet/UpdateLocationModal';
import { 
  ArrowLeft, MapPin, Compass, Calendar, 
  User, Anchor, Ship, AlertCircle, Edit
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';

const VesselDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [history, setHistory] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination for history
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLimit] = useState(10);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const canUpdateLocation = user?.role === 'OWNER' || user?.role === 'FLEET_MANAGER';

  const loadVesselDetails = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchVesselById(id);
      if (res.status === 'success') {
        setVessel(res.data.vessel || res.data || null);
      } else {
        setVessel(res.data || res.vessel || null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load vessel details.');
    } finally {
      setLoading(false);
    }
  };

  const loadLocationHistory = async (page: number) => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const res = await fetchVesselHistory(id, page, historyLimit);
      if (res.status === 'success') {
        const payload = res.data || res;
        setHistory(payload.history || []);
        setHistoryTotal(payload.total || 0);
        setHistoryTotalPages(payload.totalPages || 1);
        setHistoryPage(payload.page || page);
      } else {
        const payload = res.data || res;
        setHistory(payload.history || []);
        setHistoryTotal(payload.total || 0);
        setHistoryTotalPages(payload.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Failed to load location history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadVesselDetails();
  }, [id]);

  useEffect(() => {
    loadLocationHistory(historyPage);
  }, [id, historyPage]);

  const handleUpdateSuccess = () => {
    loadVesselDetails();
    setHistoryPage(1);
    loadLocationHistory(1);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-950 items-center justify-center text-slate-100">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent mx-auto"></div>
          <p className="text-slate-400 text-xs animate-pulse">Loading vessel profile...</p>
        </div>
      </div>
    );
  }

  if (error && !vessel) {
    return (
      <div className="flex min-h-screen bg-slate-950 items-center justify-center p-6 text-slate-100">
        <div className="glassmorphism max-w-md w-full p-8 text-center rounded-2xl border border-red-500/10">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-white font-bold text-lg mb-2">Error Loading Vessel</h3>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <Link to="/fleet" className="inline-flex items-center space-x-2 text-brand-400 font-bold hover:text-brand-300">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Fleet</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Sidebar */}
      <Sidebar activePage="fleet" />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center space-x-4">
            <Link to="/fleet" className="text-slate-400 hover:text-white transition-all cursor-pointer">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-bold text-white truncate max-w-xs md:max-w-lg">Vessel Profile</h1>
          </div>

          {canUpdateLocation && vessel && (
            <button
              onClick={() => setIsUpdateModalOpen(true)}
              className="bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-all flex items-center space-x-1.5 cursor-pointer glow-hover select-none"
            >
              <Edit className="h-4 w-4" />
              <span>Update Location</span>
            </button>
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

          {vessel && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Left Column (Metadata and History Table) */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Vessel details card */}
                <div className="glassmorphism p-6 rounded-2xl border border-slate-800 space-y-6">
                  
                  <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-850 text-brand-400">
                        <Anchor className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white leading-tight">{vessel.name}</h2>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">{vessel.type}</p>
                      </div>
                    </div>
                    <VesselStatusBadge status={vessel.status} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                    
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-slate-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-550 uppercase tracking-wider font-semibold">Current Location</p>
                        <p className="text-slate-200 font-bold text-sm mt-0.5">{vessel.currentLocation}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Compass className="h-5 w-5 text-slate-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-550 uppercase tracking-wider font-semibold">Coordinates</p>
                        <p className="text-slate-200 font-mono text-sm mt-0.5 font-bold">
                          {vessel.latitude.toFixed(5)}° N, {vessel.longitude.toFixed(5)}° E
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 border-t border-slate-850 sm:border-t-0 pt-4 sm:pt-0">
                      <User className="h-5 w-5 text-slate-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-550 uppercase tracking-wider font-semibold">Updated By</p>
                        <p className="text-slate-200 font-semibold mt-0.5">
                          {vessel.updatedBy?.name || 'System'} 
                          <span className="text-slate-500 font-normal text-[11px] capitalize ml-1.5">
                            ({vessel.updatedBy?.role?.toLowerCase().replace('_', ' ') || 'system'})
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 border-t border-slate-850 pt-4 sm:pt-0">
                      <Calendar className="h-5 w-5 text-slate-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-550 uppercase tracking-wider font-semibold">Last Reported</p>
                        <p className="text-slate-200 font-semibold mt-0.5">{new Date(vessel.updatedAt).toLocaleString()}</p>
                      </div>
                    </div>

                  </div>

                  <div className="border-t border-slate-850 pt-4 text-xs text-slate-500 flex justify-between">
                    <span>Registration: <strong>{vessel.registrationNo}</strong></span>
                    <span>Database ID: <strong className="font-mono text-[10px]">{vessel.id}</strong></span>
                  </div>

                </div>

                {/* History Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between select-none">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historical Coordinates Trail</h3>
                    {historyLoading && (
                      <span className="text-[10px] text-slate-500 animate-pulse">Syncing logs...</span>
                    )}
                  </div>
                  
                  <VesselHistoryTable
                    history={history}
                    page={historyPage}
                    totalPages={historyTotalPages}
                    onPageChange={setHistoryPage}
                    total={historyTotal}
                  />
                </div>

              </div>

              {/* Right Column (Single Vessel Map View) */}
              <div className="space-y-6">
                
                {/* Map Card */}
                <div className="glassmorphism p-4 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 select-none">Live Vessel Position</h3>
                  <FleetMap vessels={[vessel]} />
                </div>

                {/* Action panel */}
                {!canUpdateLocation && (
                  <div className="glassmorphism p-6 rounded-2xl border border-slate-800 text-center space-y-3">
                    <Ship className="h-8 w-8 text-slate-750 mx-auto" />
                    <h4 className="text-slate-300 font-bold text-xs">Read-Only Clearance</h4>
                    <p className="text-slate-500 text-[11px] max-w-xs mx-auto">
                      Your current role does not have authorization to update fleet coordinates. Please contact the Fleet Manager or Owner for coordinates revision.
                    </p>
                  </div>
                )}

              </div>

            </div>
          )}

        </main>
      </div>

      {/* Update Location Modal */}
      {vessel && (
        <UpdateLocationModal
          vessel={vessel}
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          onSuccess={handleUpdateSuccess}
        />
      )}

    </div>
  );
};

export default VesselDetailPage;
