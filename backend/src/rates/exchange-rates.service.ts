import { Injectable } from '@nestjs/common';
import type { Currency } from './currency.entity';
import type { IExchangeRatesService } from './interfaces/exchange-rates-service.interface';
import { SUPPORTED_CURRENCIES } from './supported-currencies';

const SUPPORTED_CODES: ReadonlySet<string> = new Set(
  SUPPORTED_CURRENCIES.map((currency) => currency.code),
);

/** Answers from the fixed snapshot of Frankfurter's Currency list (Q-35): no Gateway, no live call, no table. */
@Injectable()
export class ExchangeRatesService implements IExchangeRatesService {
  listCurrencies(): readonly Currency[] {
    return SUPPORTED_CURRENCIES;
  }

  isSupportedCurrency(code: string): boolean {
    return SUPPORTED_CODES.has(code);
  }
}
