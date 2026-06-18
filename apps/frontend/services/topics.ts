import { apiRequest } from '@/lib/api-client';
import type { Topic } from '@/types/api';

export async function approveTopic(id: number) {
  return apiRequest<Topic>(`/topics/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function rejectTopic(id: number) {
  return apiRequest<Topic>(`/topics/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function regenerateTopic(id: number) {
  return apiRequest<Topic[]>(`/topics/${id}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
