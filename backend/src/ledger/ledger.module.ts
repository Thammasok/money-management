import { Module } from '@nestjs/common';
import { RatesModule } from '../rates/rates.module';
import { LedgerController } from './ledger.controller';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';
import { LEDGER_REPOSITORY, LEDGER_SERVICE } from './ledger.tokens';

/**
 * Owns Wallets and Transactions and derives Balances. Every read and write is scoped to the Wallets the signed-in
 * User owns. Asks Exchange Rates whether a Currency is supported; never reads `users` (Identity owns them) — the
 * signed-in User arrives through the global guard and `@CurrentUser()`.
 */
@Module({
  imports: [RatesModule],
  controllers: [LedgerController],
  providers: [
    { provide: LEDGER_SERVICE, useClass: LedgerService },
    { provide: LEDGER_REPOSITORY, useClass: LedgerRepository },
  ],
})
export class LedgerModule {}
