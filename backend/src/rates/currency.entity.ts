/**
 * The ISO-4217 money unit a Wallet holds (epic: Domain Language → Currency). It decides how many minor-unit digits
 * every amount in the Wallet has — never assume 2.
 */
export interface Currency {
  /** ISO-4217 code, upper-case (e.g. `THB`). */
  code: string;
  /** Frankfurter's name for it (e.g. `Thai Baht`). */
  name: string;
  /** ISO-4217 minor-unit digits: 2 for THB/USD, 0 for JPY/ISK/KRW, 3 for BHD. */
  minorDigits: number;
}
