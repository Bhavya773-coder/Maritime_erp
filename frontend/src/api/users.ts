import client from './client';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
}

export const fetchActiveUsers = async () => {
  const response = await client.get('/users/active');
  return response.data;
};
