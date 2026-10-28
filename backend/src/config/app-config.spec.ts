import { loadConfig } from './app-config';

const DATABASE_URL = 'postgresql://user:pass@localhost:5432/app';

describe('loadConfig', () => {
  it('reads the database URL and defaults to port 3000 with non-secure cookies outside production', () => {
    // Arrange
    const env = { DATABASE_URL };

    // Act
    const config = loadConfig(env);

    // Assert
    expect(config).toEqual({ port: 3000, databaseUrl: DATABASE_URL, cookieSecure: false });
  });

  it('refuses to start without a database URL, saying which variable is missing', () => {
    // Arrange
    const env = {};

    // Act
    const load = () => loadConfig(env);

    // Assert
    expect(load).toThrow('DATABASE_URL is required');
  });

  it('reads the port', () => {
    // Arrange
    const env = { DATABASE_URL, PORT: '4100' };

    // Act
    const config = loadConfig(env);

    // Assert
    expect(config.port).toBe(4100);
  });

  it.each(['abc', '0', '65536', '30.5', '-1'])('refuses PORT=%s', (port) => {
    // Arrange
    const env = { DATABASE_URL, PORT: port };

    // Act
    const load = () => loadConfig(env);

    // Assert
    expect(load).toThrow('PORT must be a whole number between 1 and 65535');
  });

  describe('cookieSecure', () => {
    it('is on in production unless switched off', () => {
      // Arrange
      const env = { DATABASE_URL, NODE_ENV: 'production' };

      // Act
      const config = loadConfig(env);

      // Assert
      expect(config.cookieSecure).toBe(true);
    });

    it('can be switched on explicitly, e.g. behind HTTPS in a staging environment', () => {
      // Arrange
      const env = { DATABASE_URL, COOKIE_SECURE: 'true' };

      // Act
      const config = loadConfig(env);

      // Assert
      expect(config.cookieSecure).toBe(true);
    });

    it('can be switched off explicitly, e.g. a production-mode build served over plain HTTP locally', () => {
      // Arrange
      const env = { DATABASE_URL, NODE_ENV: 'production', COOKIE_SECURE: 'false' };

      // Act
      const config = loadConfig(env);

      // Assert
      expect(config.cookieSecure).toBe(false);
    });

    it('refuses anything but "true" or "false"', () => {
      // Arrange
      const env = { DATABASE_URL, COOKIE_SECURE: 'yes' };

      // Act
      const load = () => loadConfig(env);

      // Assert
      expect(load).toThrow('COOKIE_SECURE must be "true" or "false"');
    });
  });
});
