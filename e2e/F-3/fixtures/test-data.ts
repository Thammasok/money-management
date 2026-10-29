// Canonical F-3 test data (artifacts/F-3/03-scenarios.md → Test Data).
// Message texts are the catalogue in artifacts/F-3/01-requirements.md — shared with the backend, the Mountebank
// impostor (mocks/ledger-api.inject.js) and the Bruno collection (collection/F-3): change all or none.
export { localDate, uniqueEmail } from '../../F-2/fixtures/test-data';

export const Messages = {
  noWallets: 'No wallets yet.', // F-2
  noTransactions: 'No transactions yet.', // F-2
  walletName: 'Enter a wallet name.', // F-2 text, reused by rename
  walletNameLength: 'Wallet name must be at most 60 characters.', // F-2 text, reused by rename
  archivedWallet: 'This wallet is archived and accepts no new transactions.', // 409 on recording
  archivedNotice: 'This wallet is archived. It keeps its history but accepts no new transactions.', // Web App
  archiveConfirm: "Archive this wallet? It keeps its history but accepts no new transactions. This can't be undone.", // Web App
  archivedMark: 'Archived', // Web App row mark
} as const;
