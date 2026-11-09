import { AppsScriptBootstrap } from "@gasboost/bootstrap";
import { roles } from "../../shared/policy";
import { auth, authorization, repository } from "./auth";
import { db } from "./db";

export const bootstrap = new AppsScriptBootstrap({
  db,
  auth,
  authRepository: repository,
  authorization,
  tokenTtlMinutes: 30,
  maxAttempts: 5,
  administrator: { name: "システム管理者", role: roles.admin },
});
