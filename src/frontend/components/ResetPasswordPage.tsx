import { PasswordInput } from "@/components/ui/PasswordInput";
import { AUTH_ERROR_CODES } from "@gasboost/auth/errors";
import { AppsScriptRpcError } from "@gasboost/client";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { routes } from "../../shared/routes";
import { client } from "../lib/appsscript";

const schema = z
  .object({
    newPassword: z.string().min(1, "新しいパスワードを入力してください。"),
    confirmPassword: z
      .string()
      .min(1, "確認用のパスワードを入力してください。"),
  })
  .refine(
    ({ newPassword, confirmPassword }) => newPassword === confirmPassword,
    {
      message: "パスワードが一致しません。",
      path: ["confirmPassword"],
    },
  );
type FormValues = z.infer<typeof schema>;

function getResetErrorMessage(error: unknown) {
  if (
    error instanceof AppsScriptRpcError &&
    error.code === AUTH_ERROR_CODES.INVALID_PASSWORD_RESET
  ) {
    return "再設定リンクが無効か、有効期限が切れています。新しいリンクを取得してください。";
  }
  return "パスワードを変更できませんでした。時間をおいて、もう一度お試しください。";
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  // A different link must not inherit a previous link's mutation or form state.
  return <ResetPasswordForm key={token} token={token} />;
}

function ResetPasswordForm({ token }: { token: string }) {
  const submitting = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { newPassword: "", confirmPassword: "" },
  });
  const reset = useMutation({
    mutationKey: ["auth", "resetPassword"],
    retry: false,
    mutationFn: ({ newPassword }: Pick<FormValues, "newPassword">) =>
      client.resetPassword({ token, newPassword }),
    onSettled: () => {
      submitting.current = false;
    },
  });
  const invalidToken =
    reset.isError &&
    reset.error instanceof AppsScriptRpcError &&
    reset.error.code === AUTH_ERROR_CODES.INVALID_PASSWORD_RESET;
  function onSubmit({ newPassword }: FormValues) {
    if (!token.trim() || submitting.current || reset.isSuccess || invalidToken)
      return;
    submitting.current = true;
    reset.mutate({ newPassword });
  }
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>パスワードの再設定</CardTitle>
      </CardHeader>
      {reset.isSuccess ? (
        <CardContent>
          <p role="status">
            パスワードを変更しました。新しいパスワードでログインしてください。
          </p>
        </CardContent>
      ) : (
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {!token.trim() && (
              <Alert variant="destructive">
                <AlertTitle>再設定リンクをご確認ください</AlertTitle>
                <AlertDescription>
                  再設定に必要な情報がありません。新しいリンクを取得してください。
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">新しいパスワード</Label>
              <PasswordInput
                id="newPassword"
                {...register("newPassword", { deps: ["confirmPassword"] })}
                autoComplete="new-password"
                aria-invalid={!!errors.newPassword}
                disabled={!token.trim() || reset.isPending || invalidToken}
              />
              {errors.newPassword && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">パスワード（確認）</Label>
              <PasswordInput
                id="confirmPassword"
                {...register("confirmPassword")}
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                disabled={!token.trim() || reset.isPending || invalidToken}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
            {reset.isError && (
              <Alert variant="destructive">
                <AlertTitle>再設定できませんでした</AlertTitle>
                <AlertDescription>
                  {getResetErrorMessage(reset.error)}
                </AlertDescription>
              </Alert>
            )}
            <Link
              to={routes.auth.forgotPassword}
              className="text-primary underline underline-offset-4"
            >
              再設定リンクを再発行
            </Link>
          </CardContent>
          <CardFooter className="mt-6">
            <Button
              type="submit"
              className="w-full"
              disabled={
                !token.trim() || !isValid || reset.isPending || invalidToken
              }
            >
              {reset.isPending
                ? "変更中..."
                : reset.isError
                  ? "再試行"
                  : "パスワードを変更"}
            </Button>
          </CardFooter>
        </form>
      )}
      <CardFooter className="mt-6">
        <Link
          to={routes.auth.signIn}
          className="text-primary underline underline-offset-4"
        >
          ログインへ戻る
        </Link>
      </CardFooter>
    </Card>
  );
}
