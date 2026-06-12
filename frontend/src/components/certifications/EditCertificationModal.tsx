import React, { useState, useEffect } from 'react';
import { updateCertification } from '../../api/certifications';
import type { VesselSummary, CertificationDetail } from '../../api/certifications';
import { fetchVessels } from '../../api/vessels';
import { X, AlertCircle } from 'lucide-react';

interface EditCertificationModalProps {
  cert: CertificationDetail;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditCertificationModal: React.FC<EditCertificationModalProps> = ({ 
  cert,
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

  // Helper to format Date string to yyyy-MM-dd
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (isOpen && cert) {
      // Load vessels
      const loadVessels = async () => {
        try {
          const res = await fetchVessels({});
          setVessels(res.data.vessels || res.data || []);
        } catch (err) {
          console.error('Failed to load vessels', err);
        }
      };
      loadVessels();

      // Determine linkage
      const isVessel = !!cert.vesselId;
      setLinkageType(isVessel ? 'vessel' : 'asset');

      // Pre-populate cert values
      const predefTypes = [
        'Survey Certificate',
        'GMB Registration',
        'MMD Registration',
        'Hull Insurance',
        'Condition Valuation',
        'Car & Bike Insurance',
        'Workman Compensation Insurance',
        'Land & Hotel Insurance'
      ];
      const isCustomType = !predefTypes.includes(cert.certType);

      setFormData({
        vesselId: cert.vesselId || '',
        assetType: cert.assetType || '',
        certType: isCustomType ? 'Other' : cert.certType,
        customCertType: isCustomType ? cert.certType : '',
        certNumber: cert.certNumber,
        issuingAuthority: cert.issuingAuthority,
        issueDate: formatDateForInput(cert.issueDate),
        expiryDate: formatDateForInput(cert.expiryDate),
        documentUrl: cert.documentUrl || '',
      });
      setError(null);
    }
  }, [isOpen, cert]);

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
      const payload: any = {
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
        payload.vesselId = formData.vesselId;
        payload.assetType = null;
      } else {
        if (!formData.assetType) {
          throw new Error('Please select or specify an asset type.');
        }
        payload.assetType = formData.assetType;
        payload.vesselId = null;
      }

      if (!payload.certType) {
        throw new Error('Certificate type is required.');
      }
      if (new Date(payload.issueDate) > new Date(payload.expiryDate)) {
        throw new Error('Issue date must be before or equal to expiry date.');
      }

      await updateCertification(cert.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update certificate.');
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
          <h2 className="text-lg font-bold text-white">Edit Compliance Certificate</h2>
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
                  : 'bg-slate-950/40 border-slate-800 text-slate-450 hover:border-slate-700'
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
                  : 'bg-slate-950/40 border-slate-800 text-slate-455 hover:border-slate-700'
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
                <label htmlFor="edit-vesselId" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Vessel Link *</label>
                <select
                  id="edit-vesselId"
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
                <label htmlFor="edit-assetType" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Asset Type Link *</label>
                <select
                  id="edit-assetType"
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
              <label htmlFor="edit-certType" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Certificate Type *</label>
              <select
                id="edit-certType"
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
                <label htmlFor="edit-customCertType" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Custom Certificate Type *</label>
                <input
                  type="text"
                  id="edit-customCertType"
                  name="customCertType"
                  value={formData.customCertType}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter certificate name..."
                  className="block w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-white text-xs placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}

            {/* Cert Number */}
            <div>
              <label htmlFor="edit-certNumber" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Certificate Number *</label>
              <input
                type="text"
                id="edit-certNumber"
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
              <label htmlFor="edit-issuingAuthority" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Issuing Authority *</label>
              <input
                type="text"
                id="edit-issuingAuthority"
                name="issuingAuthority"
                value={formData.issuingAuthority}
                onChange={handleInputChange}
                required
                placeholder="e.g. GMB Authority"
                className="block w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-white text-xs placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Issue Date */}
            <div>
              <label htmlFor="edit-issueDate" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Issue Date *</label>
              <input
                type="date"
                id="edit-issueDate"
                name="issueDate"
                value={formData.issueDate}
                onChange={handleInputChange}
                required
                className="block w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label htmlFor="edit-expiryDate" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Expiry Date *</label>
              <input
                type="date"
                id="edit-expiryDate"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleInputChange}
                required
                className="block w-full bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              />
            </div>

            {/* Document URL (Optional) */}
            <div className="col-span-1 md:col-span-2">
              <label htmlFor="edit-documentUrl" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Document URL Placeholder</label>
              <input
                type="url"
                id="edit-documentUrl"
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
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
