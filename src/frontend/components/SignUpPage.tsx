import { PasswordInput } from "@/components/ui/PasswordInput";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { AUTH_ERROR_CODES } from "@gasboost/auth/errors";
import { AppsScriptRpcError } from "@gasboost/client";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { routes } from "../../shared/routes";
import { auth } from "../lib/auth";

const signUpSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "メールアドレスを入力してください。")
      .pipe(z.email("メールアドレスの形式が正しくありません。")),
    password: z.string().min(1, "パスワードを入力してください。"),
    name: z.string().trim().min(1, "名前を入力してください。"),
    confirmPassword: z
      .string()
      .min(1, "確認用のパスワードを入力してください。"),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "パスワードが一致しません。",
    path: ["confirmPassword"],
  });

type SignUpFormValues = z.infer<typeof signUpSchema>;

function getSignUpErrorMessage(error: unknown): string {
  if (error instanceof AppsScriptRpcError) {
    switch (error.code) {
      case AUTH_ERROR_CODES.REGISTRATION_FAILED:
        return "このメールアドレスで登録できない場合は、ログインをお試しください。";

      case AUTH_ERROR_CODES.FORBIDDEN:
        return "現在、新規アカウントの登録は許可されていません。";

      default:
        return "時間をおいて、もう一度お試しください。";
    }
  }

  return "予期しないエラーが発生しました。";
}

export function SignUpPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const signUp = useMutation({
    mutationKey: ["auth", "signUp"],
    retry: false,
    mutationFn: ({
      name,
      email,
      password,
    }: Omit<SignUpFormValues, "confirmPassword">) =>
      auth.signUp({ name, email, password }),
    onSuccess: () => {
      navigate(routes.home, { replace: true });
    },
  });

  function onSubmit({ name, email, password }: SignUpFormValues) {
    if (signUp.isPending) return;

    signUp.mutate({ name, email, password });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>アカウント登録</CardTitle>
      </CardHeader>

      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名前</Label>
            <Input
              id="name"
              {...register("name")}
              autoComplete="name"
              aria-invalid={!!errors.name}
              disabled={signUp.isPending}
            />
            {errors.name && (
              <p className="text-sm text-destructive" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              aria-invalid={!!errors.email}
              disabled={signUp.isPending}
            />
            {errors.email && (
              <p className="text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <PasswordInput
              id="password"
              {...register("password", { deps: ["confirmPassword"] })}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              disabled={signUp.isPending}
            />
            {errors.password && (
              <p className="text-sm text-destructive" role="alert">
                {errors.password.message}
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
              disabled={signUp.isPending}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {signUp.isError && (
            <Alert variant="destructive">
              <AlertTitle>アカウントを作成できませんでした</AlertTitle>
              <AlertDescription>
                {getSignUpErrorMessage(signUp.error)}
                {signUp.error instanceof AppsScriptRpcError &&
                  signUp.error.code ===
                    AUTH_ERROR_CODES.REGISTRATION_FAILED && (
                    <p className="mt-2">
                      <Link
                        to={routes.auth.signIn}
                        className="underline underline-offset-4"
                      >
                        ログインはこちら
                      </Link>
                    </p>
                  )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="mt-6 flex-col gap-3">
          <Button
            type="submit"
            className="w-full"
            disabled={!isValid || signUp.isPending}
          >
            {signUp.isPending ? "登録中..." : "アカウントを作成"}
          </Button>

          <p className="text-sm text-muted-foreground">
            すでにアカウントをお持ちですか？{" "}
            <Link
              to={routes.auth.signIn}
              className="text-primary underline underline-offset-4"
            >
              ログイン
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
