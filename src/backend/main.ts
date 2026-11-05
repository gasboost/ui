import { AppsScript, type InferAppsScript } from "@gasboost/app";
import { handlers } from "@gasboost/auth-app";
import { auth } from "./lib/auth";

const app = new AppsScript().calls(handlers(auth));

export type AppType = InferAppsScript<typeof app>;
export default app;
