const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whether `value` is a real calendar date written `YYYY-MM-DD` (year 0001–9999; Postgres has no year 0). Pure string
 * arithmetic — no JS Date anywhere: a Transaction's `occurredOn` is a calendar date, never an instant, so nothing about
 * it may depend on a timezone (AD-1).
 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = DATE_SHAPE.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
