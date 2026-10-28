import { describe, expect, it } from 'vitest';
import { ApiError } from '../http/api-error';
import { GENERIC_FAILURE_TEXT } from '../http/failure-messages';
import { describeWalletFailure } from './wallet-messages';

// Boundary under test: what the person reads when a Wallet request fails (artifacts/F-2/01-requirements.md → Error
// message catalogue). The Web App shows the backend's own sentence for a 400, 401 and 404; everything else — a 5xx, a
// proxy's error page, no network at all — is the one generic sentence.

describe('describeWalletFailure', () => {
  it('shows every message of a 400, in the order the backend sent them', () => {
    // Arrange
    const failure = new ApiError(400, ['Enter a wallet name.', 'Opening balance is too large.']);

    // Act
    const lines = describeWalletFailure(failure);

    // Assert
    expect(lines).toEqual(['Enter a wallet name.', 'Opening balance is too large.']);
  });

  it.each([
    [401, 'Not signed in.'],
    [404, 'Wallet not found.'],
  ])('shows the message of a %i', (status, message) => {
    // Arrange
    const failure = new ApiError(status, [message]);

    // Act
    const lines = describeWalletFailure(failure);

    // Assert
    expect(lines).toEqual([message]);
  });

  it.each([500, 502, 415])(
    'shows the generic sentence for a %i, whatever the backend said',
    (status) => {
      // Arrange
      const failure = new ApiError(status, ['Internal server error']);

      // Act
      const lines = describeWalletFailure(failure);

      // Assert
      expect(lines).toEqual([GENERIC_FAILURE_TEXT]);
    },
  );

  it('shows the generic sentence when a 400 carries no message', () => {
    // Arrange
    const failure = new ApiError(400, []);

    // Act
    const lines = describeWalletFailure(failure);

    // Assert
    expect(lines).toEqual([GENERIC_FAILURE_TEXT]);
  });

  it('shows the generic sentence when there is no network', () => {
    // Arrange
    const failure = new TypeError('Failed to fetch');

    // Act
    const lines = describeWalletFailure(failure);

    // Assert
    expect(lines).toEqual([GENERIC_FAILURE_TEXT]);
  });
});
