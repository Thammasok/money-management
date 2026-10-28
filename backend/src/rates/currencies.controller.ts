import { Controller, Get, Inject } from '@nestjs/common';
import type { CurrencyListResponseDto } from './dto/currency-list-response.dto';
import type { IExchangeRatesService } from './interfaces/exchange-rates-service.interface';
import { RATES_SERVICE } from './rates.tokens';

/** Controller for the supported-Currency list under `/api/v1` — what the Web App's Currency picker reads. */
@Controller('currencies')
export class CurrenciesController {
  constructor(@Inject(RATES_SERVICE) private readonly rates: IExchangeRatesService) {}

  /** The snapshot, sorted by code, with each Currency's ISO-4217 minor digits. */
  @Get()
  list(): CurrencyListResponseDto {
    return { currencies: this.rates.listCurrencies() };
  }
}
