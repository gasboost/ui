/// <reference types="node" />
// @vitest-environment jsdom
import "fake-indexeddb/auto";
import process from "node:process";
import { Buffer } from "node:buffer";
import { createReplica } from "@gasboost/replica";
import { defineTable } from "@gasboost/table";
import { z } from "zod";
import { QueryClientProvider } from "@tanstack/react-query";
import { BootstrapProvider } from "@gasboost/bootstrap/react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { auth } from "../src/frontend/lib/auth";
import App from "../src/frontend/AppRealtime";
import { firebaseAuth } from "../src/frontend/lib/firebase";
import { queryClient } from "../src/frontend/lib/query";
import { useRtdb } from "../src/frontend/hooks/useRtdb";
import { customToken, rpc, storage } from "./fixtures/realtime-auth";

const enabled = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
vi.mock("../src/frontend/lib/auth-rpc", async () => {
  const fixture = await import("./fixtures/realtime-auth");
  return { client: fixture.rpc, authStorage: fixture.storage };
});
vi.mock("../src/frontend/lib/auth", async () => {
  // Load the shipped variant at runtime; consumer smoke compiles it at its target.
  const template = "../src/registry/frontend-auth-realtime/auth.ts";
  return import(template);
});
vi.mock("../src/frontend/lib/firebase", async () => {
  const { initializeApp } = await import("firebase/app");
  const { getAuth, connectAuthEmulator } = await import("firebase/auth");
  const { getDatabase, connectDatabaseEmulator } =
    await import("firebase/database");
  const app = initializeApp({
    apiKey: "fake-key",
    projectId: "demo-gasboost-ui",
    databaseURL: "https://demo-gasboost-ui-default-rtdb.firebaseio.com",
  });
  const firebaseAuth = getAuth(app);
  const firebaseDatabase = getDatabase(app);
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    connectAuthEmulator(
      firebaseAuth,
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,
      { disableWarnings: true },
    );
    const [host, port] =
      process.env.FIREBASE_DATABASE_EMULATOR_HOST!.split(":");
    connectDatabaseEmulator(firebaseDatabase, host, Number(port));
  }
  return { firebaseAuth, firebaseDatabase };
});
beforeEach(async () => {
  if (!enabled) return;
  await auth.signOut();
  vi.clearAllMocks();
  customToken.mockImplementation(() => token("gas-user"));
});
afterEach(async () => {
  cleanup();
  if (enabled) await auth.signOut();
  vi.restoreAllMocks();
});

// Emulator accepts unsigned custom JWTs. These never leave the local emulators.
function token(uid: string) {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part({ uid, aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, iss: "emulator@example.com", sub: "emulator@example.com" })}.`;
}

it.skipIf(!enabled)(
  "keeps the GAS screen accessible on failed external sync, then repairs a mismatched Firebase UID",
  async () => {
    const { signInWithCustomToken } = await import("firebase/auth");
    await signInWithCustomToken(firebaseAuth, token("other-user"));
    storage.set("gas-session");
    rpc.issueFirebaseCustomToken.mockRejectedValueOnce(new Error("offline"));
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <BootstrapProvider initialState={{ initialized: true }}>
            <App />
          </BootstrapProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: "ログアウト" });
    await waitFor(() => expect(report).toHaveBeenCalled());
    expect(auth.getState().isAuthenticated).toBe(true);
    expect(rpc.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeTruthy();
    const result = await auth.sync();
    expect(result.synchronized).toBe(true);
    expect(firebaseAuth.currentUser?.uid).toBe("gas-user");
  },
  20000,
);

it.skipIf(!enabled)(
  "uses afterSignIn and externalAuth.signOut while clearing the query cache",
  async () => {
    queryClient.setQueryData(["private"], "old-user");
    await auth.signInAppsScript();
    expect(firebaseAuth.currentUser?.uid).toBe("gas-user");
    expect(queryClient.getQueryData(["private"])).toBeUndefined();
    queryClient.setQueryData(["private"], "gas-user");
    await auth.signOut();
    expect(firebaseAuth.currentUser).toBeNull();
    expect(queryClient.getQueryData(["private"])).toBeUndefined();
  },
);

it.skipIf(!enabled)(
  "clears an external Firebase session when GAS has no session",
  async () => {
    const { signInWithCustomToken } = await import("firebase/auth");
    await signInWithCustomToken(firebaseAuth, token("other-user"));
    const result = await auth.sync();
    expect(result.session).toBeNull();
    expect(result.synchronized).toBe(true);
    expect(firebaseAuth.currentUser).toBeNull();
    expect(rpc.issueFirebaseCustomToken).not.toHaveBeenCalled();
  },
);

const tables = [
  defineTable({
    name: "fixture",
    schema: z.object({ id: z.string() }),
    primaryKey: "id",
  }),
] as const;
const queryKey = ["fixture-data"] as const;
function Feature() {
  const { error } = useRtdb({ tables, queryKey });
  return (
    <>
      <p>GAS feature</p>
      {error && <p role="status">通知を利用できません</p>}
    </>
  );
}
it.skipIf(!enabled)(
  "receives table notifications without using Firebase availability as a screen guard",
  async () => {
    await auth.signInAppsScript();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <QueryClientProvider client={queryClient}>
        <Feature />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey }));
    const count = invalidate.mock.calls.length;
    const response = await fetch(
      `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/syncVersions/fixture.json?ns=demo-gasboost-ui-default-rtdb`,
      {
        method: "PUT",
        headers: {
          Authorization: "Bearer owner",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(Date.now()),
      },
    );
    expect(response.ok).toBe(true);
    await waitFor(() =>
      expect(invalidate.mock.calls.length).toBeGreaterThan(count),
    );
    const { signOut } = await import("firebase/auth");
    await signOut(firebaseAuth);
    expect(auth.getState().isAuthenticated).toBe(true);
    expect(screen.getByText("GAS feature")).toBeTruthy();
  },
  20000,
);
it("supports current Replica full-sync API without shipping any business definitions", async () => {
  const table = defineTable({
    name: "fixture",
    schema: z.object({ id: z.string() }),
    primaryKey: "id",
  });
  const replica = createReplica({
    name: "ui-registry-test",
    tables: [table] as const,
  });
  await replica.sync("fixture", [{ id: "first" }]);
  expect(await replica.table("fixture").toArray()).toEqual([{ id: "first" }]);
  await replica.sync("fixture", []);
  expect(await replica.table("fixture").toArray()).toEqual([]);
});
