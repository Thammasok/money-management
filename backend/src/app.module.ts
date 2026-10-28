import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { IdentityModule } from './identity/identity.module';

@Module({ imports: [ConfigModule, DatabaseModule, IdentityModule] })
export class AppModule {}
