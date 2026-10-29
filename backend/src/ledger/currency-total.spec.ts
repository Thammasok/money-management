import { currencyTotalsOf } from './currency-total';
import type { WalletWithBalance } from './wallet.entity';

const AT = new Date('2026-10-29T10:00:00.000Z');

/** A Wallet with a given Currency and Balance — only these two matter to a Currency Total. */
const aWallet = (
  currency: string,
  balanceMinor: bigint,
  overrides: { archivedAt?: Date | null } = {},
): WalletWithBalance => ({
  wallet: {
    id: `w-${currency}-${balanceMinor}`,
    userId: 'user-1',
    name: 'Cash',
    currency,
    openingBalanceMinor: 0n,
    archivedAt: overrides.archivedAt ?? null,
    createdAt: AT,
    updatedAt: AT,
  },
  balanceMinor,
});

// The rule behind the Wallet Overview's Currency Total lines: exact sums per Currency, never mixing Currencies.
describe('currencyTotalsOf', () => {
  it('adds up the Balances of the Wallets that share a Currency, one line per Currency ordered by code (S-1)', () => {
    // Arrange: Card (USD) first on purpose — the order of the input must not decide the order of the lines
    const wallets = [aWallet('USD', 1000n), aWallet('THB', 250000n), aWallet('THB', 87450n)];

    // Act
    const currencyTotals = currencyTotalsOf(wallets);

    // Assert
    expect(currencyTotals).toEqual([
      { currency: 'THB', balanceMinor: 337450n },
      { currency: 'USD', balanceMinor: 1000n },
    ]);
  });

  it('has no lines when there are no Wallets (S-6)', () => {
    // Arrange / Act
    const currencyTotals = currencyTotalsOf([]);

    // Assert
    expect(currencyTotals).toEqual([]);
  });

  it('counts an Archived Wallet like any other: its Balance is still money the User holds (S-4)', () => {
    // Arrange
    const wallets = [aWallet('THB', 48000n, { archivedAt: AT }), aWallet('THB', 100n)];

    // Act
    const currencyTotals = currencyTotalsOf(wallets);

    // Assert
    expect(currencyTotals).toEqual([{ currency: 'THB', balanceMinor: 48100n }]);
  });

  it('keeps a negative Currency Total negative and a Currency Total of zero as a line of its own (S-7)', () => {
    // Arrange: a Wallet in debt, and two Wallets whose Balances cancel out
    const wallets = [
      aWallet('JPY', -1500n),
      aWallet('THB', -250075n),
      aWallet('THB', 250075n),
      aWallet('EUR', 0n),
    ];

    // Act
    const currencyTotals = currencyTotalsOf(wallets);

    // Assert
    expect(currencyTotals).toEqual([
      { currency: 'EUR', balanceMinor: 0n },
      { currency: 'JPY', balanceMinor: -1500n },
      { currency: 'THB', balanceMinor: 0n },
    ]);
  });

  it('is exact where a float is not: two Balances past 2^53 add up to the exact value (AC-1.5)', () => {
    // Arrange
    const beyondFloat = 10999999999999989n;
    const wallets = [aWallet('KRW', beyondFloat), aWallet('KRW', beyondFloat)];

    // Act
    const currencyTotals = currencyTotalsOf(wallets);

    // Assert
    const exact = 21999999999999978n;
    expect(currencyTotals).toEqual([{ currency: 'KRW', balanceMinor: exact }]);
    expect(BigInt(Number(exact))).not.toBe(exact); // the premise: a float cannot hold this value
  });

  it('never mixes Currencies: the same amount in two Currencies stays two lines', () => {
    // Arrange
    const wallets = [aWallet('THB', 5n), aWallet('USD', 5n), aWallet('EUR', 5n)];

    // Act
    const currencyTotals = currencyTotalsOf(wallets);

    // Assert
    expect(currencyTotals.map((currencyTotal) => currencyTotal.currency)).toEqual([
      'EUR',
      'THB',
      'USD',
    ]);
    expect(currencyTotals.map((currencyTotal) => currencyTotal.balanceMinor)).toEqual([5n, 5n, 5n]);
  });
});
