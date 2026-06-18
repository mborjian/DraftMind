import { apiRequest } from '@/lib/api-client';
import type { HealthStatus, Publication } from '@/types/api';

export async function getHealth() {
  return apiRequest<HealthStatus>('/health');
}

export async function getAiLogs() {
  return apiRequest('/ai/logs');
}

export async function getPublications() {
  return apiRequest<Publication[]>('/publications');
}
