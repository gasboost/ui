import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "../../shared/routes";
import { useAuth } from "../contexts/AuthContext";

export function AppsScriptSignInPage() {
  const {
    user,
    isLoading,
    isSessionRestoreFailed,
    signInAppsScript,
    restoreSession,
  } = useAuth();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  if (isLoading) return <p role="status">認証を確認しています...</p>;
  if (user && !isSessionRestoreFailed)
    return <Navigate to={routes.home} replace />;

  async function signIn() {
    setPending(true);
    setFailed(false);
    try {
      if (isSessionRestoreFailed) await restoreSession();
      else await signInAppsScript();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>ログイン</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>Apps Scriptで利用中のGoogleアカウントでログインします。</p>
        {(failed || isSessionRestoreFailed) && (
          <p role="alert">
            認証を確認できませんでした。再試行してください。アカウントが未登録の場合は管理者にお問い合わせください。
          </p>
        )}
        <Button disabled={pending} onClick={() => void signIn()}>
          {isSessionRestoreFailed
            ? "認証を再確認"
            : pending
              ? "ログイン中..."
              : "Googleアカウントでログイン"}
        </Button>
      </CardContent>
    </Card>
  );
}
