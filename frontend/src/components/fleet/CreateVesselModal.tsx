import React, { useState } from 'react';
import { createVessel } from '../../api/vessels';
import type { VesselType, VesselStatus } from '../../api/vessels';
import { X, Anchor } from 'lucide-react';

interface CreateVesselModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateVesselModal: React.FC<CreateVesselModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    registrationNo: '',
    type: 'BARGE' as VesselType,
    currentLocation: '',
    latitude: '',
    longitude: '',
    status: 'IN_PORT' as VesselStatus,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Front-end Validations
    const nameTrimmed = formData.name.trim();
    const regTrimmed = formData.registrationNo.trim();
    const locTrimmed = formData.currentLocation.trim();
    const latNum = Number(formData.latitude);
    const lngNum = Number(formData.longitude);

    if (!nameTrimmed) return setError('Vessel name is required.');
    if (!regTrimmed) return setError('Registration number is required.');
    if (!locTrimmed) return setError('Current location description is required.');
    
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      return setError('Latitude must be a valid number between -90 and 90.');
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      return setError('Longitude must be a valid number between -180 and 180.');
    }

    setLoading(true);
    try {
      const res = await createVessel({
        name: nameTrimmed,
        registrationNo: regTrimmed,
        type: formData.type,
        currentLocation: locTrimmed,
        latitude: latNum,
        longitude: lngNum,
        status: formData.status,
      });

      if (res.status === 'success') {
        // Reset form
        setFormData({
          name: '',
          registrationNo: '',
          type: 'BARGE',
          currentLocation: '',
          latitude: '',
          longitude: '',
          status: 'IN_PORT',
        });
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to register vessel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl glassmorphism animate-fade-in text-slate-100 z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-4">
          <div className="flex items-center space-x-3 text-brand-400">
            <Anchor className="h-5 w-5" />
            <h2 className="text-lg font-bold text-white">Register New Vessel</h2>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-vessel-name" className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Vessel Name</label>
              <input
                type="text"
                id="modal-vessel-name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. KB 26"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            
            <div>
              <label htmlFor="modal-reg-no" className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Registration Number</label>
              <input
                type="text"
                id="modal-reg-no"
                name="registrationNo"
                required
                value={formData.registrationNo}
                onChange={handleChange}
                placeholder="e.g. REG-12345"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-type-select" className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Vessel Type</label>
              <select
                id="modal-type-select"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              >
                <option value="BARGE">Barge</option>
                <option value="TUG">Tug</option>
              </select>
            </div>

            <div>
              <label htmlFor="modal-status-select" className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Initial Status</label>
              <select
                id="modal-status-select"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              >
                <option value="ACTIVE">Active</option>
                <option value="IN_PORT">In Port</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="NON_COMPLIANT">Non Compliant</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="modal-current-location" className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Current Location</label>
            <input
              type="text"
              id="modal-current-location"
              name="currentLocation"
              required
              value={formData.currentLocation}
              onChange={handleChange}
              placeholder="e.g. Revadanda Port Jetty No. 2"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-latitude" className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Latitude (-90 to 90)</label>
              <input
                type="number"
                id="modal-latitude"
                step="any"
                name="latitude"
                required
                value={formData.latitude}
                onChange={handleChange}
                placeholder="e.g. 18.5204"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="modal-longitude" className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Longitude (-180 to 180)</label>
              <input
                type="number"
                id="modal-longitude"
                step="any"
                name="longitude"
                required
                value={formData.longitude}
                onChange={handleChange}
                placeholder="e.g. 72.8777"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 border-t border-slate-850 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-850 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer select-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-850 disabled:text-slate-500 text-white font-semibold rounded-lg text-xs transition-all flex items-center space-x-1.5 cursor-pointer glow-hover select-none"
            >
              {loading ? 'Registering...' : 'Register Vessel'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
