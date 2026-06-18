import { serverApiRequest } from '@/lib/server-api';
import type { Draft } from '@/types/api';
import { DraftManager } from '@/components/drafts/draft-manager';

export default async function DraftsPage() {
  const drafts = await serverApiRequest<Draft[]>('/drafts').catch(() => []);
  return <DraftManager initialDrafts={drafts} />;
}
