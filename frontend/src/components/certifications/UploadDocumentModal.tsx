import React, { useState, useEffect } from 'react';
import { uploadCertificationDocument } from '../../api/certifications';
import { X, AlertCircle, CloudUpload } from 'lucide-react';

interface UploadDocumentModalProps {
  certId: string;
  existingUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  certId,
  existingUrl,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [documentUrl, setDocumentUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDocumentUrl(existingUrl || '');
      setError(null);
    }
  }, [isOpen, existingUrl]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const trimmed = documentUrl.trim();
      if (!trimmed) {
        throw new Error('Please enter a document URL.');
      }
      // Simple url format check
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        throw new Error('Document URL must be a valid URL starting with http:// or https://');
      }

      await uploadCertificationDocument(certId, trimmed);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to upload document.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-2 text-brand-400">
            <CloudUpload className="h-5 w-5" />
            <h2 className="text-sm font-bold text-white">Upload Certificate PDF</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 flex items-start space-x-2.5 text-red-400 text-xs">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="docUrl-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Document URL Link</label>
            <input
              type="url"
              id="docUrl-input"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              required
              placeholder="e.g. https://s3.amazonaws.com/apil-certs/surv.pdf"
              className="block w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-white text-xs placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* S3 Warning Box */}
          <div className="rounded-lg bg-slate-950 border border-slate-850 p-3.5 text-[11px] text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-350 block mb-1">Upload Placeholder Note:</span>
            Actual secure S3 pre-signed URL upload will be added in a future update. For now, please paste a direct URL linking to the certificate PDF document.
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2.5 border-t border-slate-800 pt-4 mt-5">
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="py-2 px-3.5 border border-slate-850 hover:bg-slate-800 text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50 select-none"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="py-2 px-4 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50 select-none glow-hover"
            >
              {loading ? 'Uploading...' : 'Link PDF Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
