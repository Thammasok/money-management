import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { IdentityModule } from './identity/identity.module';
import { LedgerModule } from './ledger/ledger.module';
import { RatesModule } from './rates/rates.module';

@Module({ imports: [ConfigModule, DatabaseModule, IdentityModule, RatesModule, LedgerModule] })
export class AppModule {}
