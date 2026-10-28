// Integration mode only: makes sure real Postgres — with the Liquibase schema and the `test` seed — is up before the
// first spec, so `bash .claude/scripts/run-e2e.sh F-1 list` works from a cold machine (and from the Stop-time e2e-gate,
// which runs after the agent has torn everything down). Mock mode has no database: nothing happens.
//
// It returns a teardown that deletes the database again, but ONLY when this run started it — a Postgres that was
// already running (a developer's, or a manual debugging session) is left exactly as it was.
import { execFileSync } from 'node:child_process';

const COMPOSE_FILE = 'docker-compose.backing-service.yml';

function compose(...args: string[]): string {
  try {
    return execFileSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? '';
    throw new Error(`docker compose ${args.join(' ')} failed:\n${stderr}`, { cause: error });
  }
}

export default async function globalSetup(): Promise<(() => Promise<void>) | undefined> {
  if (process.env.E2E_MODE === 'mock') return undefined;

  const wasRunning = compose('ps', '--status', 'running', '-q', 'postgres').trim() !== '';
  compose('up', '-d', '--wait');
  if (wasRunning) return undefined;

  return async () => {
    compose('down', '-v');
  };
}
