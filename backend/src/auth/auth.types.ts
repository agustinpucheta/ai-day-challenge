import type { Request } from 'express';
import type { UserRecord } from '../users/users.service';
import type { MeResponseDto } from './dto/me-response.dto';

/** Public projection of the logged-in user. Never includes credentials. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
}

export type MeResponse = MeResponseDto;

/** Request after SessionGuard has resolved the user from the server-side session. */
export type AuthenticatedRequest = Request & { authUser?: AuthenticatedUser };

export function toAuthenticatedUser(user: UserRecord): AuthenticatedUser {
  return { id: user.id, email: user.emailNormalized, displayName: user.displayName };
}

export function toMeResponse(user: AuthenticatedUser): MeResponse {
  // Jira connection status is a placeholder until Phase 2.
  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    jira: { connected: false },
  };
}

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}
