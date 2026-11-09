import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { bootstrap } from "../../lib/bootstrap";
import { bootstrapMutations } from "./mutations";

type BootstrapPageProps = {
  onInitialized?: () => void;
};

export function BootstrapPage({ onInitialized }: BootstrapPageProps) {
  const [params] = useSearchParams();
  const token = params.get("token");

  const initialize = useMutation({
    ...bootstrapMutations.initialize(),
    onSuccess: () => {
      onInitialized?.();
    },
  });

  if (!bootstrap) {
    return (
      <Alert variant="destructive">
        <AlertTitle>初期状態を取得できません</AlertTitle>
        <AlertDescription>
          アプリケーションを再読み込みしてください。
        </AlertDescription>
      </Alert>
    );
  }

  if (bootstrap.initialized || initialize.isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>初期設定が完了しています</CardTitle>
          <CardDescription>
            アプリケーションは利用可能な状態です。
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Alert>
            <AlertTitle>初期化完了</AlertTitle>
            <AlertDescription>
              データベースの初期化と初期管理者の登録が完了しています。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>アプリケーションの初期設定</CardTitle>
        <CardDescription>
          初期管理者の登録とデータベースの初期化を行います。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {token ? (
          <p className="text-sm text-muted-foreground">
            初期設定リンクを確認しました。
            以下のボタンから初期設定を開始してください。
          </p>
        ) : (
          <Alert>
            <AlertTitle>メールをご確認ください</AlertTitle>
            <AlertDescription>
              デプロイ実行者に初期設定リンクを送信しています。
              メールに記載されたリンクからアクセスしてください。
            </AlertDescription>
          </Alert>
        )}

        {initialize.isError && (
          <Alert variant="destructive">
            <AlertTitle>初期設定に失敗しました</AlertTitle>
            <AlertDescription>{initialize.error.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>

      {token && (
        <CardFooter>
          <Button
            className="w-full"
            disabled={initialize.isPending}
            onClick={() => initialize.mutate(token)}
          >
            {initialize.isPending
              ? "初期設定中..."
              : initialize.isError
                ? "再試行"
                : "初期設定を開始"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
