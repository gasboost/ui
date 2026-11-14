import { versionPath } from "@gasboost/realtime-firebase/client";
import type { TableDefinition } from "@gasboost/table";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { onAuthStateChanged } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseDatabase } from "../lib/firebase";

type Options = {
  tables: readonly TableDefinition[];
  queryKey: QueryKey;
};

// Notification availability is independent of GAS authentication and RPC access.
export function useRtdb({ tables, queryKey }: Options) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    let subscriptions: Array<() => void> = [];
    const clear = () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions = [];
    };
    const unsubscribeAuth = onAuthStateChanged(
      firebaseAuth,
      (user) => {
        const current = ++generation;
        clear();
        if (!active) return;
        setError(null);
        if (!user) return;
        subscriptions = tables.map((table) => {
          let lastVersion: unknown = Symbol("unseen");
          return onValue(
            ref(firebaseDatabase, versionPath(table)),
            (snapshot) => {
              if (!active || current !== generation) return;
              const version = snapshot.val();
              if (Object.is(lastVersion, version)) return;
              lastVersion = version;
              // Refetch on the first snapshot too, covering missed notifications.
              void queryClient.invalidateQueries({ queryKey });
            },
            (cause) => {
              if (active && current === generation) setError(cause);
            },
          );
        });
      },
      (cause) => {
        if (active) setError(cause);
      },
    );
    return () => {
      active = false;
      ++generation;
      unsubscribeAuth();
      clear();
    };
  }, [queryClient, tables, queryKey]);
  return { error };
}
