import { formatMinor } from '../money/format-minor';
import { NO_TRANSACTIONS_TEXT } from '../services/wallets/wallet-messages';
import type { TransactionKind } from '../services/wallets/wallet.types';
import type { TransactionListProps } from './component-props';

const KIND_LABELS = { income: 'Income', expense: 'Expense' } satisfies Record<
  TransactionKind,
  string
>;

/**
 * Humble: a Wallet's Transactions as rows, in the order given (the backend sorts newest first), or the empty text.
 * Each row is found by `data-transaction-row` and its fields by `data-field`, the contract the E2E suite relies on.
 * The amount is unsigned: the Kind says whether money came in or went out, in words (`data-kind` only adds a colour to
 * Income). The date is shown exactly as stored.
 */
export function TransactionList({ transactions, currency, minorDigits }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <p id="transaction-list-empty" className="text-base-content/70">
        {NO_TRANSACTIONS_TEXT}
      </p>
    );
  }
  return (
    <ul id="transaction-list" className="rounded-box border border-base-300 text-base">
      {transactions.map((transaction) => (
        <li
          key={transaction.id}
          id={`transaction-row-${transaction.id}`}
          data-transaction-row
          data-kind={transaction.kind}
          className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-base-300 p-4 not-last:border-b"
        >
          <span data-field="kind" className="col-start-1 row-start-1 text-sm font-semibold">
            {KIND_LABELS[transaction.kind]}
          </span>{' '}
          <span
            data-field="amount"
            className="col-start-2 row-span-2 row-start-1 text-lg font-semibold tabular-nums group-data-[kind=income]:text-success"
          >
            {formatMinor(transaction.amountMinor, currency, minorDigits)}
          </span>{' '}
          <time
            data-field="date"
            dateTime={transaction.occurredOn}
            className="col-start-1 row-start-2 text-sm tabular-nums text-base-content/70"
          >
            {transaction.occurredOn}
          </time>
          {transaction.note !== null ? (
            <>
              {' '}
              <span data-field="note" className="col-span-2 row-start-3 wrap-anywhere">
                {transaction.note}
              </span>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
