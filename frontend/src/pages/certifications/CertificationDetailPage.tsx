import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchCertificationById } from '../../api/certifications';
import type { CertificationDetail } from '../../api/certifications';
import Sidebar from '../../components/Sidebar';
import { CertificationStatusBadge } from '../../components/certifications/CertificationStatusBadge';
import { AlertHistoryTable } from '../../components/certifications/AlertHistoryTable';
import { EditCertificationModal } from '../../components/certifications/EditCertificationModal';
import { UploadDocumentModal } from '../../components/certifications/UploadDocumentModal';
import { 
  ArrowLeft, Calendar, FileText, 
  Edit, CloudUpload, ShieldAlert, Ship, HardHat, ExternalLink 
} from 'lucide-react';

const CertificationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [cert, setCert] = useState<CertificationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const isOwnerOrManager = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const loadCert = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCertificationById(id);
      setCert(res.data.cert || res.data || null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load certificate details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCert();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
        <Sidebar activePage="certifications" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></div>
          <p className="text-slate-400 text-xs mt-3 animate-pulse">Loading compliance parameters...</p>
        </div>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
        <Sidebar activePage="certifications" />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-white font-bold text-lg">Error Loading Certificate</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md">{error || 'Certificate not found.'}</p>
          <Link to="/certifications" className="mt-6 bg-slate-900 border border-slate-800 py-2 px-4 rounded-lg text-xs font-semibold text-white hover:bg-slate-800 transition-all flex items-center space-x-1">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Certifications</span>
          </Link>
        </div>
      </div>
    );
  }

  const formatDateString = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getExpiryDaysStyles = () => {
    if (cert.daysToExpiry <= 0) return 'text-rose-500 bg-rose-500/10 border-rose-500/25';
    if (cert.daysToExpiry <= 30) return 'text-amber-500 bg-amber-500/10 border-amber-500/25';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25';
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Shared Sidebar */}
      <Sidebar activePage="certifications" />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center space-x-4">
            <Link to="/certifications" className="text-slate-400 hover:text-white transition-all cursor-pointer">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-bold text-white truncate max-w-xs md:max-w-lg">Certificate Details</h1>
          </div>

          {isOwnerOrManager && (
            <div className="flex items-center space-x-2.5">
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer flex items-center space-x-1.5 select-none"
              >
                <CloudUpload className="h-4 w-4" />
                <span>Upload Document</span>
              </button>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2 px-4.5 rounded-lg text-xs transition-all flex items-center space-x-1.5 cursor-pointer glow-hover select-none"
              >
                <Edit className="h-4 w-4" />
                <span>Edit Certificate</span>
              </button>
            </div>
          )}
        </header>

        {/* Content Details View */}
        <main className="p-8 max-w-4xl w-full mx-auto space-y-6 flex-1 overflow-y-auto">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Card: Core status parameters */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Core Info */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{cert.certNumber}</span>
                    <h2 className="text-xl font-bold text-white mt-1">{cert.certType}</h2>
                  </div>
                  <CertificationStatusBadge status={cert.status} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-5 text-sm">
                  <div>
                    <span className="block text-slate-550 font-medium">Issuing Authority</span>
                    <span className="block text-slate-200 font-semibold mt-1">{cert.issuingAuthority}</span>
                  </div>
                  <div>
                    <span className="block text-slate-555 font-medium">Registration Linkage</span>
                    <div className="mt-1 flex items-center space-x-2 font-semibold">
                      {cert.vesselId ? (
                        <>
                          <Ship className="h-4 w-4 text-sky-400" />
                          <Link to={`/fleet/${cert.vesselId}`} className="text-sky-400 hover:underline">
                            {cert.vessel?.name || 'Vessel'} ({cert.vessel?.registrationNo})
                          </Link>
                        </>
                      ) : (
                        <>
                          <HardHat className="h-4 w-4 text-amber-500" />
                          <span className="text-slate-300">{cert.assetType || 'Non-Vessel'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-5 text-sm">
                  <div>
                    <span className="block text-slate-550 font-medium">Issue Date</span>
                    <span className="block text-slate-200 font-semibold mt-1">{formatDateString(cert.issueDate)}</span>
                  </div>
                  <div>
                    <span className="block text-slate-550 font-medium">Expiry Date</span>
                    <span className="block text-slate-200 font-semibold mt-1">{formatDateString(cert.expiryDate)}</span>
                  </div>
                </div>
              </div>

              {/* Alert history logs */}
              <AlertHistoryTable logs={cert.alertLogs} />

            </div>

            {/* Right Card: Expiry details & attachments */}
            <div className="md:col-span-1 space-y-6">
              
              {/* Expiry Telemetry */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 text-center space-y-4">
                <h3 className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Expiry Progress</h3>
                
                <div className={`p-4 rounded-xl border flex flex-col items-center justify-center ${getExpiryDaysStyles()}`}>
                  <Calendar className="h-7 w-7 mb-2" />
                  <span className="text-xl font-bold">
                    {cert.daysToExpiry <= 0 ? 'Expired' : `${cert.daysToExpiry} Days`}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold opacity-75 mt-0.5">
                    {cert.daysToExpiry <= 0 ? 'Action Required' : 'Remaining to Expiry'}
                  </span>
                </div>

                <div className="text-left text-xs text-slate-450 leading-relaxed border-t border-slate-850 pt-4">
                  <span className="font-semibold text-slate-350 block mb-1">Status logic:</span>
                  - Green: Valid &gt; 30 days<br />
                  - Yellow: Expiring within 30 days<br />
                  - Red: Expired or within 7 days
                </div>
              </div>

              {/* Document attachment card */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
                <h3 className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Attachments</h3>
                
                {cert.documentUrl ? (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-slate-950 p-4 border border-slate-850 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-slate-300">
                        <FileText className="h-5 w-5 text-brand-400" />
                        <span className="font-semibold text-xs truncate max-w-[120px]">Certificate.pdf</span>
                      </div>
                      <a 
                        href={cert.documentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-brand-400 hover:text-brand-350"
                        title="Open document in new tab"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    <a 
                      href={cert.documentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="block text-center py-2 bg-brand-600/10 hover:bg-brand-600/20 text-brand-400 font-semibold rounded-lg text-xs transition-all border border-brand-500/20"
                    >
                      View Document File
                    </a>
                  </div>
                ) : (
                  <div className="rounded-lg bg-slate-950 p-6 border border-slate-850 text-center text-xs space-y-2">
                    <FileText className="h-8 w-8 text-slate-755 mx-auto opacity-40" />
                    <p className="text-slate-500 font-semibold">No Document Linked</p>
                    {isOwnerOrManager && (
                      <button 
                        onClick={() => setIsUploadModalOpen(true)}
                        className="text-brand-400 hover:text-brand-350 hover:underline font-bold mt-1 text-[11px] block mx-auto cursor-pointer"
                      >
                        Add Document Link
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>

          </div>

        </main>
      </div>

      {/* Edit Certificate Modal */}
      {cert && (
        <EditCertificationModal
          cert={cert}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={loadCert}
        />
      )}

      {/* Document Upload Modal */}
      <UploadDocumentModal
        certId={cert.id}
        existingUrl={cert.documentUrl}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={loadCert}
      />

    </div>
  );
};

export default CertificationDetailPage;
