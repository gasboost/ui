import { Route, Routes } from "react-router-dom";
import { routes } from "../shared/routes";
import { BootstrapPage } from "./features/bootstrap/BootstrapPage";

export default function App() {
  return (
    <Routes>
      <Route path={routes.system.bootstrap} element={<BootstrapPage />} />
    </Routes>
  );
}
