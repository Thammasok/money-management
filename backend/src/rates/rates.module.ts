import { Module } from '@nestjs/common';
import { CurrenciesController } from './currencies.controller';
import { ExchangeRatesService } from './exchange-rates.service';
import { RATES_SERVICE } from './rates.tokens';

/**
 * Exchange Rates. From F-2: which Currencies are supported (a fixed snapshot of Frankfurter's list, Q-35), asked by
 * Ledger when a Wallet is created and read by the Web App to fill its Currency picker. F-10 adds rate fetching.
 */
@Module({
  controllers: [CurrenciesController],
  providers: [{ provide: RATES_SERVICE, useClass: ExchangeRatesService }],
  exports: [RATES_SERVICE],
})
export class RatesModule {}
