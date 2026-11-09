import type { BootstrapPublicState } from "@gasboost/bootstrap";

export const bootstrap = JSON.parse(
  document.getElementById("bootstrap-data")!.textContent!,
) as BootstrapPublicState;
