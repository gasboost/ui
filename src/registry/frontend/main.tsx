import { AppsScriptProvider, AppsScriptRouter } from "@gasboost/react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { client } from "./lib/appsscript";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <AppsScriptRouter>
    <HashRouter>
      <AppsScriptProvider client={client}>
        <App />
      </AppsScriptProvider>
    </HashRouter>
  </AppsScriptRouter>,
);
