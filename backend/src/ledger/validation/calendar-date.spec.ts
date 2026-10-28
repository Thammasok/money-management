import { isCalendarDate } from './calendar-date';

describe('isCalendarDate', () => {
  it.each([
    ['an ordinary date', '2026-10-29'],
    ['a leap day in a leap year', '2024-02-29'],
    ['a leap day in a century leap year', '2000-02-29'],
    ['the last day of a 31-day month', '2026-12-31'],
    ['the last day of a 30-day month', '2026-04-30'],
    ['the first day of the calendar', '0001-01-01'],
    ['the last day the format can hold', '9999-12-31'],
  ])('accepts %s (%s)', (_why, value) => {
    // Arrange / Act
    const real = isCalendarDate(value);

    // Assert
    expect(real).toBe(true);
  });

  it.each([
    ['a day that does not exist (2026-02-30)', '2026-02-30'],
    ['29 February in a common year', '2023-02-29'],
    ['29 February in a century common year', '1900-02-29'],
    ['the 31st of a 30-day month', '2026-04-31'],
    ['month 13', '2026-13-01'],
    ['month 00', '2026-00-10'],
    ['day 00', '2026-10-00'],
    ['year 0000 (Postgres has no year 0)', '0000-01-01'],
    ['the day/month/year order', '29/02/2024'],
    ['single-digit month and day', '2026-2-3'],
    ['a timestamp', '2026-02-03T10:00:00Z'],
    ['leading whitespace', ' 2026-02-03'],
    ['trailing whitespace', '2026-02-03 '],
    ['a trailing newline', '2026-02-03\n'],
    ['non-ASCII digits', '٢٠٢٦-٠٢-٠٣'],
    ['an empty string', ''],
    ['the word tomorrow', 'tomorrow'],
  ])('rejects %s (%s)', (_why, value) => {
    // Arrange / Act
    const real = isCalendarDate(value);

    // Assert
    expect(real).toBe(false);
  });

  it.each([
    ['a number', 20261029],
    ['null', null],
    ['undefined', undefined],
    ['an object', {}],
    ['a Date object', new Date('2026-10-29T00:00:00Z')],
  ])('rejects %s without throwing', (_why, value) => {
    // Arrange / Act
    const real = isCalendarDate(value);

    // Assert
    expect(real).toBe(false);
  });
});
