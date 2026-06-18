import { apiRequest } from '@/lib/api-client';
import type { CostSummary } from '@/types/api';

export async function getCosts() {
  return apiRequest<CostSummary>('/costs');
}
