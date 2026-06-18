import { serverApiRequest } from '@/lib/server-api';
import type { AiProvider, AppSettings } from '@/types/api';
import { SettingsManager } from '@/components/settings/settings-manager';

export default async function SettingsPage() {
  const [settings, providers] = await Promise.all([
    serverApiRequest<AppSettings>('/settings').catch(() => null),
    serverApiRequest<AiProvider[]>('/ai/providers').catch(() => []),
  ]);

  if (!settings) {
    return null;
  }

  return <SettingsManager initialSettings={settings} providers={providers} />;
}
