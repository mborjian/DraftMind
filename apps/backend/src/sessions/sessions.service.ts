import { Injectable } from '@nestjs/common';
import { DEFAULT_SESSION_DURATION_MINUTES, SESSION_COOKIE_FALLBACK } from '../common/constants/app.constants';
import type { AuthenticatedSession } from '../common/interfaces/authenticated-session.interface';
import { createOpaqueToken, sha256 } from '../common/utils/crypto.util';
import { DatabaseService } from '../database/database.service';

interface SessionRow {
  id: number;
  token: string;
  expiresAt: string;
  createdAt: string;
  lastSeenAt: string;
}

@Injectable()
export class SessionsService {
  constructor(private readonly databaseService: DatabaseService) {}

  getCookieName(): string {
    return process.env.SESSION_COOKIE_NAME?.trim() || SESSION_COOKIE_FALLBACK;
  }

  createSession(durationMinutes?: number): { token: string; expiresAt: string } {
    const token = createOpaqueToken();
    const tokenHash = sha256(token);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (durationMinutes ?? this.getConfiguredDurationMinutes()) * 60_000,
    ).toISOString();

    this.databaseService.run(
      'INSERT INTO Session (token, expiresAt, createdAt, lastSeenAt) VALUES (?, ?, ?, ?)',
      [tokenHash, expiresAt, now.toISOString(), now.toISOString()],
    );

    return { token, expiresAt };
  }

  validateSession(token: string): AuthenticatedSession | null {
    const row = this.databaseService.get<SessionRow>(
      'SELECT id, token, expiresAt, createdAt, lastSeenAt FROM Session WHERE token = ?',
      [sha256(token)],
    );

    if (!row) {
      return null;
    }

    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      this.revokeToken(token);
      return null;
    }

    const now = new Date().toISOString();
    this.databaseService.run('UPDATE Session SET lastSeenAt = ? WHERE id = ?', [now, row.id]);

    return {
      sessionId: row.id,
      tokenHash: row.token,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      lastSeenAt: now,
    };
  }

  revokeToken(token: string): void {
    this.databaseService.run('DELETE FROM Session WHERE token = ?', [sha256(token)]);
  }

  revokeTokenHash(tokenHash: string): void {
    this.databaseService.run('DELETE FROM Session WHERE token = ?', [tokenHash]);
  }

  cleanupExpiredSessions(): void {
    this.databaseService.run('DELETE FROM Session WHERE expiresAt <= ?', [new Date().toISOString()]);
  }

  private getConfiguredDurationMinutes(): number {
    const setting = this.databaseService.get<{ sessionDurationMinutes: number }>(
      'SELECT sessionDurationMinutes FROM AppSettings WHERE id = 1',
    );
    return setting?.sessionDurationMinutes ?? DEFAULT_SESSION_DURATION_MINUTES;
  }
}
