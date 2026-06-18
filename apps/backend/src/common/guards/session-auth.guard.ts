import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionsService } from '../../sessions/sessions.service';
import type { AuthenticatedSession } from '../interfaces/authenticated-session.interface';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessionsService: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { session?: AuthenticatedSession }>();
    const cookieToken = request.cookies?.[this.sessionsService.getCookieName()];
    const bearerToken = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice('Bearer '.length)
      : undefined;
    const token = cookieToken ?? bearerToken;

    if (!token) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const session = this.sessionsService.validateSession(token);
    if (!session) {
      throw new UnauthorizedException('The current session is invalid or expired.');
    }

    request.session = session;
    return true;
  }
}
