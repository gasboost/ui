import { createReplica } from "@gasboost/replica";

// Add only application table definitions shared with the backend here.
// Authentication tables must never be replicated to the browser.
export const replica = createReplica({
  name: "gasboost-replica",
  tables: [] as const,
});
