import { Outlet, Route, Routes } from "react-router-dom";
import { routes } from "../shared/routes";
import { BootstrapGuard } from "./components/Guard";
import { AuthProvider } from "./contexts/AuthContext";
import { BootstrapPage } from "./features/bootstrap/BootstrapPage";

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
        ></Route>
      </Route>
    </Routes>
  );
}
