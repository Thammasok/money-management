import { Navigate, Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { RequireSignedIn, RequireSignedOut } from './session/route-guards';

// Three screens (artifacts/F-1/02-flow.md → Routing): Sign Up and Sign In for a Visitor, Home for a signed-in User;
// any other path goes Home (which sends a Visitor on to Sign In).
export function App() {
  return (
    <Routes>
      <Route element={<RequireSignedOut />}>
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
      </Route>
      <Route element={<RequireSignedIn />}>
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
