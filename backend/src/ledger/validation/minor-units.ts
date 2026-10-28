/**
 * The most significant digits an Opening Balance or a Transaction amount may have (< 10^15). It keeps every Balance
 * and every future sum far inside BIGINT, and stops an out-of-range value from surfacing as a 500.
 */
const MAX_MINOR_UNIT_DIGITS = 15;

/** Whether the decimal-integer string has at most 15 significant digits — a leading minus and leading zeros do not count. */
export function isWithinMinorUnitLimit(value: string): boolean {
  return value.replace(/^-?0*/, '').length <= MAX_MINOR_UNIT_DIGITS;
}

/** Whether the decimal-integer string is greater than zero. */
export function isPositiveMinorUnits(value: string): boolean {
  return !value.startsWith('-') && /[1-9]/.test(value);
}
