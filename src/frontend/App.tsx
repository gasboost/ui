import { Outlet, Route, Routes } from "react-router-dom";
import { routes } from "../shared/routes";
import { BootstrapPage } from "./components/BootstrapPage";
import { ForbiddenPage } from "./components/ForbiddenPage";
import { AuthGuard, BootstrapGuard } from "./components/Guard";
import { SignInPage } from "./components/SignInPage";
import { SignUpPage } from "./components/SignUpPage";
import { UnauthorizedPage } from "./components/UnauthorizedPage";
import { AuthProvider } from "./contexts/AuthContext";

export default function App() {
  return (
    <Routes>
      <Route path={routes.system.bootstrap} element={<BootstrapPage />} />
      <Route path={routes.system.forbidden} element={<ForbiddenPage />} />
      <Route path={routes.system.unauthorized} element={<UnauthorizedPage />} />

      <Route element={<BootstrapGuard />}>
        <Route
          element={
            <AuthProvider>
              <Outlet />
            </AuthProvider>
          }
        >
          <Route path={routes.auth.signUp} element={<SignUpPage />} />
          <Route path={routes.auth.signIn} element={<SignInPage />} />

          <Route element={<AuthGuard />}>
            <Route path={routes.home} element={<></>} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
