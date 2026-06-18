import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedSession } from '../interfaces/authenticated-session.interface';

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession | undefined => {
    const request = context.switchToHttp().getRequest<{ session?: AuthenticatedSession }>();
    return request.session;
  },
);
