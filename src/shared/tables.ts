import { createAuthTables, createAuthorizationTables } from "@gasboost/auth";
import {} from "@gasboost/auth/authorization";

export const authTables = createAuthTables();
export const authorizationTables = createAuthorizationTables();

export const tables = [
  authTables.user,
  authTables.account,
  authTables.passwordReset,
  authorizationTables.role,
  authorizationTables.permission,
] as const;
