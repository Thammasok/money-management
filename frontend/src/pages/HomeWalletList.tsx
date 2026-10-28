import { useCallback } from 'react';
import { WalletList } from '../components/WalletList';
import { useAsyncValue } from '../hooks/use-async-value';
import { useServices } from '../services/ServiceContext';
import { describeWalletFailure } from '../services/wallets/wallet-messages';

/** Container: asks `WalletService` for the User's Wallets and hands them — loading, loaded or failed — to the humble list. */
export function HomeWalletList() {
  const { walletService } = useServices();
  const load = useCallback(() => walletService.listWallets(), [walletService]);
  const wallets = useAsyncValue(load);

  return (
    <section className="flex flex-col gap-4">
      <h2>Wallets</h2>
      <WalletList
        wallets={wallets.status === 'loaded' ? wallets.value : null}
        error={wallets.status === 'failed' ? describeWalletFailure(wallets.error).join(' ') : null}
      />
    </section>
  );
}
