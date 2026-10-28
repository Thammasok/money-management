const UNSIGNED_DECIMAL = /^(\d+)(?:\.(\d+))?$/;

interface MinorUnitsOptions {
  /** True for an Opening Balance (it may be zero or negative); false for the amount of a Transaction. */
  allowNegative: boolean;
}

/**
 * Reads what a person typed ("125.50", "-2500.75") as minor units of a Currency with `minorDigits` decimals — a
 * decimal-integer string ("12550", "-250075"), the form the API takes — or `null` when it cannot be read: not a plain
 * number, or more decimals than the Currency has. Text only, never a float, so every amount is exact.
 */
export function toMinorUnits(
  typed: string,
  minorDigits: number,
  { allowNegative }: MinorUnitsOptions,
): string | null {
  const text = typed.trim();
  const isNegative = allowNegative && text.startsWith('-');
  const match = UNSIGNED_DECIMAL.exec(isNegative ? text.slice(1) : text);
  if (match === null) return null;

  const [, whole, fraction = ''] = match;
  if (fraction.length > minorDigits) return null;

  const digits = `${whole}${fraction.padEnd(minorDigits, '0')}`.replace(/^0+/, '');
  if (digits === '') return '0';
  return isNegative ? `-${digits}` : digits;
}
