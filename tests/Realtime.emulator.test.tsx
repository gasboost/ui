/// <reference types="node" />
// @vitest-environment jsdom
import "fake-indexeddb/auto";
import process from "node:process";
import { Buffer } from "node:buffer";
import { createReplica } from "@gasboost/replica";
import { defineTable } from "@gasboost/table";
import { z } from "zod";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { RealtimeGuard } from "../src/frontend/components/RealtimeGuard";
import { firebaseAuth } from "../src/frontend/lib/firebase";
import { queryClient } from "../src/frontend/lib/query";

const enabled = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
vi.mock("../src/frontend/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "gas-user" },
    isLoading: false,
    isSessionRestoreFailed: false,
  }),
}));
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
afterEach(cleanup);

// Emulator accepts unsigned custom JWTs. These never leave the local emulators.
function token(uid: string) {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part({ uid, aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, iss: "emulator@example.com", sub: "emulator@example.com" })}.`;
}
it.skipIf(!enabled)(
  "synchronizes Firebase identity, receives version notifications and releases the session",
  async () => {
    const { signInWithCustomToken } = await import("firebase/auth");
    await signInWithCustomToken(firebaseAuth, token("other-user"));
    const issueCustomToken = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ customToken: token("gas-user") });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <MemoryRouter>
        <Routes>
          <Route
            element={<RealtimeGuard issueCustomToken={issueCustomToken} />}
          >
            <Route path="/" element={<p>protected content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "再試行" }));
    await screen.findByText("protected content");
    expect(firebaseAuth.currentUser?.uid).toBe("gas-user");
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    const count = invalidate.mock.calls.length;
    const response = await fetch(
      `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/syncVersions/test.json?ns=demo-gasboost-ui-default-rtdb`,
      {
        method: "PUT",
        headers: {
          Authorization: "Bearer owner",
          "Content-Type": "application/json",
        },
        body: "1",
      },
    );
    expect(response.ok).toBe(true);
    await waitFor(() =>
      expect(invalidate.mock.calls.length).toBeGreaterThan(count),
    );
    cleanup();
    await waitFor(() => expect(firebaseAuth.currentUser).toBeNull());
    invalidate.mockRestore();
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
