import { Injectable } from '@nestjs/common';
import type { PublicUser } from '@shelfwise/shared';
import type { User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type UserWithoutHash = Omit<User, 'passwordHash'>;

/** Maps a user row to the public contract. The only way user data leaves this module. */
export function toPublicUser(user: UserWithoutHash): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isDemo: user.isDemo,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws Prisma `P2002` on a duplicate email; callers map it (no pre-check, avoids races). */
  create(data: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findDemo(): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { isDemo: true } });
  }
}
