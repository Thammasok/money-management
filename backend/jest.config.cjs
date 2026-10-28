// Unit tests: `*.spec.ts` under src/ — mockist, no database, no network. `npm test` and the unit gate run this.
// Integration tests (`*.int-spec.ts`, real Postgres) have their own config: test/jest-int.config.cjs.
/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  testEnvironment: 'node',
};
