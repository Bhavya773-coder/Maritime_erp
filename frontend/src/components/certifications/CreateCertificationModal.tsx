import React, { useState, useEffect } from 'react';
import { createCertification } from '../../api/certifications';
import type { CreateCertificationPayload, VesselSummary } from '../../api/certifications';
import { fetchVessels } from '../../api/vessels';
import { X, AlertCircle } from 'lucide-react';

interface CreateCertificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateCertificationModal: React.FC<CreateCertificationModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [vessels, setVessels] = useState<VesselSummary[]>([]);
  const [linkageType, setLinkageType] = useState<'vessel' | 'asset'>('vessel');
  
  const [formData, setFormData] = useState({
    vesselId: '',
    assetType: '',
    certType: '',
    customCertType: '',
    certNumber: '',
    issuingAuthority: '',
    issueDate: '',
    expiryDate: '',
    documentUrl: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Load vessels for select dropdown
      const loadVessels = async () => {
        try {
          const res = await fetchVessels({});
          setVessels(res.data.vessels || res.data || []);
        } catch (err) {
          console.error('Failed to load vessels for modal dropdown', err);
        }
      };
      loadVessels();
      // Reset form states
      setFormData({
        vesselId: '',
        assetType: '',
        certType: '',
        customCertType: '',
        certNumber: '',
        issuingAuthority: '',
        issueDate: '',
        expiryDate: '',
        documentUrl: '',
      });
      setLinkageType('vessel');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Gather Payload
      const finalPayload: CreateCertificationPayload = {
        certType: formData.certType === 'Other' ? formData.customCertType : formData.certType,
        certNumber: formData.certNumber,
        issuingAuthority: formData.issuingAuthority,
        issueDate: formData.issueDate,
        expiryDate: formData.expiryDate,
        documentUrl: formData.documentUrl.trim() || null,
      };

      if (linkageType === 'vessel') {
        if (!formData.vesselId) {
          throw new Error('Please select a vessel.');
        }
        finalPayload.vesselId = formData.vesselId;
        finalPayload.assetType = null;
      } else {
        if (!formData.assetType) {
          throw new Error('Please select or specify an asset type.');
        }
        finalPayload.assetType = formData.assetType;
        finalPayload.vesselId = null;
      }

      // 2. Validate payload dates
      if (!finalPayload.certType) {
        throw new Error('Certificate type is required.');
      }
      if (new Date(finalPayload.issueDate) > new Date(finalPayload.expiryDate)) {
        throw new Error('Issue date must be before or equal to expiry date.');
      }

      // 3. API Call
      await createCertification(finalPayload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create certificate.');
    } finally {
      setLoading(false);
    }
  };

  const assetTypes = [
    'Car & Bike Insurance',
    'Workman Compensation Insurance',
    'Land & Hotel Insurance',
    'Other'
  ];

  const certTypes = linkageType === 'vessel' 
    ? ['Survey Certificate', 'GMB Registration', 'MMD Registration', 'Hull Insurance', 'Condition Valuation', 'Other']
    : ['Car & Bike Insurance', 'Workman Compensation Insurance', 'Land & Hotel Insurance', 'Other'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-fade-in my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-bold text-white">Add Compliance Certificate</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 flex items-start space-x-3 text-red-400 text-xs">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Linkage Type Radio Select */}
          <div>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Certificate Linkage Type</span>
            <div className="grid grid-cols-2 gap-4">
              <label className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer select-none transition-all text-xs font-semibold ${
                linkageType === 'vessel' 
                  ? 'bg-brand-600/10 border-brand-500 text-brand-400' 
                  : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}>
                <input 
                  type="radio" 
                  name="linkageType" 
                  checked={linkageType === 'vessel'} 
                  onChange={() => setLinkageType('vessel')}
                  className="sr-only" 
                />
                <span>Vessel Certificate</span>
              </label>

              <label className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer select-none transition-all text-xs font-semibold ${
                linkageType === 'asset' 
                  ? 'bg-brand-600/10 border-brand-500 text-brand-400' 
                  : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}>
                <input 
                  type="radio" 
                  name="linkageType" 
                  checked={linkageType === 'asset'} 
                  onChange={() => setLinkageType('asset')}
                  className="sr-only" 
                />
                <span>Non-Vessel Asset Certificate</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dynamic Linkage Fields */}
            {linkageType === 'vessel' ? (
              <div>
                <label htmlFor="vesselId-select" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Vessel Link *</label>
                <select
                  id="vesselId-select"
                  name="vesselId"
                  value={formData.vesselId}
                  onChange={handleInputChange}
                  required
                  className="block w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="">Select Vessel...</option>
                  {vessels.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label htmlFor="assetType-select" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Asset Type Link *</label>
                <select
                  id="assetType-select"
                  name="assetType"
                  value={formData.assetType}
                  onChange={handleInputChange}
                  required
                  className="block w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="">Select Asset...</option>
                  {assetTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Cert Type */}
            <div>
              <label htmlFor="certType-select" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Certificate Type *</label>
              <select
                id="certType-select"
                name="certType"
                value={formData.certType}
                onChange={handleInputChange}
                required
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              >
                <option value="">Select Type...</option>
                {certTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Custom Cert Type Input if 'Other' is chosen */}
            {formData.certType === 'Other' && (
              <div className="col-span-1 md:col-span-2">
                <label htmlFor="customCertType-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Custom Certificate Type *</label>
                <input
                  type="text"
                  id="customCertType-input"
                  name="customCertType"
                  value={formData.customCertType}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter certificate name..."
                  className="block w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}

            {/* Cert Number */}
            <div>
              <label htmlFor="certNumber-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Certificate Number *</label>
              <input
                type="text"
                id="certNumber-input"
                name="certNumber"
                value={formData.certNumber}
                onChange={handleInputChange}
                required
                placeholder="e.g. SURV-9992"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Issuing Authority */}
            <div>
              <label htmlFor="issuingAuthority-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Issuing Authority *</label>
              <input
                type="text"
                id="issuingAuthority-input"
                name="issuingAuthority"
                value={formData.issuingAuthority}
                onChange={handleInputChange}
                required
                placeholder="e.g. GMB Authority"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Issue Date */}
            <div>
              <label htmlFor="issueDate-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Issue Date *</label>
              <input
                type="date"
                id="issueDate-input"
                name="issueDate"
                value={formData.issueDate}
                onChange={handleInputChange}
                required
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label htmlFor="expiryDate-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Expiry Date *</label>
              <input
                type="date"
                id="expiryDate-input"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleInputChange}
                required
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              />
            </div>

            {/* Document URL (Optional) */}
            <div className="col-span-1 md:col-span-2">
              <label htmlFor="documentUrl-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Document URL Placeholder (Optional)</label>
              <input
                type="url"
                id="documentUrl-input"
                name="documentUrl"
                value={formData.documentUrl}
                onChange={handleInputChange}
                placeholder="e.g. https://example.com/certificates/survey.pdf"
                className="block w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 border-t border-slate-800 pt-5 mt-6">
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="py-2 px-4 border border-slate-850 hover:bg-slate-800 text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50 select-none"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="py-2 px-4 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50 select-none glow-hover"
            >
              {loading ? 'Creating...' : 'Register Certificate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
