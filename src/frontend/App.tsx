import { Outlet, Route, Routes } from "react-router-dom";
import { routes } from "../shared/routes";
import { AuthGuard, BootstrapGuard } from "./components/Guard";
import { AuthProvider } from "./contexts/AuthContext";
import { SignInPage } from "./components/SignInPage";
import { SignUpPage } from "./components/SignUpPage";
import { BootstrapPage } from "./components/BootstrapPage";

export default function App() {
  return (
    <Routes>
      <Route path={routes.system.bootstrap} element={<BootstrapPage />} />

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
