import type { Role } from '@shelfwise/shared';

/** Identity carried by the access token and attached to `req.user` by `JwtAuthGuard`. */
export interface AuthUser {
  id: string;
  role: Role;
  isDemo: boolean;
}

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}
