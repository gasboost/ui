// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AuthGuard, PermissionGuard } from "../src/frontend/components/Guard";
import { UnauthorizedPage } from "../src/frontend/components/UnauthorizedPage";
import { ForbiddenPage } from "../src/frontend/components/ForbiddenPage";
import { AuthProvider } from "../src/frontend/contexts/AuthContext";
import { routes } from "../src/shared/routes";
import { rpc, storage, testAuth, user } from "./fixtures/auth";

vi.mock("../src/frontend/lib/auth", async () => ({
  auth: (await import("./fixtures/auth")).testAuth,
}));
vi.mock("../src/shared/policy", async () => {
  const { AuthorizationPolicy } = await import("@gasboost/auth/authorization");
  return { policy: new AuthorizationPolicy({ staff: ["read"] }) };
});

beforeEach(async () => {
  await testAuth.signOut();
  storage.remove();
  vi.clearAllMocks();
});
afterEach(cleanup);

for (const [name, guard] of [
  ["AuthGuard", <AuthGuard />],
  ["PermissionGuard", <PermissionGuard requirement={{ staff: ["read"] }} />],
] as const) {
  it(`${name} connects signed-out users to login guidance through consumer routes`, async () => {
    // The consumer chooses to show guidance at the existing sign-in route.
    const router = createMemoryRouter(
      [
        {
          element: guard,
          children: [{ path: "/protected", element: <div>Protected</div> }],
        },
        {
          path: routes.auth.signIn,
          element: <UnauthorizedPage signInTo="/login-form" />,
        },
        { path: "/login-form", element: <div>Login form</div> },
      ],
      { initialEntries: ["/protected"] },
    );
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "ログインが必要です" }),
    ).toBeTruthy();
    expect(router.state.historyAction).toBe("REPLACE");
    expect(screen.queryByText("Protected")).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "ログインへ" }));
    expect(await screen.findByText("Login form")).toBeTruthy();
    expect(rpc.getSession).not.toHaveBeenCalled();
    expect(rpc.signInEmail).not.toHaveBeenCalled();
  });
}

it("connects PermissionGuard to ForbiddenPage and follows the shared home route", async () => {
  storage.set("session");
  rpc.getSession.mockResolvedValueOnce({
    id: "session",
    user: user("bob", []),
  });
  const router = createMemoryRouter(
    [
      {
        element: <PermissionGuard requirement={{ staff: ["read"] }} />,
        children: [{ path: "/protected", element: <div>Protected</div> }],
      },
      { path: routes.system.forbidden, element: <ForbiddenPage /> },
      { path: routes.home, element: <div>Home page</div> },
    ],
    { initialEntries: ["/protected"] },
  );
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  expect(
    await screen.findByRole("heading", { name: "アクセス権限がありません" }),
  ).toBeTruthy();
  expect(router.state.location.pathname).toBe(routes.system.forbidden);
  expect(router.state.historyAction).toBe("REPLACE");
  expect(screen.queryByText("Protected")).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "ホームへ戻る" }));
  expect(await screen.findByText("Home page")).toBeTruthy();
  expect(rpc.getSession).toHaveBeenCalledTimes(1);
  expect(rpc.signOut).not.toHaveBeenCalled();
});

it("renders without auth providers or RPC and supports consumer copy and return destinations", async () => {
  const router = createMemoryRouter(
    [
      { path: "/unauthorized", element: <UnauthorizedPage /> },
      { path: routes.auth.signIn, element: <div>Login form</div> },
      {
        path: routes.system.forbidden,
        element: (
          <ForbiddenPage
            returnTo={{ pathname: "/help", search: "?from=denied" }}
            title="利用できません"
            description="管理者へお問い合わせください。"
            actionLabel="ヘルプへ"
          />
        ),
      },
      { path: "/help", element: <div>Help page</div> },
    ],
    { initialEntries: ["/unauthorized"] },
  );
  render(<RouterProvider router={router} />);
  expect(
    screen.getByRole("link", { name: "ログインへ" }).getAttribute("href"),
  ).toBe(routes.auth.signIn);
  fireEvent.click(screen.getByRole("link", { name: "ログインへ" }));
  expect(await screen.findByText("Login form")).toBeTruthy();
  await act(async () => router.navigate(routes.system.forbidden));
  expect(screen.getByRole("heading", { name: "利用できません" })).toBeTruthy();
  expect(screen.getByText("管理者へお問い合わせください。")).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "ヘルプへ" }));
  expect(await screen.findByText("Help page")).toBeTruthy();
  expect(router.state.location.search).toBe("?from=denied");
  for (const method of Object.values(rpc))
    expect(method).not.toHaveBeenCalled();
});
