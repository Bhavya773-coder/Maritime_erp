import client from './client';

export const getVesselDocuments = (vesselId: string) =>
  client.get(`/vessels/${vesselId}/documents`);

export const searchVesselDocuments = (name?: string, type?: string) =>
  client.get('/vessels/documents/search', { params: { name, type } });
