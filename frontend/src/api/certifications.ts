import client from './client';

export type CertificateStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

export interface VesselSummary {
  id: string;
  name: string;
  registrationNo: string;
}

export interface AlertLog {
  id: string;
  certificateId: string;
  alertWindow: number;
  sentAt: string;
}

export interface Certification {
  id: string;
  vesselId: string | null;
  vessel?: VesselSummary | null;
  assetType: string | null;
  certType: string;
  certNumber: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  documentUrl: string | null;
  status: CertificateStatus;
  createdAt: string;
  updatedAt: string;
  daysToExpiry: number;
}

export interface CertificationDetail extends Certification {
  vessel?: (VesselSummary & { type: string; status: string }) | null;
  alertLogs: AlertLog[];
}

export interface CreateCertificationPayload {
  vesselId?: string | null;
  assetType?: string | null;
  certType: string;
  certNumber: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  documentUrl?: string | null;
}

export interface UpdateCertificationPayload {
  vesselId?: string | null;
  assetType?: string | null;
  certType?: string;
  certNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  documentUrl?: string | null;
}

export interface CertificationsFilters {
  vesselId?: string;
  assetType?: string;
  certType?: string;
  status?: string;
  expiringWithinDays?: number;
  search?: string;
}

export const fetchCertifications = async (filters: CertificationsFilters) => {
  const response = await client.get('/certs', { params: filters });
  return response.data;
};

export const fetchCertificationById = async (id: string) => {
  const response = await client.get(`/certs/${id}`);
  return response.data;
};

export const createCertification = async (payload: CreateCertificationPayload) => {
  const response = await client.post('/certs', payload);
  return response.data;
};

export const updateCertification = async (id: string, payload: UpdateCertificationPayload) => {
  const response = await client.patch(`/certs/${id}`, payload);
  return response.data;
};

export const fetchExpiringCertifications = async (days = 30) => {
  const response = await client.get('/certs/expiring', { params: { days: String(days) } });
  return response.data;
};

export const uploadCertificationDocument = async (id: string, documentUrl: string) => {
  const response = await client.post(`/certs/${id}/upload`, { documentUrl });
  return response.data;
};

export const recalculateCertificationStatuses = async () => {
  const response = await client.patch('/certs/recalculate-status');
  return response.data;
};

export const checkCertificationAlerts = async () => {
  const response = await client.post('/certs/check-alerts');
  return response.data;
};
