import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CreateWalletForm } from '../components/CreateWalletForm';
import { PageHeading } from '../components/PageHeading';
import { useAsyncValue } from '../hooks/use-async-value';
import { useServices } from '../services/ServiceContext';
import { defaultCurrencyFor } from '../services/wallets/default-currency';
import { describeWalletFailure } from '../services/wallets/wallet-messages';
import { toCreateWalletRequest } from '../services/wallets/wallet-requests';
import type { Currency, TypedWallet } from '../services/wallets/wallet.types';

const NO_CURRENCIES: Currency[] = [];

/**
 * Container: loads the Currencies for the picker and the Wallets for its default (Q-11), turns what was typed into a
 * request, and — when the Wallet is made — goes to it. Nothing is sent for what the Web App cannot read.
 */
export function CreateWalletPage() {
  const { walletService } = useServices();
  const navigate = useNavigate();
  const load = useCallback(
    () => Promise.all([walletService.listCurrencies(), walletService.listWallets()]),
    [walletService],
  );
  const loaded = useAsyncValue(load);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);

  const currencies = loaded.status === 'loaded' ? loaded.value[0] : NO_CURRENCIES;
  const defaultCurrency =
    loaded.status === 'loaded' ? defaultCurrencyFor(loaded.value[1], currencies) : '';
  const errors = loaded.status === 'failed' ? describeWalletFailure(loaded.error) : submitErrors;

  async function handleSubmit(typed: TypedWallet) {
    const parsed = toCreateWalletRequest(typed, currencies);
    if (!parsed.ok) {
      setSubmitErrors([parsed.error]);
      return;
    }
    setSubmitErrors([]);
    setIsSubmitting(true);
    try {
      const wallet = await walletService.createWallet(parsed.request);
      // Replace this screen in the history, so Back from the new Wallet does not return to an empty form. The button
      // stays disabled: this screen is about to go.
      navigate(`/wallets/${encodeURIComponent(wallet.id)}`, { replace: true });
    } catch (failure) {
      setSubmitErrors(describeWalletFailure(failure));
      setIsSubmitting(false);
    }
  }

  return (
    <main id="create-wallet-page">
      <PageHeading>New wallet</PageHeading>
      <CreateWalletForm
        currencies={currencies}
        defaultCurrency={defaultCurrency}
        isReady={loaded.status === 'loaded'}
        isSubmitting={isSubmitting}
        errors={errors}
        onSubmit={handleSubmit}
      />
      <Link id="cancel-create-wallet-link" to="/" className="btn btn-outline btn-lg w-full">
        Cancel
      </Link>
    </main>
  );
}
