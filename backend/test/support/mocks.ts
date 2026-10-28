import type { IIdentityRepository } from '../../src/identity/interfaces/identity-repository.interface';
import type { IIdentityService } from '../../src/identity/interfaces/identity-service.interface';
import type { IPasswordHasher } from '../../src/identity/interfaces/password-hasher.interface';

// Typed doubles for the Identity boundaries, shared by the unit specs so each spec only says what it needs.

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
