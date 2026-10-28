/**
 * Shows minor units of a Currency the way every screen shows money: `en-US` (not the browser's own locale, so the text
 * is the same everywhere), the Currency CODE (`THB`, not a symbol that two Currencies share), exactly the Currency's
 * minor digits, a no-break space after the code — `THB 1,000.00`, `-JPY 1,500`.
 *
 * `minor` is the backend's decimal-integer string. It is turned into a decimal string and handed to `Intl` as text, so
 * a Balance beyond 2^53 is formatted exactly instead of being rounded through a float.
 */
export function formatMinor(minor: string, currency: string, minorDigits: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: minorDigits,
    maximumFractionDigits: minorDigits,
  }).format(toDecimalString(minor, minorDigits));
}

/**
 * `"-250075"` with 2 digits → `"-2500.75"`; `"1"` → `"0.01"`; with 0 digits the number is returned as it is. Built from
 * the digits of the backend's integer string, so it is always a numeral — which is what `Intl` takes as text.
 */
function toDecimalString(minor: string, minorDigits: number): `${number}` {
  const isNegative = minor.startsWith('-');
  const digits = (isNegative ? minor.slice(1) : minor).padStart(minorDigits + 1, '0');
  const whole = digits.slice(0, digits.length - minorDigits);
  const fraction = digits.slice(digits.length - minorDigits);
  const unsigned = minorDigits > 0 ? `${whole}.${fraction}` : whole;
  return (isNegative ? `-${unsigned}` : unsigned) as `${number}`;
}
