import { SetMetadata } from '@nestjs/common';
import type { Role } from '@shelfwise/shared';

export const ROLES_KEY = 'auth:roles';

/** Restricts a route to the given roles (checked by the global `RolesGuard`). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
