// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AUTH_ERROR_CODES } from "@gasboost/auth/errors";
import { AppsScriptRpcError } from "@gasboost/client";
import { AppsScriptRouter } from "@gasboost/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import {
  createMemoryRouter,
  RouterProvider,
  HashRouter,
  Routes,
  Route,
} from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ForgotPasswordPage } from "../src/frontend/components/ForgotPasswordPage";
import { ResetPasswordPage } from "../src/frontend/components/ResetPasswordPage";
import { routes } from "../src/shared/routes";

const { forgotPassword, resetPassword, getLocation } = vi.hoisted(() => {
  const getLocation = vi.fn();
  vi.stubGlobal("google", {
    script: {
      url: { getLocation },
      history: { setChangeHandler: vi.fn(), push: vi.fn() },
    },
  });
  return { forgotPassword: vi.fn(), resetPassword: vi.fn(), getLocation };
});
vi.mock("../src/frontend/lib/appsscript", () => ({
  client: { forgotPassword, resetPassword },
}));
beforeEach(() => {
  vi.resetAllMocks();
  forgotPassword.mockResolvedValue(null);
  resetPassword.mockResolvedValue(null);
  window.history.replaceState({}, "", "/iframe");
});
afterEach(() => {
  cleanup();
});

function mount(reset = false, search = "?token=private-token") {
  const router = createMemoryRouter(
    [
      {
        path: "/form",
        element: reset ? <ResetPasswordPage /> : <ForgotPasswordPage />,
      },
      { path: routes.auth.signIn, element: <div>Login destination</div> },
      { path: routes.auth.forgotPassword, element: <ForgotPasswordPage /> },
    ],
    { initialEntries: [`/form${reset ? search : ""}`] },
  );
  const view = render(
    <StrictMode>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { mutations: { retry: 3 } } })
        }
      >
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  return {
    router,
    form: view.container.querySelector("form")!,
    container: view.container,
  };
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
async function valid(reset: boolean) {
  if (reset) {
    fill("新しいパスワード", " secret ");
    fill("パスワード（確認）", " secret ");
  } else fill("メールアドレス", " alice@example.com ");
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: reset ? "パスワードを変更" : "再設定の案内を送信",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
}
it.each(["", "invalid-email"])(
  "rejects invalid forgot email: %s",
  async (email) => {
    const { form } = mount();
    fill("メールアドレス", email);
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(forgotPassword).not.toHaveBeenCalled();
  },
);
it.each(["registered@example.com", "unregistered@example.com"])(
  "uses the same neutral success for %s",
  async (email) => {
    mount();
    fill("メールアドレス", email);
    fireEvent.click(
      await screen.findByRole("button", { name: "再設定の案内を送信" }),
    );
    expect((await screen.findByRole("status")).textContent).toBe(
      "このメールアドレスが登録されている場合は、パスワード再設定の案内を送信しました。",
    );
    expect(forgotPassword).toHaveBeenCalledExactlyOnceWith({ email });
    fireEvent.click(screen.getByRole("link", { name: "ログインへ戻る" }));
    expect(await screen.findByText("Login destination")).toBeTruthy();
  },
);
it.each([false, true])(
  "prevents duplicate pending submissions and completes safely (reset: %s)",
  async (reset) => {
    let finish!: (value: null) => void;
    const rpc = reset ? resetPassword : forgotPassword;
    rpc.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { form, container, router } = mount(reset);
    await valid(reset);
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    const pending = await screen.findByRole("button", {
      name: reset ? "変更中..." : "送信中...",
    });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    for (const input of container.querySelectorAll("input"))
      expect(input.disabled).toBe(true);
    fireEvent.submit(form);
    await act(async () => {});
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      reset
        ? { token: "private-token", newPassword: " secret " }
        : { email: "alice@example.com" },
    );
    finish(null);
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(container.textContent).not.toContain("private-token");
    expect(router.state.location.pathname).toBe("/form");
    expect(container.querySelector("form")).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "ログインへ戻る" }));
    expect(await screen.findByText("Login destination")).toBeTruthy();
  },
);
it.each([false, true])(
  "shows safe RPC errors and retries only manually (reset: %s)",
  async (reset) => {
    const rpc = reset ? resetPassword : forgotPassword;
    rpc.mockRejectedValueOnce(
      new AppsScriptRpcError({
        code: "INTERNAL_ERROR",
        message: "private-token account details",
      }),
    );
    const { container } = mount(reset);
    await valid(reset);
    fireEvent.click(
      screen.getByRole("button", {
        name: reset ? "パスワードを変更" : "再設定の案内を送信",
      }),
    );
    const retry = await screen.findByRole("button", { name: "再試行" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("private-token");
    fireEvent.click(retry);
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(2);
  },
);
it.each(["", "?token=", "?token=%20%20"])(
  "blocks a missing token: %s",
  async (search) => {
    const { form } = mount(true, search);
    expect(
      screen.getByText(
        "再設定に必要な情報がありません。新しいリンクを取得してください。",
      ),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "パスワードを変更",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.submit(form);
    await act(async () => {});
    expect(resetPassword).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "再設定リンクを再発行" }));
    expect(await screen.findByText("パスワードの再発行")).toBeTruthy();
  },
);
it.each(["新しいパスワード", "パスワード（確認）"])(
  "validates passwords and revalidates when %s changes",
  async (label) => {
    const { form } = mount(true);
    fireEvent.submit(form);
    expect(
      await screen.findByText("新しいパスワードを入力してください。"),
    ).toBeTruthy();
    expect(
      screen.getByText("確認用のパスワードを入力してください。"),
    ).toBeTruthy();
    fill("新しいパスワード", "first");
    fill("パスワード（確認）", "second");
    fireEvent.submit(form);
    expect(await screen.findByText("パスワードが一致しません。")).toBeTruthy();
    expect(resetPassword).not.toHaveBeenCalled();
    fill(label, label === "新しいパスワード" ? "second" : "first");
    await waitFor(() =>
      expect(screen.queryByText("パスワードが一致しません。")).toBeNull(),
    );
    fireEvent.submit(form);
    expect(await screen.findByRole("status")).toBeTruthy();
  },
);
it.each(["invalid", "expired", "used"])(
  "offers reissue for %s reset tokens without exposing RPC details",
  async (reason) => {
    resetPassword.mockRejectedValue(
      new AppsScriptRpcError({
        code: AUTH_ERROR_CODES.INVALID_PASSWORD_RESET,
        message: `${reason}: private-token`,
      }),
    );
    const { form, container } = mount(true);
    await valid(true);
    fireEvent.submit(form);
    expect(
      await screen.findByText(
        "再設定リンクが無効か、有効期限が切れています。新しいリンクを取得してください。",
      ),
    ).toBeTruthy();
    expect(container.textContent).not.toContain("private-token");
    fireEvent.submit(form);
    await act(async () => {});
    expect(resetPassword).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("link", { name: "再設定リンクを再発行" }));
    expect(await screen.findByText("パスワードの再発行")).toBeTruthy();
  },
);
it("clears prior success and passwords when a different reset link opens", async () => {
  const { form, router } = mount(true);
  await valid(true);
  fireEvent.submit(form);
  expect(await screen.findByRole("status")).toBeTruthy();
  await act(async () => {
    await router.navigate("/form?token=next-token");
  });
  expect(screen.queryByRole("status")).toBeNull();
  expect(
    (screen.getByLabelText("新しいパスワード") as HTMLInputElement).value,
  ).toBe("");
});
it.each([
  { hash: "/reset-password", parameters: { token: ["gas-token"] } },
  { hash: "/reset-password?token=hash-token", parameters: {} },
])(
  "reads token via the existing GAS AppsScriptRouter + HashRouter: %j",
  async (location) => {
    vi.stubGlobal("google", {
      script: {
        url: { getLocation },
        history: { setChangeHandler: vi.fn(), push: vi.fn() },
      },
    });
    getLocation.mockImplementation((callback) => callback(location));
    render(
      <AppsScriptRouter>
        <HashRouter>
          <QueryClientProvider client={new QueryClient()}>
            <Routes>
              <Route
                path={routes.auth.resetPassword}
                element={<ResetPasswordPage />}
              />
            </Routes>
          </QueryClientProvider>
        </HashRouter>
      </AppsScriptRouter>,
    );
    await screen.findByText("パスワードの再設定");
    await valid(true);
    fireEvent.click(screen.getByRole("button", { name: "パスワードを変更" }));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(resetPassword).toHaveBeenCalledExactlyOnceWith({
      token: "token" in location.parameters ? "gas-token" : "hash-token",
      newPassword: " secret ",
    });
  },
);
