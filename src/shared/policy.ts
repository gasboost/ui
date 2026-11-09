import { AuthorizationPolicy } from "@gasboost/auth/authorization";

export const roles = {
  admin: "admin",
  user: "user",
};

export const policy = new AuthorizationPolicy({});
