// Builds mocks/imposters.json from the readable injection sources in mocks/.
// Run: npm run mocks:build   (re-run after editing any *.inject.js; commit both files)
//
// Port map:
//   4545 — this project's own /api/v1 (Remote but owned). Stage 7 Bruno `mock` env and the Stage 21
//          Vite proxy target. Grows with each feature's endpoints.
//   (F-10 adds a separate impostor for the Frankfurter rate provider — True external.)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function loadInjection(file) {
  const source = readFileSync(join(here, file), 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('//'))
    .join('\n')
    .trim();
  // Fail the build on a syntax error instead of at the first request.
  new Function(`return (${source});`)();
  return source;
}

const imposters = {
  imposters: [
    {
      port: 4545,
      protocol: 'http',
      name: 'money-management-api',
      recordRequests: false,
      stubs: [{ responses: [{ inject: loadInjection('identity-api.inject.js') }] }],
    },
  ],
};

writeFileSync(join(here, 'imposters.json'), `${JSON.stringify(imposters, null, 2)}\n`);
console.log('mocks/imposters.json written');
