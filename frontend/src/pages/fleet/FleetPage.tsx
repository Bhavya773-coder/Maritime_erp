import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchVessels, fetchVesselSnapshot } from '../../api/vessels';
import type { Vessel } from '../../api/vessels';
import { VesselFilters } from '../../components/fleet/VesselFilters';
import { VesselCard } from '../../components/fleet/VesselCard';
import { FleetMap } from '../../components/fleet/FleetMap';
import { CreateVesselModal } from '../../components/fleet/CreateVesselModal';
import { UpdateLocationModal } from '../../components/fleet/UpdateLocationModal';
import { Ship, Plus, Download, AlertCircle, RefreshCw } from 'lucide-react';
import Sidebar from '../../components/Sidebar';

const FleetPage: React.FC = () => {
  const { user } = useAuth();
  
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [filteredVessels, setFilteredVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    search: '',
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedVesselForUpdate, setSelectedVesselForUpdate] = useState<Vessel | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const canAddVessel = user?.role === 'OWNER';
  const canUpdateLocation = user?.role === 'OWNER' || user?.role === 'FLEET_MANAGER';

  const loadVessels = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchVessels({});
      if (res.status === 'success') {
        setVessels(res.data.vessels || res.data || []);
      } else {
        setVessels(res.data || res.vessels || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load vessels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVessels();
  }, []);

  // Filter vessels on frontend dynamically
  useEffect(() => {
    let result = [...vessels];

    if (filters.type !== 'all') {
      result = result.filter(v => v.type === filters.type);
    }

    if (filters.status !== 'all') {
      result = result.filter(v => v.status === filters.status);
    }

    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(v => 
        v.name.toLowerCase().includes(searchLower) ||
        v.registrationNo.toLowerCase().includes(searchLower)
      );
    }

    setFilteredVessels(result);
  }, [vessels, filters]);

  const handleExportSnapshot = async () => {
    setExportLoading(true);
    try {
      const res = await fetchVesselSnapshot();
      const payload = res.data || res;
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `fleet_snapshot_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to export snapshot.');
    } finally {
      setExportLoading(false);
    }
  };

  const openUpdateModal = (vessel: Vessel) => {
    setSelectedVesselForUpdate(vessel);
    setIsUpdateModalOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Sidebar */}
      <Sidebar activePage="fleet" />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-md sticky top-0 z-20">
          <h1 className="text-xl font-bold text-white">Fleet Location Tracker</h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportSnapshot}
              disabled={exportLoading}
              className="py-2 px-4 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 select-none flex items-center space-x-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{exportLoading ? 'Exporting...' : 'Export Snapshot JSON'}</span>
            </button>
            {canAddVessel && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-all flex items-center space-x-1.5 cursor-pointer glow-hover select-none"
              >
                <Plus className="h-4 w-4" />
                <span>Add Vessel</span>
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6 flex-1 overflow-y-auto">
          
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 flex items-start space-x-3 text-red-400 animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Filters Bar */}
          <VesselFilters filters={filters} setFilters={setFilters} />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></div>
              <p className="text-slate-400 text-xs animate-pulse">Loading fleet tracking systems...</p>
            </div>
          ) : (
            <>
              {/* Map View */}
              <FleetMap vessels={filteredVessels} />

              {/* Grid Section Header */}
              <div className="flex items-center justify-between border-b border-slate-850 pb-3 mt-8">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Vessels Directory ({filteredVessels.length})</h2>
                <button 
                  onClick={loadVessels}
                  className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-900 transition-all cursor-pointer"
                  title="Reload Vessels"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {/* Cards Directory */}
              {filteredVessels.length === 0 ? (
                <div className="glassmorphism p-12 text-center rounded-xl border border-slate-800/60">
                  <Ship className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                  <h3 className="text-slate-300 font-bold text-base mb-1">No Vessels Found</h3>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto">
                    No active or registered vessels match your filters. Adjust the status, type, or search term to try again.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredVessels.map(vessel => (
                    <VesselCard 
                      key={vessel.id} 
                      vessel={vessel} 
                      canUpdateLocation={canUpdateLocation}
                      onUpdateLocationClick={openUpdateModal}
                    />
                  ))}
                </div>
              )}
            </>
          )}

        </main>
      </div>

      {/* Register Vessel Modal */}
      <CreateVesselModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadVessels}
      />

      {/* Update Location Modal */}
      <UpdateLocationModal
        vessel={selectedVesselForUpdate}
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false);
          setSelectedVesselForUpdate(null);
        }}
        onSuccess={loadVessels}
      />

    </div>
  );
};

export default FleetPage;
