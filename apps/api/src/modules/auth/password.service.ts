import { hash, verify } from '@node-rs/argon2';
import { Injectable, type OnModuleInit } from '@nestjs/common';

/** argon2id password hashing (library defaults: argon2id, m=19 MiB, t=2, p=1). */
@Injectable()
export class PasswordService implements OnModuleInit {
  /** Verified against when the user doesn't exist, so both failure paths cost the same time. */
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await hash('dummy-password-for-timing');
  }

  hash(password: string): Promise<string> {
    return hash(password);
  }

  /** `storedHash` null/undefined = no such user (or a password-less account): still burns one verify. */
  async verify(
    storedHash: string | null | undefined,
    password: string,
  ): Promise<boolean> {
    const ok = await verify(storedHash ?? this.dummyHash, password).catch(
      () => false,
    );
    return Boolean(storedHash) && ok;
  }
}
