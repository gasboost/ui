import type { BootstrapPublicState } from "@gasboost/bootstrap";

// Both HtmlService and local Vite must inject the same public state.
const data = document.getElementById("bootstrap-data")?.textContent;
if (!data) throw new Error("Missing bootstrap-data JSON");
const state: unknown = JSON.parse(data);
if (
  typeof state !== "object" ||
  state === null ||
  !("initialized" in state) ||
  typeof state.initialized !== "boolean"
) {
  throw new Error("bootstrap-data must contain a boolean initialized");
}
export const bootstrap: BootstrapPublicState = {
  initialized: state.initialized,
};
