import { localStorageAuthStorage } from "@gasboost/auth-client";
import { authMetadataProvider } from "@gasboost/auth-client/appsscript";
import { appsScriptClient } from "@gasboost/client";
import type { AppType } from "../../backend/main";

export const authStorage = localStorageAuthStorage();

export const { client, jobs } = appsScriptClient<AppType>({
  metadataProviders: [authMetadataProvider(authStorage)],
});
