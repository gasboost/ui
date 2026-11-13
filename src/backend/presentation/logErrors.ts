import type { AppsScriptMiddleware } from "@gasboost/app";

const logErrors: AppsScriptMiddleware = async (_, next) => {
  try {
    return await next();
  } catch (error) {
    console.error("[RPC Error]", error);
    throw error;
  }
};

export default logErrors;
