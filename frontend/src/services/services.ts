import type { IAuthService } from './auth/auth.types';
import type { IWalletService } from './wallets/wallet.types';

/** Every service the screens may use. Provided once at the root (`ServiceProvider`) and read with `useServices()`. */
export interface Services {
  authService: IAuthService;
  walletService: IWalletService;
}
