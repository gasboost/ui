import { appsScriptAuth } from "@gasboost/auth-client/appsscript";
import { authStorage, client } from "./auth-rpc";

export const auth = appsScriptAuth({
  client,
  storage: authStorage,
});
