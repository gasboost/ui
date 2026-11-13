import { useAppsScriptJob } from "@gasboost/react";
import { CircleAlert, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { jobs } from "../lib/appsscript";
import { ServerJobItem } from "./ServerJobItem";

export function ServerJobList() {
  const items = useAppsScriptJob(jobs);
  if (items.length === 0) return null;

  const isRunning = items.some((job) => job.status === "running");
  const hasFailed = items.some((job) => job.status === "failed");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" />}
        aria-label="サーバー処理の状況"
      >
        {isRunning ? (
          <Spinner aria-hidden="true" />
        ) : hasFailed ? (
          <CircleAlert className="text-destructive" aria-hidden="true" />
        ) : (
          <Clock aria-hidden="true" />
        )}
        <Badge className="pointer-events-none absolute -right-1 -top-1 min-w-4 px-1 text-[10px]">
          {items.length}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)]"
        aria-label="サーバー処理"
      >
        {items.map((job) => (
          <ServerJobItem
            key={job.id}
            job={job}
            onRetry={() => jobs.retry(job.id)}
            onCancel={() => jobs.cancel(job.id)}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
