import { z } from 'zod';
import { Role } from '../enums.js';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** Body of `POST /auth/register`. */
export const RegisterInput = z.object({
  email: Email,
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
  displayName: z.string().trim().min(2).max(40),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

/** Body of `POST /auth/login`. No password policy here: don't leak it to people guessing. */
export const LoginInput = z.object({
  email: Email,
  password: z.string().min(1).max(PASSWORD_MAX),
});
export type LoginInput = z.infer<typeof LoginInput>;

/** The user as the client sees it. Never contains the password hash. */
export const PublicUser = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
  role: Role,
  isDemo: z.boolean(),
});
export type PublicUser = z.infer<typeof PublicUser>;

/** Response of register / login / demo / refresh / me. Tokens travel only in httpOnly cookies. */
export const AuthResponse = z.object({ user: PublicUser });
export type AuthResponse = z.infer<typeof AuthResponse>;
