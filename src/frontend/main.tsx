import { BootstrapProvider } from "@gasboost/bootstrap/react";
import { AppsScriptProvider, AppsScriptRouter } from "@gasboost/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { BootstrapGuard } from "./components/Guard";
import { AuthProvider } from "./contexts/AuthContext";
import { client } from "./lib/appsscript";
import { bootstrap } from "./lib/bootstrap";
import { queryClient } from "./lib/query";
import "./style.css";

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
  <AppsScriptRouter>
    <HashRouter>
      <AppsScriptProvider client={client}>
        <QueryClientProvider client={queryClient}>
          <BootstrapProvider initialState={bootstrap}>
            <BootstrapGuard>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BootstrapGuard>
          </BootstrapProvider>
        </QueryClientProvider>
      </AppsScriptProvider>
    </HashRouter>
  </AppsScriptRouter>,
);
