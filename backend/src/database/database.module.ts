import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { APP_CONFIG } from '../config/app-config';
import type { AppConfig } from '../config/app-config';
import { PG_POOL } from './database.tokens';

/** Provides the one shared `pg.Pool` (`PG_POOL`) to every repository and closes it when the app shuts down. */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Pool => {
        const pool = new Pool({ connectionString: config.databaseUrl });
        // An idle client can fail (e.g. the database restarts); without a listener that would crash the process.
        pool.on('error', (error) => {
          new Logger('Database').error(`Idle database client failed: ${error.message}`);
        });
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
