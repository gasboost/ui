import { spawn } from "node:child_process";

const child = spawn(
  "firebase",
  [
    "emulators:exec",
    "--only",
    "auth,database",
    "--project",
    "demo-gasboost-ui",
    "--config",
    "tests/fixtures/firebase/firebase.json",
    "pnpm exec vitest run tests/Realtime.emulator.test.tsx",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, DEBUG: "" },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
