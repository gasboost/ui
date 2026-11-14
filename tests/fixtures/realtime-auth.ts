import { memoryAuthStorage } from "@gasboost/auth-client";
import { vi } from "vitest";

export const storage = memoryAuthStorage();
export const customToken = vi.fn<() => string>();
const user = { id: "gas-user", name: "GAS User", data: { permissions: [] } };
const session = { id: "gas-session", userId: user.id };
const result = () => ({ user, session, hooks: { customToken: customToken() } });
export const rpc = {
  getSession: vi.fn(async () => ({ ...session, user })),
  signInEmail: vi.fn(async () => result()),
  signInAppsScript: vi.fn(async () => result()),
  signUpEmail: vi.fn(async () => result()),
  signUpAppsScript: vi.fn(async () => result()),
  signOut: vi.fn(async () => {}),
  issueFirebaseCustomToken: vi.fn(async () => ({ customToken: customToken() })),
};
