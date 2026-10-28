// Integration tests: `*.int-spec.ts` under test/ — real Postgres (docker-compose.backing-service.yml, Liquibase
// `test` context applied), real argon2id, the real Nest app through Supertest. Run with `npm run test:int`.
// Not part of `npm test` / the unit gate: it needs `docker compose … up -d --wait` first.
/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.int-spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testEnvironment: 'node',
  testTimeout: 30000,
};
