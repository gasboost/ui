import { memoryAuthStorage } from "@gasboost/auth-client";
import { appsScriptAuth } from "@gasboost/auth-client/appsscript";
import { vi } from "vitest";

type User = { id: string; data: { permissions: string[] } };
export const user = (id = "alice", permissions = ["staff:read"]): User => ({
  id,
  data: { permissions },
});
export const rpc = {
  getSession: vi.fn(async (_input: { sessionId: string }) => ({
    id: "session",
    user: user(),
  })),
  signInEmail: vi.fn(async (_input: { email: string; password: string }) => ({
    user: user(),
    session: { id: "session" },
  })),
  signInAppsScript: vi.fn(async () => ({
    user: user(),
    session: { id: "session" },
  })),
  signUpEmail: vi.fn(async () => ({
    user: user(),
    session: { id: "session" },
  })),
  signUpAppsScript: vi.fn(async () => ({
    user: user(),
    session: { id: "session" },
  })),
  signOut: vi.fn(async () => null),
};
export const storage = memoryAuthStorage();
export const testAuth = appsScriptAuth({ client: rpc, storage });
