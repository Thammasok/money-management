import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig, loadConfig } from './app-config';

/** Provides the validated environment settings (`APP_CONFIG`) to every module. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: (): AppConfig => loadConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
