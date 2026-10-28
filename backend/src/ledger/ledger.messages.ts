/**
 * Exact message texts shared by validation, the service and (through the contract) the Web App, the Bruno suite and the
 * Mountebank impostor (artifacts/F-2/01-requirements.md → Error message catalogue). Change all or none.
 */
export const LedgerMessage = {
  walletName: 'Enter a wallet name.',
  walletNameLength: 'Wallet name must be at most 60 characters.',
  currency: 'Choose a supported currency.',
  openingBalanceFormat: 'Opening balance must be a whole number of minor units.',
  openingBalanceTooLarge: 'Opening balance is too large.',
  kind: 'Choose income or expense.',
  amountFormat: 'Amount must be a whole number of minor units.',
  amountPositive: 'Amount must be greater than 0.',
  amountTooLarge: 'Amount is too large.',
  occurredOn: 'Enter a valid date.',
  futureDate: "Date can't be in the future.",
  note: 'Note must be at most 200 characters.',
  today: 'today must be a valid date (YYYY-MM-DD).',
  walletNotFound: 'Wallet not found.',
} as const;
