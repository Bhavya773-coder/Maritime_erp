import client from './client';

export type VesselType = 'BARGE' | 'TUG';
export type VesselStatus = 'ACTIVE' | 'IN_PORT' | 'MAINTENANCE' | 'NON_COMPLIANT';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Vessel {
  id: string;
  name: string;
  registrationNo: string;
  type: VesselType;
  currentLocation: string;
  latitude: number;
  longitude: number;
  status: VesselStatus;
  updatedAt: string;
  updatedBy: UserSummary;
}

export interface LocationHistory {
  id: string;
  vesselId: string;
  location: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  updatedBy: UserSummary;
}

export interface CreateVesselPayload {
  name: string;
  registrationNo: string;
  type: VesselType;
  currentLocation: string;
  latitude: number;
  longitude: number;
  status?: VesselStatus;
}

export interface UpdateLocationPayload {
  currentLocation: string;
  latitude: number;
  longitude: number;
  status: VesselStatus;
}

export const fetchVessels = async (filters: {
  type?: string;
  status?: string;
  search?: string;
}) => {
  const response = await client.get('/vessels', { params: filters });
  return response.data;
};

export const fetchVesselById = async (id: string) => {
  const response = await client.get(`/vessels/${id}`);
  return response.data;
};

export const createVessel = async (payload: CreateVesselPayload) => {
  const response = await client.post('/vessels', payload);
  return response.data;
};

export const updateVesselLocation = async (id: string, payload: UpdateLocationPayload) => {
  const response = await client.patch(`/vessels/${id}/location`, payload);
  return response.data;
};

export const fetchVesselHistory = async (id: string, page = 1, limit = 20) => {
  const response = await client.get(`/vessels/${id}/history`, {
    params: { page: String(page), limit: String(limit) },
  });
  return response.data;
};

export const fetchVesselSnapshot = async () => {
  const response = await client.get('/vessels/export/snapshot');
  return response.data;
};
