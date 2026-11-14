import { localStorageAuthStorage } from "@gasboost/auth-client";
import { authMetadataProvider } from "@gasboost/auth-client/appsscript";
import { withMetadataProviders } from "@gasboost/client";
import { client as rpcClient } from "./appsscript";

export const authStorage = localStorageAuthStorage();
export const client = withMetadataProviders(rpcClient, [
  authMetadataProvider(authStorage),
]);
export { jobs } from "./appsscript";
