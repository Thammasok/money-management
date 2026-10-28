import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { NO_WALLETS_TEXT } from '../services/wallets/wallet-messages';
import type { WalletSummary } from '../services/wallets/wallet.types';
import type { WalletListProps } from './component-props';
import { ErrorAlert } from './ErrorAlert';

/**
 * Humble: Home's Wallets — loading, none yet, the list, or why it could not be loaded — and the way to make another.
 * Each row is found by `data-wallet-row` and its fields by `data-field`, the contract the E2E suite relies on.
 */
export function WalletList({ wallets, error }: WalletListProps) {
  return (
    <>
      {listing(wallets, error)}
      <Link id="create-wallet-link" to="/wallets/new" className="btn btn-primary btn-lg w-full">
        New wallet
      </Link>
    </>
  );
}

function listing(wallets: WalletSummary[] | null, error: string | null): ReactNode {
  if (error !== null) return <ErrorAlert id="wallet-list-error">{error}</ErrorAlert>;
  if (wallets === null) {
    return (
      <p role="status" className="text-base-content/70">
        Loading wallets…
      </p>
    );
  }
  if (wallets.length === 0) {
    return (
      <p id="wallet-list-empty" className="text-base-content/70">
        {NO_WALLETS_TEXT}
      </p>
    );
  }
  // A whole row is the tap target: the name's link is stretched over it (`after:absolute after:inset-0`), so the
  // Currency beside it opens the Wallet too, and a row stays one control for keyboard and screen reader alike.
  return (
    <ul id="wallet-list" className="list rounded-box border border-base-300 text-base">
      {wallets.map((wallet) => (
        <li
          key={wallet.id}
          id={`wallet-row-${wallet.id}`}
          data-wallet-row
          className="list-row items-center hover:bg-base-200 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-primary"
        >
          <Link
            data-field="name"
            to={`/wallets/${encodeURIComponent(wallet.id)}`}
            className="list-col-grow link font-semibold text-base-content link-hover after:absolute after:inset-0"
          >
            {wallet.name}
          </Link>{' '}
          <span
            data-field="currency"
            className="text-sm font-semibold tracking-wide text-base-content/70"
          >
            {wallet.currency}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5 text-base-content/70"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </li>
      ))}
    </ul>
  );
}
