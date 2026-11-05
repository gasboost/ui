import { AppsScriptAuth, AppsScriptAuthorization } from "@gasboost/auth";
import {
  SheetOrmAuthRepository,
  SheetOrmAuthorizationRepository,
} from "@gasboost/auth-sheetorm";
import { policy } from "../../shared/authorization";
import { authTables, authorizationTables } from "../../shared/tables";
import { db } from "./db";

const repository = new SheetOrmAuthRepository({
  db,
  schema: authTables.schema,
});

const pepper =
  PropertiesService.getScriptProperties().getProperty("AUTH_PEPPER");

export const auth = new AppsScriptAuth({
  repository,

  emailPassword: {
    enabled: true,
    isSignupEnabled: true,
    pepper: pepper || "",
    passwordReset: {
      delivery: {
        async send({ email, token }: { email: string; token: string }) {
          MailApp.sendEmail({
            to: email,
            subject: "reset password",
            body: `reset token: ${token}`,
          });
        },
      },
    },
  },

  appsScript: {
    enabled: false,
    isSignupEnabled: false,
  },

  runtime: {
    cacheService: CacheService,
    propertiesService: PropertiesService,
    session: Session,
    utilities: Utilities,
  },

  session: {
    storageType: "cache",
  },
});

export type AuthType = typeof auth;

export const authorization = new AppsScriptAuthorization({
  policy,
  repository: new SheetOrmAuthorizationRepository({
    db,
    schema: authorizationTables.schema,
  }),
});
