import { AppsScriptAuth, AppsScriptAuthorization } from "@gasboost/auth";
import {
  SheetOrmAuthRepository,
  SheetOrmAuthorizationRepository,
} from "@gasboost/auth-sheetorm";
import { signUpEnabled } from "../../shared/auth";
import { policy } from "../../shared/policy";
import { authTables, authorizationTables } from "../../shared/tables";
import { db } from "./db";

export const repository = new SheetOrmAuthRepository({
  db,
  schema: authTables.schema,
});

const pepper =
  PropertiesService.getScriptProperties().getProperty("AUTH_PEPPER");

export const auth = new AppsScriptAuth({
  repository,

  emailPassword: {
    enabled: true,
    isSignupEnabled: signUpEnabled.emailPassword,
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
    isSignupEnabled: signUpEnabled.appsScript,
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

  user: {
    data: async ({ user }) => ({
      permissions: await authorization.resolve(user.id),
    }),
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
