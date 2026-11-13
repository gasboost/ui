// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AUTH_ERROR_CODES } from "@gasboost/auth/errors";
import { AppsScriptRpcError } from "@gasboost/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SignInPage } from "../src/frontend/components/SignInPage";
import { SignUpPage } from "../src/frontend/components/SignUpPage";
import { routes } from "../src/shared/routes";

const { signIn, signUp } = vi.hoisted(() => ({
  signIn: vi.fn(async (_input: { email: string; password: string }) => null),
  signUp: vi.fn(
    async (_input: { name: string; email: string; password: string }) => null,
  ),
}));

vi.mock("../src/frontend/lib/auth", () => ({
  auth: { signIn, signUp },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function mount(isSignUp = false) {
  const router = createMemoryRouter(
    [
      { path: "/form", element: isSignUp ? <SignUpPage /> : <SignInPage /> },
      { path: routes.home, element: <div>Home</div> },
    ],
    { initialEntries: ["/form"] },
  );
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, form: container.querySelector("form")! };
}

function fill(label: string, value: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  return input;
}

it("submits registered sign-in values and navigates home", async () => {
  const { router, form } = mount();
  fill("メールアドレス", " alice@example.com ");
  fill("パスワード", " secret ");
  fireEvent.submit(form);
  await waitFor(() =>
    expect(signIn).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: " secret ",
    }),
  );
  await waitFor(() => expect(router.state.location.pathname).toBe(routes.home));
});

it.each([false, true])(
  "rejects empty required fields (signup: %s)",
  async (isSignUp) => {
    const { form } = mount(isSignUp);
    fireEvent.submit(form);
    const input = screen.getByLabelText(
      isSignUp ? "名前" : "メールアドレス",
    ) as HTMLInputElement;
    await waitFor(() =>
      isSignUp
        ? expect(screen.getByText("名前を入力してください。")).toBeTruthy()
        : expect(input.validationMessage).toContain("入力してください。"),
    );
    expect(signIn).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  },
);

it.each(["パスワード", "パスワード（確認）"])(
  "revalidates mismatched passwords when %s changes",
  async (label) => {
    const { form, router } = mount(true);
    fill("名前", " Alice ");
    fill("メールアドレス", "alice@example.com");
    fill("パスワード", "secret");
    fill("パスワード（確認）", "different");
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByText("パスワードが一致しません。")).toBeTruthy(),
    );
    expect(signUp).not.toHaveBeenCalled();

    const password = label === "パスワード" ? "different" : "secret";
    fill(label, password);
    await waitFor(() =>
      expect(screen.queryByText("パスワードが一致しません。")).toBeNull(),
    );
    fireEvent.submit(form);
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        name: "Alice",
        email: "alice@example.com",
        password,
      }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(routes.home),
    );
  },
);

it.each([false, true])(
  "rejects invalid email addresses through the schema (signup: %s)",
  async (isSignUp) => {
    const { form } = mount(isSignUp);
    if (isSignUp) {
      fill("名前", "Alice");
      fill("パスワード（確認）", "secret");
    }
    const email = fill("メールアドレス", "invalid-email");
    fill("パスワード", "secret");
    fireEvent.submit(form);
    await waitFor(() =>
      isSignUp
        ? expect(
            screen.getByText("メールアドレスの形式が正しくありません。"),
          ).toBeTruthy()
        : expect(email.validationMessage).toBe(
            "メールアドレスの形式が正しくありません。",
          ),
    );
    expect(signIn).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  },
);

it("rejects a whitespace-only name after trimming", async () => {
  const { form } = mount(true);
  fill("名前", "   ");
  fill("メールアドレス", "alice@example.com");
  fill("パスワード", "secret");
  fill("パスワード（確認）", "secret");
  fireEvent.submit(form);
  await waitFor(() =>
    expect(screen.getByText("名前を入力してください。")).toBeTruthy(),
  );
  expect(signUp).not.toHaveBeenCalled();
});

it.each([
  [
    false,
    AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    "メールアドレスまたはパスワードが正しくありません。",
  ],
  [
    false,
    AUTH_ERROR_CODES.UNAUTHORIZED,
    "認証に失敗しました。もう一度お試しください。",
  ],
  [
    false,
    AUTH_ERROR_CODES.FORBIDDEN,
    "このアカウントにはアクセス権限がありません。",
  ],
  [
    true,
    AUTH_ERROR_CODES.REGISTRATION_FAILED,
    "このメールアドレスで登録できない場合は、ログインをお試しください。",
  ],
  [
    true,
    AUTH_ERROR_CODES.FORBIDDEN,
    "現在、新規アカウントの登録は許可されていません。",
  ],
])(
  "shows RPC error %s / %s without navigating or retrying automatically",
  async (isSignUp, code, message) => {
    const request = isSignUp ? signUp : signIn;
    request.mockRejectedValueOnce(
      new AppsScriptRpcError({ code, message: "internal details" }),
    );
    const { form, router } = mount(isSignUp);
    if (isSignUp) {
      fill("名前", "Alice");
      fill("パスワード（確認）", "secret");
    }
    fill("メールアドレス", "alice@example.com");
    fill("パスワード", "secret");
    fireEvent.submit(form);
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByText("internal details")).toBeNull();
    expect(router.state.location.pathname).toBe("/form");
    expect(request).toHaveBeenCalledTimes(1);
    if (code === AUTH_ERROR_CODES.REGISTRATION_FAILED) {
      expect(
        screen
          .getByRole("link", { name: "ログインはこちら" })
          .getAttribute("href"),
      ).toBe(routes.auth.signIn);
    }
  },
);

it.each([false, true])(
  "handles unexpected failures and allows manual retry (signup: %s)",
  async (isSignUp) => {
    const request = isSignUp ? signUp : signIn;
    request.mockRejectedValueOnce(new Error("internal details"));
    const { form, router } = mount(isSignUp);
    if (isSignUp) {
      fill("名前", "Alice");
      fill("パスワード（確認）", "secret");
    }
    fill("メールアドレス", "alice@example.com");
    fill("パスワード", "secret");
    fireEvent.submit(form);
    expect(
      await screen.findByText("予期しないエラーが発生しました。"),
    ).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe("/form");
    fireEvent.submit(form);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(routes.home),
    );
    expect(request).toHaveBeenCalledTimes(2);
  },
);
