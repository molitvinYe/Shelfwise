import { toPublicUser } from './users.service.js';

describe('toPublicUser', () => {
  it('never returns the password hash', () => {
    const user = {
      id: '0193a1b2-0000-7000-8000-000000000001',
      email: 'ada@example.com',
      passwordHash: '$argon2id$secret',
      displayName: 'Ada',
      role: 'USER' as const,
      isDemo: false,
      createdAt: new Date(),
    };

    const result = toPublicUser(user);

    expect(result).toEqual({
      id: user.id,
      email: 'ada@example.com',
      displayName: 'Ada',
      role: 'USER',
      isDemo: false,
    });
    expect(JSON.stringify(result)).not.toContain('argon2');
  });
});
