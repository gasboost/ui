import { AppsScript, type InferAppsScript } from "@gasboost/app";
import { handlers } from "@gasboost/auth-app";
import { auth } from "./lib/auth";
import { bootstrap } from "./lib/bootstrap";
import { templateValue } from "./presentation/templateValue";

const app = new AppsScript()
  .get((request) => {
    const state = bootstrap.handle(request);
    const template = HtmlService.createTemplateFromFile("index");
    template.__BOOTSTRAP__ = templateValue(state);
    return template.evaluate().setTitle("");
  })

  .calls(bootstrap.handlers())

  .calls(handlers(auth));

export type AppType = InferAppsScript<typeof app>;
export default app;
