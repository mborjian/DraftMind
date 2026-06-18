import { serverApiRequest } from '@/lib/server-api';
import type { AiProvider } from '@/types/api';
import { ProviderManager } from '@/components/providers/provider-manager';

export default async function ProvidersPage() {
  const providers = await serverApiRequest<AiProvider[]>('/ai/providers').catch(() => []);
  return <ProviderManager initialProviders={providers} />;
}
