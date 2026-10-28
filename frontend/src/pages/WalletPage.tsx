import { useCallback, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageHeading } from '../components/PageHeading';
import { TransactionForm } from '../components/TransactionForm';
import { TransactionList } from '../components/TransactionList';
import { WalletBalance } from '../components/WalletBalance';
import { useAsyncValue, type AsyncValue } from '../hooks/use-async-value';
import { localToday } from '../money/local-today';
import { GENERIC_FAILURE_TEXT } from '../services/http/failure-messages';
import { ApiError } from '../services/http/api-error';
import { useServices } from '../services/ServiceContext';
import {
  describeWalletFailure,
  SAVED_BUT_NOT_REFRESHED_TEXT,
  WALLET_NOT_FOUND_TEXT,
} from '../services/wallets/wallet-messages';
import { toRecordTransactionRequest } from '../services/wallets/wallet-requests';
import type { Currency, TypedTransaction, WalletDetail } from '../services/wallets/wallet.types';

type WalletAndCurrencies = [Currency[], WalletDetail];

/**
 * Container: loads the Wallet (and the Currencies, whose digits its amounts need) for the id in the URL, then hands the
 * loaded Wallet to the screen that records Transactions in it. A Wallet that is not found, or not loaded, never shows
 * a Balance or a form.
 */
export function WalletPage() {
  const { walletId = '' } = useParams();
  const { walletService } = useServices();
  const load = useCallback(
    () => Promise.all([walletService.listCurrencies(), walletService.getWallet(walletId)]),
    [walletService, walletId],
  );
  const loaded = useAsyncValue(load);

  return <main id="wallet-page">{outcome(loaded)}</main>;
}

function outcome(loaded: AsyncValue<WalletAndCurrencies>): ReactNode {
  if (loaded.status === 'loading') {
    return (
      <>
        <BackToWalletsLink />
        <PageHeading>Wallet</PageHeading>
        <p role="status">Loading wallet…</p>
      </>
    );
  }
  if (loaded.status === 'failed') {
    const isNotFound = loaded.error instanceof ApiError && loaded.error.status === 404;
    return isNotFound ? (
      <Failure id="wallet-not-found" text={WALLET_NOT_FOUND_TEXT} />
    ) : (
      <Failure id="wallet-load-error" text={describeWalletFailure(loaded.error).join(' ')} />
    );
  }
  const [currencies, wallet] = loaded.value;
  const currency = currencies.find((candidate) => candidate.code === wallet.currency);
  // Without the Currency's digits an amount cannot be shown exactly; never assume 2.
  if (currency === undefined) return <Failure id="wallet-load-error" text={GENERIC_FAILURE_TEXT} />;
  return <WalletScreen initial={wallet} currency={currency} />;
}

/**
 * Container for a loaded Wallet: records Transactions in it. The Balance is the backend's to derive, so after a save the
 * Wallet is read again rather than worked out here.
 */
function WalletScreen({ initial, currency }: { initial: WalletDetail; currency: Currency }) {
  const { walletService } = useServices();
  const [wallet, setWallet] = useState(initial);
  const [isStale, setIsStale] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // Where the date field starts and the latest date it offers; the date sent as `today` is read again at each save.
  const [today] = useState(() => localToday());

  async function handleRecord(typed: TypedTransaction): Promise<boolean> {
    const parsed = toRecordTransactionRequest(typed, currency.minorDigits, localToday());
    if (!parsed.ok) {
      setErrors([parsed.error]);
      return false;
    }
    setErrors([]);
    setIsSubmitting(true);
    try {
      await walletService.recordTransaction(wallet.id, parsed.request);
    } catch (failure) {
      setErrors(describeWalletFailure(failure));
      setIsSubmitting(false);
      return false;
    }
    try {
      setWallet(await walletService.getWallet(wallet.id));
    } catch {
      setIsStale(true);
    }
    setIsSubmitting(false);
    return true;
  }

  if (isStale) {
    return (
      <Failure id="wallet-load-error" text={SAVED_BUT_NOT_REFRESHED_TEXT} heading={wallet.name} />
    );
  }
  return (
    <>
      <BackToWalletsLink />
      <PageHeading id="wallet-name-heading">{wallet.name}</PageHeading>
      <WalletBalance
        currency={wallet.currency}
        balanceMinor={wallet.balanceMinor}
        minorDigits={currency.minorDigits}
      />
      <section className="flex flex-col gap-4">
        <h2>Record income or expense</h2>
        <TransactionForm
          today={today}
          isSubmitting={isSubmitting}
          errors={errors}
          onSubmit={handleRecord}
        />
      </section>
      <section className="flex flex-col gap-4">
        <h2>Transactions</h2>
        <TransactionList
          transactions={wallet.transactions}
          currency={wallet.currency}
          minorDigits={currency.minorDigits}
        />
      </section>
    </>
  );
}

function Failure({ id, text, heading = 'Wallet' }: { id: string; text: string; heading?: string }) {
  return (
    <>
      <BackToWalletsLink />
      <PageHeading>{heading}</PageHeading>
      <ErrorAlert id={id}>{text}</ErrorAlert>
    </>
  );
}

function BackToWalletsLink() {
  return (
    <Link
      id="back-to-wallets-link"
      to="/"
      className="link inline-flex items-center gap-1 self-start py-2.5 font-semibold link-hover"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      Back to wallets
    </Link>
  );
}
