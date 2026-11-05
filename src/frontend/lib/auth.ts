import { appsScriptAuth } from "@gasboost/auth-client/appsscript";
import { authStorage, client } from "./appsscript";

export const auth = appsScriptAuth({
  client,
  storage: authStorage,
});
