import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
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
import { client } from "../lib/auth-rpc";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください。")
    .pipe(z.email("メールアドレスの形式が正しくありません。")),
});
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const submitting = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { email: "" },
  });
  const forgot = useMutation({
    mutationKey: ["auth", "forgotPassword"],
    retry: false,
    mutationFn: ({ email }: FormValues) => client.forgotPassword({ email }),
    onSettled: () => {
      submitting.current = false;
    },
  });
  function onSubmit(input: FormValues) {
    if (submitting.current || forgot.isSuccess) return;
    submitting.current = true;
    forgot.mutate(input);
  }
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>パスワードの再発行</CardTitle>
      </CardHeader>
      {forgot.isSuccess ? (
        <CardContent>
          <p role="status">
            このメールアドレスが登録されている場合は、パスワード再設定の案内を送信しました。
          </p>
        </CardContent>
      ) : (
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                {...register("email")}
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                disabled={forgot.isPending}
              />
              {errors.email && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>
            {forgot.isError && (
              <Alert variant="destructive">
                <AlertTitle>案内を送信できませんでした</AlertTitle>
                <AlertDescription>
                  時間をおいて、もう一度お試しください。
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="mt-6">
            <Button
              type="submit"
              className="w-full"
              disabled={!isValid || forgot.isPending}
            >
              {forgot.isPending
                ? "送信中..."
                : forgot.isError
                  ? "再試行"
                  : "再設定の案内を送信"}
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
