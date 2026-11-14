import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
} from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { Button } from "@/components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { firebaseAuth, firebaseDatabase } from "../lib/firebase";
import { queryClient } from "../lib/query";

// Serialize SDK operations so a disposed connection cannot sign out a newer one.
let operations: Promise<void> = Promise.resolve();
export function RealtimeGuard({
  issueCustomToken,
}: {
  issueCustomToken: () => Promise<{ customToken: string }>;
}) {
  const { user, isLoading, isSessionRestoreFailed } = useAuth();
  const [readyUser, setReadyUser] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const userId = !isLoading && !isSessionRestoreFailed ? user?.id : undefined;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let unsubscribeAuth: (() => void) | undefined;
    setFailed(false);
    async function connect() {
      await firebaseAuth.authStateReady();
      if (!active) return;
      if (firebaseAuth.currentUser?.uid !== userId) {
        const { customToken } = await issueCustomToken();
        if (!active) return;
        await signInWithCustomToken(firebaseAuth, customToken);
      }
      if (!active) return;
      if (firebaseAuth.currentUser?.uid !== userId)
        throw new Error("Firebase user mismatch");
      // Current RTDB API publishes versions, never application records.
      unsubscribe = onValue(
        ref(firebaseDatabase, "syncVersions"),
        () => {
          if (active) void queryClient.invalidateQueries();
        },
        () => {
          if (active) {
            setReadyUser(null);
            setFailed(true);
          }
        },
      );
      unsubscribeAuth = onAuthStateChanged(firebaseAuth, (current) => {
        if (active && current?.uid !== userId) {
          setReadyUser(null);
          setFailed(true);
          unsubscribe?.();
        }
      });
      setReadyUser(userId!);
    }
    operations = operations
      .catch(() => {})
      .then(connect)
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      unsubscribe?.();
      unsubscribeAuth?.();
      queryClient.clear();
      operations = operations
        .catch(() => {})
        .then(() => signOut(firebaseAuth))
        .catch(() => {});
    };
  }, [userId, attempt, issueCustomToken]);
  if (failed)
    return (
      <div role="alert">
        Realtimeに接続できませんでした。
        <Button
          onClick={() => {
            setReadyUser(null);
            setAttempt(attempt + 1);
          }}
        >
          再試行
        </Button>
      </div>
    );
  if (!userId || readyUser !== userId)
    return <p role="status">Realtimeに接続しています...</p>;
  return <Outlet />;
}
