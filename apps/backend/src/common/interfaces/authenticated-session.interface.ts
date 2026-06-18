export interface AuthenticatedSession {
  sessionId: number;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  lastSeenAt: string;
}
