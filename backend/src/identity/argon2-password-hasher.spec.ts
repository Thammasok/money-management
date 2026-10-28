import { Argon2PasswordHasher } from './argon2-password-hasher';

// Real argon2id — the hasher is in-process and has nothing to mock (see the mocking strategy: Utility).
describe('Argon2PasswordHasher', () => {
  let hasher: Argon2PasswordHasher;

  beforeEach(() => {
    hasher = new Argon2PasswordHasher();
  });

  it('hashes with argon2id using the parameters the seeded User was hashed with (m=19456, t=2, p=1)', async () => {
    // Arrange
    const password = 'Sunny-Day-42';

    // Act
    const passwordHash = await hasher.hash(password);

    // Assert
    expect(passwordHash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
  });

  it('never stores the password itself in the hash', async () => {
    // Arrange
    const password = 'Sunny-Day-42';

    // Act
    const passwordHash = await hasher.hash(password);

    // Assert
    expect(passwordHash).not.toContain(password);
  });

  it('salts every hash, so the same password hashes differently each time', async () => {
    // Arrange
    const password = 'Sunny-Day-42';

    // Act
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);

    // Assert
    expect(first).not.toBe(second);
  });

  it('verifies the password that produced the hash', async () => {
    // Arrange
    const passwordHash = await hasher.hash('Sunny-Day-42');

    // Act
    const matches = await hasher.verify(passwordHash, 'Sunny-Day-42');

    // Assert
    expect(matches).toBe(true);
  });

  it('refuses a different password, without throwing', async () => {
    // Arrange
    const passwordHash = await hasher.hash('Sunny-Day-42');

    // Act
    const matches = await hasher.verify(passwordHash, 'Not-The-Pass-1');

    // Assert
    expect(matches).toBe(false);
  });

  it('treats letter case in the password as significant', async () => {
    // Arrange
    const passwordHash = await hasher.hash('Sunny-Day-42');

    // Act
    const matches = await hasher.verify(passwordHash, 'sunny-day-42');

    // Assert
    expect(matches).toBe(false);
  });
});
