// @vitest-environment jsdom
import { BootstrapProvider } from "@gasboost/bootstrap/react";
import { AppsScriptProvider, AppsScriptRouter } from "@gasboost/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { HashRouter, Link, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BootstrapGuard } from "../src/frontend/components/Guard";
import { AuthProvider } from "../src/frontend/contexts/AuthContext";
import { client } from "../src/frontend/lib/auth-rpc";
import { BootstrapPage } from "../src/frontend/components/BootstrapPage";
import { routes } from "../src/shared/routes";
import { rpc, storage, testAuth, user } from "./fixtures/auth";

const { initializeApp, getLocation } = vi.hoisted(() => {
  const getLocation = vi.fn();
  vi.stubGlobal("google", {
    script: {
      url: { getLocation },
      history: { setChangeHandler: vi.fn(), push: vi.fn() },
    },
  });
  return { initializeApp: vi.fn(), getLocation };
});

vi.mock("../src/frontend/lib/auth-rpc", () => ({
  client: { initializeApp },
}));
vi.mock("../src/frontend/lib/auth", async () => ({
  auth: (await import("./fixtures/auth")).testAuth,
}));

beforeEach(async () => {
  await testAuth.signOut();
  vi.clearAllMocks();
  initializeApp.mockReset();
  storage.set("session");
  rpc.getSession.mockResolvedValue({ id: "session", user: user() });
  window.history.replaceState({}, "", "/iframe");
  getLocation.mockImplementation((callback) => {
    // The GAS parent is /exec?token=setup-token; the iframe starts without it.
    callback({ hash: "", parameters: { token: ["setup-token"] } });
  });
});

afterEach(cleanup);

function mount(initialized = false) {
  const appMounted = vi.fn();
  function App() {
    appMounted();
    return <div>通常アプリ</div>;
  }
  render(
    <StrictMode>
      <AppsScriptRouter>
        <HashRouter>
          <AppsScriptProvider client={client}>
            <QueryClientProvider client={new QueryClient()}>
              <BootstrapProvider initialState={{ initialized }}>
                <Link to="/">通常アプリへ</Link>
                <Routes>
                  <Route
                    path={routes.system.bootstrap}
                    element={<BootstrapPage />}
                  />
                  <Route element={<BootstrapGuard />}>
                    <Route
                      element={
                        <AuthProvider>
                          <Outlet />
                        </AuthProvider>
                      }
                    >
                      <Route path="/" element={<App />} />
                    </Route>
                  </Route>
                </Routes>
              </BootstrapProvider>
            </QueryClientProvider>
          </AppsScriptProvider>
        </HashRouter>
      </AppsScriptRouter>
    </StrictMode>,
  );
  return appMounted;
}

it("shows the setup page without mounting auth or the app and preserves the GAS token", async () => {
  const appMounted = mount();
  expect(
    await screen.findByRole("button", { name: "初期設定を開始" }),
  ).toBeTruthy();
  expect(window.location.hash).toBe(
    `#${routes.system.bootstrap}?token=setup-token`,
  );
  expect(getLocation).toHaveBeenCalled();
  expect(appMounted).not.toHaveBeenCalled();
  expect(rpc.getSession).not.toHaveBeenCalled();
  expect(initializeApp).not.toHaveBeenCalled();
});

it("delivers the synchronized token to RPC and opens the guard only after success", async () => {
  let finish!: (value: { initialized: boolean }) => void;
  initializeApp.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const appMounted = mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "初期設定を開始" }),
  );
  await waitFor(() =>
    expect(initializeApp).toHaveBeenCalledExactlyOnceWith({
      token: "setup-token",
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true),
  );
  expect(appMounted).not.toHaveBeenCalled();
  expect(rpc.getSession).not.toHaveBeenCalled();
  finish({ initialized: true });
  expect(await screen.findByText("初期設定が完了しています")).toBeTruthy();
  expect(appMounted).not.toHaveBeenCalled();
  expect(rpc.getSession).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("link", { name: "通常アプリへ" }));
  expect(await screen.findByText("通常アプリ")).toBeTruthy();
  await waitFor(() => expect(rpc.getSession).toHaveBeenCalled());
});

it.each(["RPC failure", "incomplete result"])(
  "keeps the guard closed on %s and permits manual retry",
  async (failure) => {
    if (failure === "RPC failure")
      initializeApp.mockRejectedValueOnce(new Error("failed"));
    else initializeApp.mockResolvedValueOnce({ initialized: false });
    initializeApp.mockResolvedValueOnce({ initialized: true });
    const appMounted = mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "初期設定を開始" }),
    );
    const retry = await screen.findByRole("button", { name: "再試行" });
    expect(appMounted).not.toHaveBeenCalled();
    expect(rpc.getSession).not.toHaveBeenCalled();
    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe(
      `#${routes.system.bootstrap}?token=setup-token`,
    );
    fireEvent.click(retry);
    expect(await screen.findByText("初期設定が完了しています")).toBeTruthy();
    expect(appMounted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "通常アプリへ" }));
    expect(await screen.findByText("通常アプリ")).toBeTruthy();
    expect(initializeApp).toHaveBeenCalledTimes(2);
  },
);

it("shows an initialized app without a bootstrap RPC", async () => {
  mount(true);
  expect(await screen.findByText("通常アプリ")).toBeTruthy();
  expect(initializeApp).not.toHaveBeenCalled();
});
