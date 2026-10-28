import { ExchangeRatesService } from './exchange-rates.service';
import { SUPPORTED_CURRENCIES } from './supported-currencies';

describe('ExchangeRatesService', () => {
  let service: ExchangeRatesService;

  beforeEach(() => {
    service = new ExchangeRatesService();
  });

  describe('listCurrencies', () => {
    it('returns the whole snapshot, sorted by code', () => {
      // Arrange / Act
      const currencies = service.listCurrencies();

      // Assert
      expect(currencies).toBe(SUPPORTED_CURRENCIES);
      expect(currencies.map((currency) => currency.code)).toEqual(
        [...currencies.map((currency) => currency.code)].sort(),
      );
    });
  });

  describe('isSupportedCurrency', () => {
    it.each(SUPPORTED_CURRENCIES.map((currency) => currency.code))('supports %s', (code) => {
      // Arrange / Act
      const supported = service.isSupportedCurrency(code);

      // Assert
      expect(supported).toBe(true);
    });

    it.each([
      ['an unknown code', 'XYZ'],
      ['a code Frankfurter dropped', 'BGN'],
      ['a lower-case code (codes are compared exactly)', 'thb'],
      ['a code with a leading space (nothing is trimmed)', ' THB'],
      ['a code with a trailing space (nothing is trimmed)', 'THB '],
      ['a longer string', 'THBX'],
      ['an empty string', ''],
      ['an Object.prototype name', 'constructor'],
    ])('refuses %s', (_why, code) => {
      // Arrange / Act
      const supported = service.isSupportedCurrency(code);

      // Assert
      expect(supported).toBe(false);
    });
  });
});
