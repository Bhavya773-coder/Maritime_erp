import client from './client';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  taskType: 'ASSIGNED' | 'PERSONAL';
  assignedToId?: string | null;
  dueDate?: string | null;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: 'PENDING' | 'IN_PROGRESS' | 'DELEGATED' | 'COMPLETED' | 'OVERDUE';
}

export const fetchTasks = async (filters: {
  type?: string;
  status?: string;
  priority?: string;
  overdue?: boolean;
}) => {
  const response = await client.get('/tasks', { params: filters });
  return response.data;
};

export const fetchAllTasks = async () => {
  const response = await client.get('/tasks/all');
  return response.data;
};

export const createTask = async (payload: CreateTaskPayload) => {
  const response = await client.post('/tasks', payload);
  return response.data;
};

export const fetchTaskById = async (id: string) => {
  const response = await client.get(`/tasks/${id}`);
  return response.data;
};

export const updateTaskStatus = async (id: string, status: string) => {
  const response = await client.patch(`/tasks/${id}/status`, { status });
  return response.data;
};

export const delegateTask = async (id: string, payload: { assignedToId: string; note?: string }) => {
  const response = await client.post(`/tasks/${id}/delegate`, payload);
  return response.data;
};

export const addTaskComment = async (id: string, content: string) => {
  const response = await client.post(`/tasks/${id}/comment`, { content });
  return response.data;
};

export const fetchTaskChain = async (id: string) => {
  const response = await client.get(`/tasks/${id}/chain`);
  return response.data;
};

export const deleteTask = async (id: string) => {
  const response = await client.delete(`/tasks/${id}`);
  return response.data;
};

export const markOverdue = async () => {
  const response = await client.patch('/tasks/mark-overdue');
  return response.data;
};
