// @vitest-environment jsdom
import { BootstrapProvider } from "@gasboost/bootstrap/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../src/frontend/App";
import { rpc, storage, testAuth, user } from "./fixtures/auth";

vi.mock("../src/frontend/lib/auth", async () => ({
  auth: (await import("./fixtures/auth")).testAuth,
}));
const { initializeApp } = vi.hoisted(() => ({ initializeApp: vi.fn() }));
vi.mock("../src/frontend/lib/auth-rpc", () => ({ client: { initializeApp } }));
beforeEach(async () => {
  await testAuth.signOut();
  vi.clearAllMocks();
  storage.remove();
});
afterEach(cleanup);
function mount(initialized: boolean, route = "/") {
  render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={new QueryClient()}>
        <BootstrapProvider initialState={{ initialized }}>
          <App />
        </BootstrapProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
it("does not restore auth before bootstrap and reaches sign-in after initializing", async () => {
  initializeApp.mockResolvedValue({ initialized: true });
  mount(false, "/?token=setup-token");
  fireEvent.click(
    await screen.findByRole("button", { name: "初期設定を開始" }),
  );
  await screen.findByRole("button", { name: "Googleアカウントでログイン" });
  expect(initializeApp).toHaveBeenCalledWith({ token: "setup-token" });
  expect(rpc.getSession).not.toHaveBeenCalled();
});
it("redirects unauthenticated home to Apps Script sign-in without email pages", async () => {
  mount(true);
  await screen.findByRole("button", { name: "Googleアカウントでログイン" });
  expect(screen.queryByLabelText("パスワード")).toBeNull();
});
it("shows the authenticated account and supports sign-out", async () => {
  storage.set("session");
  rpc.getSession.mockResolvedValue({ id: "session", user: user() });
  mount(true, "/sign-in");
  fireEvent.click(await screen.findByRole("button", { name: "ログアウト" }));
  await screen.findByRole("button", { name: "Googleアカウントでログイン" });
});
it("offers recovery when restore fails instead of exposing protected routes", async () => {
  storage.set("session");
  rpc.getSession.mockRejectedValueOnce(new Error("offline"));
  mount(true, "/");
  fireEvent.click(await screen.findByRole("button", { name: "認証を再確認" }));
  await waitFor(() => expect(rpc.getSession).toHaveBeenCalledTimes(2));
});
it.each([true, false])(
  "reads the explicit bootstrap HTML contract (%s)",
  async (initialized) => {
    vi.resetModules();
    const data = document.createElement("script");
    data.type = "application/json";
    data.id = "bootstrap-data";
    data.textContent = JSON.stringify({
      initialized,
      privateToken: "not-public-state",
    });
    document.body.append(data);
    try {
      expect((await import("../src/frontend/lib/bootstrap")).bootstrap).toEqual(
        { initialized },
      );
    } finally {
      data.remove();
    }
  },
);
it("rejects missing bootstrap state instead of assuming initialization", async () => {
  vi.resetModules();
  await expect(import("../src/frontend/lib/bootstrap")).rejects.toThrow(
    "Missing bootstrap-data",
  );
});

it("signs in through the Apps Script RPC", async () => {
  mount(true);
  fireEvent.click(
    await screen.findByRole("button", { name: "Googleアカウントでログイン" }),
  );
  await screen.findByRole("button", { name: "ログアウト" });
  expect(rpc.signInAppsScript).toHaveBeenCalledWith({});
  expect(rpc.signInEmail).not.toHaveBeenCalled();
});
it("redirects an initialized bootstrap URL to sign-in", async () => {
  mount(true, "/bootstrap");
  await screen.findByRole("button", { name: "Googleアカウントでログイン" });
});
