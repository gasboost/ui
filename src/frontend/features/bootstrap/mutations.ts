import { BOOTSTRAP_ERROR_CODES } from "@gasboost/bootstrap/errors";
import { AppsScriptRpcError } from "@gasboost/client";
import { mutationOptions } from "@tanstack/react-query";
import { client } from "../../lib/appsscript";

function getBootstrapErrorMessage(error: unknown): string {
  if (error instanceof AppsScriptRpcError) {
    switch (error.code) {
      case BOOTSTRAP_ERROR_CODES.INVALID_TOKEN:
        return "初期設定リンクが無効です。最新のメールをご確認ください。";

      case BOOTSTRAP_ERROR_CODES.TOKEN_EXPIRED:
        return "初期設定リンクの有効期限が切れています。新しいリンクを取得してください。";

      case BOOTSTRAP_ERROR_CODES.ALREADY_INITIALIZED:
        return "アプリケーションはすでに初期化されています。";

      case BOOTSTRAP_ERROR_CODES.IN_PROGRESS:
        return "別の初期化処理が実行中です。時間をおいて再試行してください。";

      case BOOTSTRAP_ERROR_CODES.LOCKED:
        return "試行回数の上限に達しました。リンクの有効期限が切れてから再発行してください。";

      case BOOTSTRAP_ERROR_CODES.LINK_NOT_READY:
        return "初期設定リンクの送信が完了していません。時間をおいて、トークンなしのアプリURLから再試行してください。";

      default:
        return "初期設定に失敗しました。もう一度お試しください。";
    }
  }

  return "初期設定中に予期しないエラーが発生しました。";
}

export const bootstrapMutations = {
  initialize: () =>
    mutationOptions({
      mutationKey: ["bootstrap", "initialize"],
      retry: false,

      mutationFn: async (token: string) => {
        try {
          const result = await client.initializeApp({ token });

          if (!result.initialized) {
            throw new Error("Bootstrap returned an incomplete result");
          }

          return result;
        } catch (error) {
          throw new Error(getBootstrapErrorMessage(error), {
            cause: error,
          });
        }
      },
    }),
};
