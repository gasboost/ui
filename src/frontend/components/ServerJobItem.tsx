import type { AppsScriptJob } from "@gasboost/client";
import { CircleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";

export function ServerJobItem({
  job,
  onRetry,
  onCancel,
}: {
  job: AppsScriptJob<unknown>;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const action =
    job.status === "pending"
      ? onCancel
      : job.status === "failed"
        ? onRetry
        : undefined;
  const status =
    job.status === "pending"
      ? "実行待ち"
      : job.status === "running"
        ? "実行中"
        : job.status === "failed"
          ? "失敗"
          : job.status === "success"
            ? "完了"
            : "状態不明";

  return (
    <DropdownMenuItem
      nativeButton
      render={<Button variant="ghost" />}
      className="h-auto w-full justify-between gap-3 p-2 text-left whitespace-normal"
      label={job.label}
      disabled={!action}
      closeOnClick={false}
      onClick={action}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{job.label}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {job.status === "running" && <Spinner aria-hidden="true" />}
          {job.status === "failed" && (
            <CircleAlert
              className="size-3 text-destructive"
              aria-hidden="true"
            />
          )}
          {status}
        </span>
      </span>
      {action && (
        <span className={buttonVariants({ variant: "outline", size: "sm" })}>
          {job.status === "pending" ? "キャンセル" : "再試行"}
        </span>
      )}
    </DropdownMenuItem>
  );
}
