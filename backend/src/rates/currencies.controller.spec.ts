import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createExchangeRatesServiceMock } from '../../test/support/mocks';
import { CurrenciesController } from './currencies.controller';
import { RATES_SERVICE } from './rates.tokens';

// Controller under test: the real transport (routing, serialisation), the business logic mocked.
describe('CurrenciesController', () => {
  let app: INestApplication;
  let rates: ReturnType<typeof createExchangeRatesServiceMock>;

  beforeEach(async () => {
    rates = createExchangeRatesServiceMock();
    const moduleRef = await Test.createTestingModule({
      controllers: [CurrenciesController],
      providers: [{ provide: RATES_SERVICE, useValue: rates }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/currencies', () => {
    it('answers 200 with the list Exchange Rates holds, under the `currencies` key', async () => {
      // Arrange
      rates.listCurrencies.mockReturnValue([
        { code: 'JPY', name: 'Japanese Yen', minorDigits: 0 },
        { code: 'THB', name: 'Thai Baht', minorDigits: 2 },
      ]);

      // Act
      const response = await request(app.getHttpServer()).get('/api/v1/currencies');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        currencies: [
          { code: 'JPY', name: 'Japanese Yen', minorDigits: 0 },
          { code: 'THB', name: 'Thai Baht', minorDigits: 2 },
        ],
      });
    });
  });
});
