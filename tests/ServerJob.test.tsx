// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { appsScriptClient, type AppsScriptJob } from "@gasboost/client";
import { ServerJobList } from "../src/frontend/components/ServerJobList";
import { ServerJobItem } from "../src/frontend/components/ServerJobItem";
import {
  DropdownMenu,
  DropdownMenuContent,
} from "../src/frontend/components/ui/dropdown-menu";

const fixture = vi.hoisted(() => ({ jobs: undefined as unknown }));
vi.mock("../src/frontend/lib/appsscript", () => ({
  get jobs() {
    return fixture.jobs;
  },
}));
afterEach(cleanup);

function setup() {
  const calls: {
    resolve: (value: { contents: string }) => void;
    reject: (error: Error) => void;
  }[] = [];
  const call = vi.fn(
    () =>
      new Promise<{ contents: string }>((resolve, reject) => {
        calls.push({ resolve, reject });
      }),
  );
  const rpc = appsScriptClient<{
    createEmployee: { input: { name: string }; result: string };
  }>({ transport: { call } });
  fixture.jobs = rpc.jobs;
  return { ...rpc, calls, call };
}

it("subscribes to RPC labels, prioritizes running, retries without closing, and removes success", async () => {
  const { client, jobs, calls, call } = setup();
  const user = userEvent.setup();
  const view = render(<ServerJobList />);
  expect(screen.queryByRole("button")).toBeNull();
  let first!: Promise<unknown>;
  act(() => {
    first = client
      .createEmployee({ name: "田中太郎" }, { label: "従業員の登録" })
      .catch(() => undefined);
  });
  const trigger = screen.getByRole("button", { name: "サーバー処理の状況" });
  expect(trigger.textContent).toBe("1");
  expect(trigger.querySelector(".animate-spin")).toBeTruthy();
  expect(screen.queryByText("実行中")).toBeNull();
  await user.click(trigger);
  expect(await screen.findByText("従業員の登録")).toBeTruthy();
  expect(screen.getByText("実行中")).toBeTruthy();
  expect(screen.queryByText("キャンセル")).toBeNull();
  await act(async () => {
    calls[0].reject(new Error("private backend information"));
    await first;
  });
  expect(screen.queryByText("private backend information")).toBeNull();
  expect(trigger.querySelector(".text-destructive")).toBeTruthy();
  const retry = screen.getByRole("menuitem", {
    name: /従業員の登録.*失敗.*再試行/,
  });
  const retrySpy = vi.spyOn(jobs, "retry");
  const failedId = jobs.getSnapshot()[0].id;
  await user.click(retry);
  expect(retrySpy).toHaveBeenCalledExactlyOnceWith(failedId);
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(screen.getByText("実行中")).toBeTruthy();
  expect(call).toHaveBeenCalledTimes(2);
  view.unmount();
  render(<ServerJobList />);
  expect(call).toHaveBeenCalledTimes(2);
  await act(async () => {
    calls[1].resolve({ contents: '"ok"' });
  });
  await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  expect(jobs.getSnapshot()).toHaveLength(0);
});

it("cancels only queued jobs using keyboard menu navigation and keeps the menu open", async () => {
  const { client, jobs, calls } = setup();
  const user = userEvent.setup();
  const promises = Array.from({ length: 31 }, () =>
    client.createEmployee({ name: "田中" }).catch(() => undefined),
  );
  const cancelSpy = vi.spyOn(jobs, "cancel");
  const pending = jobs.getSnapshot().find((job) => job.status === "pending")!;
  render(<ServerJobList />);
  const trigger = screen.getByRole("button", { name: "サーバー処理の状況" });
  expect(trigger.textContent).toBe("31");
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await screen.findByRole("menu");
  await user.keyboard("{End}");
  expect(document.activeElement?.textContent).toContain("キャンセル");
  await user.keyboard("{Enter}");
  expect(cancelSpy).toHaveBeenCalledExactlyOnceWith(pending.id);
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(screen.queryByText("キャンセル")).toBeNull();
  expect(trigger.textContent).toBe("30");
  expect(screen.getAllByText("createEmployee")).toHaveLength(30);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(document.activeElement).toBe(trigger);
  await act(async () => {
    calls.forEach((call) => call.resolve({ contents: '"ok"' }));
    await Promise.all(promises);
  });
  await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
});

it("prioritizes the running spinner over a failed job", async () => {
  const { client, calls } = setup();
  const failed = client.createEmployee({ name: "田中" }).catch(() => undefined);
  await act(async () => {
    calls[0].reject(new Error("private"));
    await failed;
  });
  const running = client.createEmployee({ name: "佐藤" });
  render(<ServerJobList />);
  const trigger = screen.getByRole("button", { name: "サーバー処理の状況" });
  expect(trigger.textContent).toBe("2");
  expect(trigger.querySelector(".animate-spin")).toBeTruthy();
  expect(trigger.querySelector(".text-destructive")).toBeNull();
  await act(async () => {
    calls[1].resolve({ contents: '\"ok\"' });
    await running;
  });
  await waitFor(() =>
    expect(trigger.querySelector(".text-destructive")).toBeTruthy(),
  );
  expect(trigger.textContent).toBe("1");
});

it("shows the waiting icon when no jobs are running or failed", () => {
  const { client, jobs } = setup();
  void client.createEmployee({ name: "田中" });
  vi.spyOn(jobs.getSnapshot()[0], "status", "get").mockReturnValue("pending");
  render(<ServerJobList />);
  const trigger = screen.getByRole("button", { name: "サーバー処理の状況" });
  expect(trigger.querySelector(".lucide-clock")).toBeTruthy();
  expect(trigger.querySelector(".animate-spin")).toBeNull();
});

for (const [status, text, action] of [
  ["pending", "実行待ち", "キャンセル"],
  ["running", "実行中", null],
  ["failed", "失敗", "再試行"],
  ["success", "完了", null],
  ["unknown", "状態不明", null],
] as const) {
  it(`renders ${status} with only its allowed action`, async () => {
    const { client, jobs } = setup();
    void client.createEmployee({ name: "田中" });
    const job: AppsScriptJob<unknown> = jobs.getSnapshot()[0];
    vi.spyOn(job, "status", "get").mockReturnValue(status);
    const onRetry = vi.fn();
    const onCancel = vi.fn();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent>
          <ServerJobItem job={job} onRetry={onRetry} onCancel={onCancel} />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.getByText("createEmployee")).toBeTruthy();
    expect(screen.queryByText("キャンセル") !== null).toBe(
      action === "キャンセル",
    );
    expect(screen.queryByText("再試行") !== null).toBe(action === "再試行");
    if (action) {
      await userEvent.setup().click(screen.getByRole("menuitem"));
      expect(
        action === "キャンセル" ? onCancel : onRetry,
      ).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("menu")).toBeTruthy();
    }
  });
}
