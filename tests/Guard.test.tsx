// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthGuard, PermissionGuard } from "../src/frontend/components/Guard";
import { AuthProvider, useAuth } from "../src/frontend/contexts/AuthContext";
import { routes } from "../src/shared/routes";
import { rpc, storage, testAuth, user } from "./fixtures/auth";

vi.mock("../src/frontend/lib/auth", async () => ({
  auth: (await import("./fixtures/auth")).testAuth,
}));
vi.mock("../src/shared/policy", async () => {
  const { AuthorizationPolicy } = await import("@gasboost/auth/authorization");
  return { policy: new AuthorizationPolicy({ staff: ["read", "create"] }) };
});

function AuthStatus() {
  const { isLoading, isSessionRestoreFailed } = useAuth();
  return (
    <output data-testid="auth-status">
      {isLoading ? "loading" : isSessionRestoreFailed ? "failed" : "ready"}
    </output>
  );
}

function mount(guard: (children: ReactNode) => ReactNode) {
  const router = createMemoryRouter(
    [
      { path: "/protected", element: guard(<div>Protected content</div>) },
      { path: routes.auth.signIn, element: <div>Login page</div> },
      { path: routes.system.forbidden, element: <div>Forbidden page</div> },
      { path: "/before", element: <div>Previous page</div> },
    ],
    { initialEntries: ["/before", "/protected"], initialIndex: 1 },
  );
  render(
    <AuthProvider>
      <AuthStatus />
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}

beforeEach(async () => {
  await testAuth.signOut();
  vi.clearAllMocks();
  storage.set("session");
  rpc.getSession.mockImplementation(async () => ({
    id: "session",
    user: user(),
  }));
});
afterEach(cleanup);

const guards = {
  AuthGuard: (children: ReactNode) => <AuthGuard>{children}</AuthGuard>,
  PermissionGuard: (children: ReactNode) => (
    <PermissionGuard requirement={{ staff: ["read"] }}>
      {children}
    </PermissionGuard>
  ),
};

for (const [name, guard] of Object.entries(guards)) {
  describe(name, () => {
    it("hides children and does not navigate during restoration", async () => {
      let complete!: (value: {
        id: string;
        user: ReturnType<typeof user>;
      }) => void;
      rpc.getSession.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
      const router = mount(guard);
      expect(screen.queryByText("Protected content")).toBeNull();
      expect(router.state.location.pathname).toBe("/protected");
      await act(async () => complete({ id: "session", user: user() }));
      expect(await screen.findByText("Protected content")).toBeTruthy();
      expect(rpc.getSession).toHaveBeenCalledTimes(1);
    });

    it("hides an existing authenticated user while restoring a session", async () => {
      await testAuth.signIn({
        email: "alice@example.com",
        password: "password",
      });
      let complete!: (value: {
        id: string;
        user: ReturnType<typeof user>;
      }) => void;
      rpc.getSession.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
      const router = mount(guard);
      expect(testAuth.getUser()?.id).toBe("alice");
      expect(screen.queryByText("Protected content")).toBeNull();
      expect(router.state.location.pathname).toBe("/protected");
      await act(async () => complete({ id: "session", user: user() }));
      expect(await screen.findByText("Protected content")).toBeTruthy();
    });

    it("replaces the protected location with the shared login route when signed out", async () => {
      storage.remove();
      const router = mount(guard);
      expect(await screen.findByText("Login page")).toBeTruthy();
      expect(router.state.historyAction).toBe("REPLACE");
      expect(rpc.getSession).not.toHaveBeenCalled();
      await act(async () => router.navigate(-1));
      expect(await screen.findByText("Previous page")).toBeTruthy();
    });

    it("shows authenticated children then redirects after signOut", async () => {
      mount(guard);
      expect(await screen.findByText("Protected content")).toBeTruthy();
      await act(async () => {
        await testAuth.signOut();
      });
      expect(await screen.findByText("Login page")).toBeTruthy();
      expect(screen.queryByText("Protected content")).toBeNull();
    });

    it("fails closed when restoration fails", async () => {
      rpc.getSession.mockRejectedValueOnce(new Error("Session expired"));
      const router = mount(guard);
      expect(await screen.findByText("failed")).toBeTruthy();
      expect(screen.queryByText("Protected content")).toBeNull();
      expect(router.state.location.pathname).toBe("/protected");
    });

    it("does not expose a retained user or permissions after restoration rejects", async () => {
      await testAuth.signIn({
        email: "alice@example.com",
        password: "password",
      });
      const previousUser = testAuth.getUser();
      const previousToken = testAuth.getToken();
      rpc.getSession.mockRejectedValueOnce(
        new Error("Restoration unavailable"),
      );
      const router = mount(guard);
      expect(screen.queryByText("Protected content")).toBeNull();
      expect(await screen.findByText("failed")).toBeTruthy();
      expect(testAuth.getUser()).toBe(previousUser);
      expect(testAuth.getUser()?.data.permissions).toEqual(["staff:read"]);
      expect(testAuth.getToken()).toBe(previousToken);
      expect(screen.queryByText("Protected content")).toBeNull();
      expect(router.state.location.pathname).toBe("/protected");
    });
  });
}

it("denies insufficient permissions synchronously and replaces the location", async () => {
  rpc.getSession.mockResolvedValueOnce({
    id: "session",
    user: user("bob", []),
  });
  const router = mount(guards.PermissionGuard);
  expect(await screen.findByText("Forbidden page")).toBeTruthy();
  expect(screen.queryByText("Protected content")).toBeNull();
  expect(router.state.historyAction).toBe("REPLACE");
  expect(rpc.getSession).toHaveBeenCalledTimes(1);
  expect(rpc.signInEmail).not.toHaveBeenCalled();
});

it("rechecks permissions after switching to a different user", async () => {
  mount(guards.PermissionGuard);
  expect(await screen.findByText("Protected content")).toBeTruthy();
  rpc.signInEmail.mockResolvedValueOnce({
    user: user("bob", []),
    session: { id: "bob-session" },
  });
  await act(async () => {
    await testAuth.signIn({ email: "bob@example.com", password: "password" });
  });
  expect(await screen.findByText("Forbidden page")).toBeTruthy();
  expect(testAuth.getUser()?.id).toBe("bob");
  expect(rpc.getSession).toHaveBeenCalledTimes(1);
});

it("uses customized routes for both redirects", async () => {
  const original = {
    login: routes.auth.signIn,
    forbidden: routes.system.forbidden,
  };
  // Simulate a consumer editing the shared routes module.
  Object.assign(routes.auth, { signIn: "/custom-login" });
  Object.assign(routes.system, { forbidden: "/custom-forbidden" });
  try {
    storage.remove();
    const router = mount(guards.AuthGuard);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/custom-login"),
    );
    cleanup();
    storage.set("session");
    rpc.getSession.mockResolvedValueOnce({
      id: "session",
      user: user("bob", []),
    });
    const deniedRouter = mount(guards.PermissionGuard);
    await waitFor(() =>
      expect(deniedRouter.state.location.pathname).toBe("/custom-forbidden"),
    );
  } finally {
    Object.assign(routes.auth, { signIn: original.login });
    Object.assign(routes.system, { forbidden: original.forbidden });
  }
});
