import { z } from 'zod';

/** User role. Mirrors the Prisma `Role` enum. */
export const Role = z.enum(['USER', 'ADMIN']);
export type Role = z.infer<typeof Role>;
