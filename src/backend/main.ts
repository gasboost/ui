import { AppsScript, type InferAppsScript } from "@gasboost/app";
import { authErrorHandler, handlers } from "@gasboost/auth-app";
import { auth } from "./lib/auth";
import { bootstrap } from "./lib/bootstrap";
import logErrors from "./presentation/logErrors";
import { templateValue } from "./presentation/templateValue";

const app = new AppsScript()
  .get((request) => {
    const state = bootstrap.handle(request);
    const template = HtmlService.createTemplateFromFile("index");
    template.__BOOTSTRAP__ = templateValue(state);
    return template.evaluate().setTitle("");
  })

  .use(logErrors)

  .calls(bootstrap.handlers())

  .use(authErrorHandler())
  .calls(handlers(auth));

export type AppType = InferAppsScript<typeof app>;
export default app;
