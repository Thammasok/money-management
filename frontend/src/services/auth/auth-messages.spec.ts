import { describe, expect, it } from 'vitest';
import { ApiError } from '../http/api-error';
import { GENERIC_FAILURE_TEXT } from '../http/failure-messages';
import { describeSignInFailure, describeSignUpFailure, type TimeFormatter } from './auth-messages';

// Boundary under test: the two presenter functions that turn a failed call into the text the person reads.

const at1435: TimeFormatter = () => '14:35';

describe('describeSignUpFailure', () => {
  it('shows every message of a 400, one line each', () => {
    // Arrange
    const error = new ApiError(400, ['Enter a valid email address.', 'Password must be strong.']);

    // Act
    const lines = describeSignUpFailure(error);

    // Assert
    expect(lines).toEqual(['Enter a valid email address.', 'Password must be strong.']);
  });

  it('shows the message of a 409 as the backend sent it', () => {
    // Arrange
    const error = new ApiError(409, ['This email is already registered.']);

    // Act
    const lines = describeSignUpFailure(error);

    // Assert
    expect(lines).toEqual(['This email is already registered.']);
  });

  it.each([
    ['a server error', new ApiError(500, ['Internal server error'])],
    ['a 400 without a message', new ApiError(400, [])],
    ['a failed network call', new TypeError('Failed to fetch')],
    ['something that is not an error at all', 'boom'],
  ])('says something went wrong for %s', (_name, error) => {
    // Arrange — the failure is the table row

    // Act
    const lines = describeSignUpFailure(error);

    // Assert
    expect(lines).toEqual([GENERIC_FAILURE_TEXT]);
  });
});

describe('describeSignInFailure', () => {
  it('shows the 401 message as the backend sent it', () => {
    // Arrange
    const error = new ApiError(401, ['Email or password is incorrect.']);

    // Act
    const text = describeSignInFailure(error, at1435);

    // Assert
    expect(text).toBe('Email or password is incorrect.');
  });

  it('joins the messages of a 400 into one sentence', () => {
    // Arrange
    const error = new ApiError(400, ['Enter your email.', 'Enter your password.']);

    // Act
    const text = describeSignInFailure(error, at1435);

    // Assert
    expect(text).toBe('Enter your email. Enter your password.');
  });

  it('says when to try again, in the time the formatter gives for retryAt, on a 429', () => {
    // Arrange
    const error = new ApiError(
      429,
      ['Too many failed sign-ins. Try again later.'],
      '2026-10-28T09:45:00.000Z',
    );
    const formatTime = (date: Date): string => `<${date.toISOString()}>`;

    // Act
    const text = describeSignInFailure(error, formatTime);

    // Assert
    expect(text).toBe('Too many failed sign-ins. Try again at <2026-10-28T09:45:00.000Z>.');
  });

  it('formats retryAt in the browser local time as hours and minutes by default', () => {
    // Arrange
    const error = new ApiError(
      429,
      ['Too many failed sign-ins. Try again later.'],
      new Date().toISOString(),
    );

    // Act
    const text = describeSignInFailure(error);

    // Assert
    expect(text).toMatch(/^Too many failed sign-ins\. Try again at \d{1,2}:\d{2}.*\.$/);
  });

  it('falls back to the backend message when a 429 carries no usable retryAt', () => {
    // Arrange
    const error = new ApiError(429, ['Too many failed sign-ins. Try again later.'], 'not-a-date');

    // Act
    const text = describeSignInFailure(error, at1435);

    // Assert
    expect(text).toBe('Too many failed sign-ins. Try again later.');
  });

  it.each([
    ['a server error', new ApiError(503, [])],
    ['a failed network call', new TypeError('Failed to fetch')],
  ])('says something went wrong for %s', (_name, error) => {
    // Arrange — the failure is the table row

    // Act
    const text = describeSignInFailure(error, at1435);

    // Assert
    expect(text).toBe(GENERIC_FAILURE_TEXT);
  });
});
