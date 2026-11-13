import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { zodResolver } from "@hookform/resolvers/zod";
import { AUTH_ERROR_CODES } from "@gasboost/auth/errors";
import { AppsScriptRpcError } from "@gasboost/client";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { routes } from "../../shared/routes";
import { auth } from "../lib/auth";

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください。")
    .pipe(z.email("メールアドレスの形式が正しくありません。")),
  password: z.string().min(1, "パスワードを入力してください。"),
});

type SignInFormValues = z.infer<typeof signInSchema>;

function getSignInErrorMessage(error: unknown): string {
  if (error instanceof AppsScriptRpcError) {
    switch (error.code) {
      case AUTH_ERROR_CODES.INVALID_CREDENTIALS:
        return "メールアドレスまたはパスワードが正しくありません。";

      case AUTH_ERROR_CODES.UNAUTHORIZED:
        return "認証に失敗しました。もう一度お試しください。";

      case AUTH_ERROR_CODES.FORBIDDEN:
        return "このアカウントにはアクセス権限がありません。";

      default:
        return "時間をおいて再試行してください。";
    }
  }

  return "予期しないエラーが発生しました。";
}

export function SignInPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    shouldUseNativeValidation: true,
  });

  const signIn = useMutation({
    mutationKey: ["auth", "signIn"],
    retry: false,
    mutationFn: ({ email, password }: SignInFormValues) =>
      auth.signIn({ email, password }),
    onSuccess: () => {
      navigate(routes.home, { replace: true });
    },
  });

  function onSubmit({ email, password }: SignInFormValues) {
    if (signIn.isPending) return;

    signIn.mutate({ email, password });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>ログイン</CardTitle>
      </CardHeader>

      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              {...register("email")}
              type="email"
              autoComplete="username"
              placeholder="name@example.com"
              required
              disabled={signIn.isPending}
            />
            {errors.email && (
              <p className="text-red-500 text-sm">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <PasswordInput
              id="password"
              {...register("password")}
              autoComplete="current-password"
              required
              disabled={signIn.isPending}
            />
            {errors.password && (
              <p className="text-red-500 text-sm">{errors.password.message}</p>
            )}
          </div>

          {signIn.isError && (
            <Alert variant="destructive">
              <AlertTitle>ログイン失敗</AlertTitle>
              <AlertDescription>
                {getSignInErrorMessage(signIn.error)}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={signIn.isPending || !isValid}
          >
            {signIn.isPending ? "ログイン中..." : "ログイン"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
