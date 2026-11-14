// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TableDefinition } from "@gasboost/table";
import { useRtdb } from "../src/frontend/hooks/useRtdb";
import { AuthGuard } from "../src/frontend/components/Guard";

const sdk = vi.hoisted(() => ({
  auth: undefined as undefined | ((user: { uid: string } | null) => void),
  authUnsubscribe: vi.fn(),
  subscriptions: [] as Array<{
    path: string;
    receive: (snapshot: { val: () => unknown }) => void;
    fail: (error: Error) => void;
    unsubscribe: ReturnType<typeof vi.fn>;
  }>,
}));
vi.mock("../src/frontend/lib/firebase", () => ({
  firebaseAuth: {},
  firebaseDatabase: {},
}));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: typeof sdk.auth) => {
    sdk.auth = callback;
    return sdk.authUnsubscribe;
  },
}));
vi.mock("firebase/database", () => ({
  ref: (_db: unknown, path: string) => path,
  onValue: (
    path: string,
    receive: (typeof sdk.subscriptions)[number]["receive"],
    fail: (typeof sdk.subscriptions)[number]["fail"],
  ) => {
    const unsubscribe = vi.fn();
    sdk.subscriptions.push({ path, receive, fail, unsubscribe });
    return unsubscribe;
  },
}));
vi.mock("../src/frontend/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "gas-user" },
    isLoading: false,
    isSessionRestoreFailed: false,
  }),
}));
const tables = [{ name: "staff" }, { name: "products" }] as TableDefinition[];
const queryKey = ["inventory"] as const;
let queryClient: QueryClient;
let invalidate: ReturnType<typeof vi.spyOn>;
const rpc = vi.fn();
function Feature() {
  const { error } = useRtdb({ tables, queryKey });
  return (
    <>
      <p>GAS protected content</p>
      {error && <p role="status">通知を利用できません</p>}
      <button onClick={rpc}>GAS RPC</button>
    </>
  );
}
function mount() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path="/" element={<Feature />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  queryClient = new QueryClient();
  invalidate = vi.spyOn(queryClient, "invalidateQueries");
  sdk.subscriptions = [];
  sdk.authUnsubscribe.mockClear();
  rpc.mockClear();
});
afterEach(cleanup);
it("waits for Firebase authentication and subscribes to each table's version path", async () => {
  mount();
  expect(sdk.subscriptions).toHaveLength(0);
  sdk.auth?.({ uid: "gas-user" });
  expect(sdk.subscriptions.map((s) => s.path)).toEqual([
    "/syncVersions/staff",
    "/syncVersions/products",
  ]);
  sdk.subscriptions[0].receive({ val: () => 1 });
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey }));
  sdk.subscriptions[0].receive({ val: () => 1 });
  expect(invalidate).toHaveBeenCalledTimes(1);
  sdk.subscriptions[0].receive({ val: () => 2 });
  expect(invalidate).toHaveBeenCalledTimes(2);
});
it("keeps GAS protected content and RPC available while notifications are pending or denied", async () => {
  mount();
  sdk.auth?.({ uid: "gas-user" });
  expect(screen.getByText("GAS protected content")).toBeTruthy();
  sdk.subscriptions[0].fail(new Error("PERMISSION_DENIED"));
  await screen.findByRole("status");
  fireEvent.click(screen.getByRole("button", { name: "GAS RPC" }));
  expect(rpc).toHaveBeenCalledOnce();
  expect(screen.getByText("GAS protected content")).toBeTruthy();
});
it("releases subscriptions on sign-out and ignores callbacks from an old Firebase user", () => {
  const view = mount();
  sdk.auth?.({ uid: "first" });
  const old = [...sdk.subscriptions];
  sdk.auth?.({ uid: "second" });
  for (const subscription of old)
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
  old[0].receive({ val: () => 3 });
  expect(invalidate).not.toHaveBeenCalled();
  sdk.auth?.(null);
  for (const subscription of sdk.subscriptions)
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
  view.unmount();
  expect(sdk.authUnsubscribe).toHaveBeenCalledOnce();
});
it("releases all listeners on unmount without signing out Firebase", () => {
  const view = mount();
  sdk.auth?.({ uid: "gas-user" });
  view.unmount();
  expect(sdk.authUnsubscribe).toHaveBeenCalledOnce();
  for (const subscription of sdk.subscriptions) {
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    subscription.receive({ val: () => 1 });
  }
  expect(invalidate).not.toHaveBeenCalled();
});
