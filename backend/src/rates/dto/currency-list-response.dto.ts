import type { Currency } from '../currency.entity';

/** Body of `GET /api/v1/currencies`: the snapshot, sorted by `code`. */
export interface CurrencyListResponseDto {
  currencies: readonly Currency[];
}
