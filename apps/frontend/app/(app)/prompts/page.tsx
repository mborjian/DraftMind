import { serverApiRequest } from '@/lib/server-api';
import { PromptManager } from '@/components/settings/prompt-manager';

interface PromptRecord {
  id: number;
  name: string;
  content: string;
  version: number;
  enabled: boolean;
}

export default async function PromptsPage() {
  const prompts = await serverApiRequest<PromptRecord[]>('/system-prompts').catch(() => []);
  return <PromptManager initialPrompts={prompts} />;
}
