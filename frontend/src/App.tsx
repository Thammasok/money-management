import { Navigate, Route, Routes } from 'react-router';
import { CreateWalletPage } from './pages/CreateWalletPage';
import { HomePage } from './pages/HomePage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { WalletPage } from './pages/WalletPage';
import { RequireSignedIn, RequireSignedOut } from './session/route-guards';

// The screens (artifacts/F-1/02-flow.md and artifacts/F-2/02-flow.md → Routing): Sign Up and Sign In for a Visitor;
// Home, Create Wallet and a Wallet for a signed-in User (`/wallets/new` is a static segment, so it wins over
// `/wallets/:walletId`); any other path goes Home (which sends a Visitor on to Sign In).
export function App() {
  return (
    <Routes>
      <Route element={<RequireSignedOut />}>
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
      </Route>
      <Route element={<RequireSignedIn />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/wallets/new" element={<CreateWalletPage />} />
        <Route path="/wallets/:walletId" element={<WalletPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
