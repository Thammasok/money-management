import type { IIdentityRepository } from '../../src/identity/interfaces/identity-repository.interface';
import type { IIdentityService } from '../../src/identity/interfaces/identity-service.interface';
import type { IPasswordHasher } from '../../src/identity/interfaces/password-hasher.interface';
import type { ILedgerRepository } from '../../src/ledger/interfaces/ledger-repository.interface';
import type { ILedgerService } from '../../src/ledger/interfaces/ledger-service.interface';
import type { IExchangeRatesService } from '../../src/rates/interfaces/exchange-rates-service.interface';

// Typed doubles for the module boundaries, shared by the unit specs so each spec only says what it needs.

export function createIdentityServiceMock(): jest.Mocked<IIdentityService> {
  return {
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn(),
    authenticate: jest.fn(),
  };
}

export function createIdentityRepositoryMock(): jest.Mocked<IIdentityRepository> {
  return {
    insertUser: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    insertSession: jest.fn(),
    slideSession: jest.fn(),
    deleteSession: jest.fn(),
    getSignInAttemptWindow: jest.fn(),
    insertSignInAttempt: jest.fn(),
    deleteSignInAttempts: jest.fn(),
  };
}

export function createPasswordHasherMock(): jest.Mocked<IPasswordHasher> {
  return { hash: jest.fn(), verify: jest.fn() };
}

export function createLedgerServiceMock(): jest.Mocked<ILedgerService> {
  return {
    createWallet: jest.fn(),
    listWallets: jest.fn(),
    getWallet: jest.fn(),
    updateWallet: jest.fn(),
    recordTransaction: jest.fn(),
  };
}

export function createLedgerRepositoryMock(): jest.Mocked<ILedgerRepository> {
  return {
    insertWallet: jest.fn(),
    listWalletsOwnedBy: jest.fn(),
    findOwnedWallet: jest.fn(),
    findOwnedWalletDetail: jest.fn(),
    updateOwnedWallet: jest.fn(),
    insertTransaction: jest.fn(),
  };
}

export function createExchangeRatesServiceMock(): jest.Mocked<IExchangeRatesService> {
  return { listCurrencies: jest.fn(), isSupportedCurrency: jest.fn() };
}
