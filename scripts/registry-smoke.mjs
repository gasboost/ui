import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const consumer = await mkdtemp(join(tmpdir(), "gasboost-ui-"));
const registry = JSON.parse(
  await readFile(join(root, "registry.json"), "utf8"),
);
const items = new Map();
for (const { name } of registry.items) {
  items.set(
    name,
    JSON.parse(
      await readFile(join(root, "dist/registry", `${name}.json`), "utf8"),
    ),
  );
}
assert.ok(
  items.get("auth-context").dependencies.includes("@gasboost/react@^0.4.1"),
  "auth-context must require the session restoration failure flag",
);
assert.ok(
  items.get("server-job").dependencies.includes("@gasboost/client@^0.7.0"),
);
assert.ok(
  items.get("server-job").dependencies.includes("@gasboost/react@^0.4.3"),
);
assert.ok(
  items
    .get("appsscript-client")
    .dependencies.includes("@gasboost/client@^0.7.0"),
);
// Resolve this checkout's dependency chain, rather than published main.
const server = createServer((req, res) => {
  const name = req.url.slice(1).replace(/\.json$/, "");
  if (!items.has(name)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(items.get(name)));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
for (const item of items.values()) {
  item.registryDependencies = (item.registryDependencies ?? []).map((name) =>
    name.startsWith("gasboost/ui/")
      ? `${base}/${name.split("/").at(-1)}.json`
      : name,
  );
}
function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: consumer,
      env: { ...process.env, npm_config_strict_peer_dependencies: "true" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (chunk) => {
        output += chunk;
      });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve(output) : reject(new Error(output)),
    );
    child.stdin.end(input);
  });
}
try {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const registryPackages = new Set(
    [...items.values()]
      .flatMap((item) => item.dependencies ?? [])
      .map((name) => name.slice(0, name.lastIndexOf("@"))),
  );
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "ui-smoke",
      private: true,
      dependencies: {
        ...Object.fromEntries(
          Object.entries(pkg.dependencies).filter(
            ([name]) => !registryPackages.has(name),
          ),
        ),
        vite: "*",
        tailwindcss: "^4",
      },
      devDependencies: {
        "@types/react": pkg.devDependencies["@types/react"],
        "@types/google-apps-script":
          pkg.devDependencies["@types/google-apps-script"],
      },
    }),
  );
  await writeFile(join(consumer, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  await writeFile(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        paths: { "@/*": ["./src/frontend/*"] },
        types: ["react", "google-apps-script"],
      },
      include: ["src"],
    }),
  );
  await mkdir(join(consumer, "src"));
  await writeFile(join(consumer, "src/index.css"), '@import "tailwindcss";\n');
  await writeFile(join(consumer, "index.html"), '<div id="root"></div>');
  await writeFile(
    join(consumer, "components.json"),
    JSON.stringify({
      $schema: "https://ui.shadcn.com/schema.json",
      style: "base-nova",
      rsc: false,
      tsx: true,
      tailwind: {
        config: "",
        css: "src/index.css",
        baseColor: "neutral",
        cssVariables: true,
      },
      aliases: {
        components: "@/components",
        utils: "@/lib/utils",
        ui: "@/components/ui",
        lib: "@/lib",
        hooks: "@/hooks",
      },
    }),
  );
  const cli = join(root, "node_modules/shadcn/dist/index.js");
  console.log(
    "Installing auth pages, auth error pages, server-job, and bootstrap into a fresh consumer...",
  );
  console.log(
    await run(process.execPath, [
      cli,
      "add",
      `${base}/sign-in-page.json`,
      `${base}/sign-up-page.json`,
      `${base}/bootstrap.json`,
      `${base}/auth-error-pages.json`,
      `${base}/forgot-password-page.json`,
      `${base}/reset-password-page.json`,
      `${base}/server-job.json`,
      "--yes",
    ]),
  );
  for (const name of [
    "routes",
    "appsscript-client",
    "auth-rpc",
    "auth-client",
    "auth-context",
    "guard",
    "bootstrap",
    "password-input",
    "sign-in-page",
    "sign-up-page",
    "auth-error-pages",
    "forgot-password-page",
    "reset-password-page",
    "server-job",
  ]) {
    for (const file of items.get(name).files) {
      const installed = await readFile(
        join(consumer, file.target.replace(/^~\//, "")),
        "utf8",
      );
      assert.ok(
        installed.includes(file.content.trim()),
        `Missing installed content: ${file.path}`,
      );
    }
  }
  // The backend and policy belong to the consumer; specialize them to check inference.
  await cp(join(root, "src/backend"), join(consumer, "src/backend"), {
    recursive: true,
  });
  for (const name of ["auth.ts", "tables.ts"])
    await cp(
      join(root, "src/shared", name),
      join(consumer, "src/shared", name),
    );
  await writeFile(
    join(consumer, "src/shared/policy.ts"),
    `import { AuthorizationPolicy } from "@gasboost/auth/authorization";
export const roles = { admin: "admin", user: "user" };
export const policy = new AuthorizationPolicy({ staff: ["create", "read"] });\n`,
  );
  await writeFile(
    join(consumer, "src/guard.types.tsx"),
    `import { PermissionGuard } from "./frontend/components/Guard";
import { useAuth } from "./frontend/contexts/AuthContext";
import { auth } from "./frontend/lib/auth";
import { UnauthorizedPage } from "./frontend/components/UnauthorizedPage";
import { ForbiddenPage } from "./frontend/components/ForbiddenPage";
import { routes } from "./shared/routes";
import { ServerJobList } from "./frontend/components/ServerJobList";
import { client, jobs } from "./frontend/lib/auth-rpc";
const serverJobs = <ServerJobList />;
const subscription = jobs.subscribe(() => jobs.getSnapshot());
const labeledRpc = client.forgotPassword({ email: "user@example.com" }, { label: "再発行" });
const unauthorized = <UnauthorizedPage />;
const forbidden = <ForbiddenPage />;
const customUnauthorized = <UnauthorizedPage signInTo={routes.auth.signIn} title="Sign in" description="Please sign in" actionLabel="Continue" />;
const customForbidden = <ForbiddenPage returnTo={{ pathname: routes.home, search: "?from=forbidden" }} actionLabel="Return" />;
const allowed = <PermissionGuard requirement={{ staff: ["read"] }} />;
// @ts-expect-error Unknown resource
const badResource = <PermissionGuard requirement={{ unknown: ["read"] }} />;
// @ts-expect-error Unknown action
const badAction = <PermissionGuard requirement={{ staff: ["delete"] }} />;
function check() {
  const { user, isSessionRestoreFailed } = useAuth();
  const restoreFailed: boolean = isSessionRestoreFailed;
  const permissions: readonly ("staff:create" | "staff:read")[] | undefined = user?.data.permissions;
  // @ts-expect-error User data must remain typed
  user?.data.missing;
}
async function restored() {
  const session = await auth.restoreSession();
  const permissions: readonly ("staff:create" | "staff:read")[] | undefined = session?.user.data.permissions;
  // @ts-expect-error Restored user data must remain typed
  session?.user.data.missing;
}\n`,
  );
  // shadcn may have resolved peers permissively. A frozen install alone skips
  // resolution and does not catch incompatible peers already in its lockfile.
  await rm(join(consumer, "pnpm-lock.yaml"));
  console.log(
    await run("pnpm", [
      "install",
      "--lockfile-only",
      "--strict-peer-dependencies",
    ]),
  );
  console.log(
    await run("pnpm", [
      "install",
      "--strict-peer-dependencies",
      "--frozen-lockfile",
    ]),
  );
  // Use the checked-in compiler; dependencies are resolved from the consumer.
  await run(join(root, "node_modules/.bin/tsc"), ["--project", consumer]);
  console.log(
    "Installed consumer typecheck and negative resource/action checks passed.",
  );
  const customRoutes =
    'export const routes = { auth: { signIn: "/custom-login" }, system: { forbidden: "/custom-forbidden" }, home: "/home" } as const;\n';
  await writeFile(join(consumer, "src/shared/routes.ts"), customRoutes);
  console.log(
    await run(
      process.execPath,
      [cli, "add", `${base}/auth-error-pages.json`, "--yes"],
      "n\n",
    ),
  );
  assert.equal(
    await readFile(join(consumer, "src/shared/routes.ts"), "utf8"),
    customRoutes,
  );
  console.log("Existing consumer routes preserved when overwrite is declined.");
  await rm(join(consumer, "src/guard.types.tsx"));
  await rm(join(consumer, "src/frontend"), { recursive: true, force: true });
  console.log(
    await run(process.execPath, [
      cli,
      "add",
      `${base}/server-job.json`,
      "--yes",
    ]),
  );
  for (const name of ["ServerJobList", "ServerJobItem"]) {
    assert.ok(
      (
        await readFile(
          join(consumer, `src/frontend/components/${name}.tsx`),
          "utf8",
        )
      ).length > 0,
    );
  }
  await assert.rejects(
    readFile(join(consumer, "src/frontend/components/Guard.tsx")),
    { code: "ENOENT" },
  );
  await run(join(root, "node_modules/.bin/tsc"), ["--project", consumer]);
  console.log("server-job standalone consumer install and typecheck passed.");
  for (const [name, component, other] of [
    ["forgot-password-page", "ForgotPasswordPage", "ResetPasswordPage"],
    ["reset-password-page", "ResetPasswordPage", "ForgotPasswordPage"],
  ]) {
    await rm(join(consumer, "src/frontend"), { recursive: true, force: true });
    await rm(join(consumer, "src/shared/routes.ts"));
    console.log(
      await run(process.execPath, [
        cli,
        "add",
        `${base}/${name}.json`,
        "--yes",
      ]),
    );
    const installed = await readFile(
      join(consumer, `src/frontend/components/${component}.tsx`),
      "utf8",
    );
    assert.ok(installed.includes(items.get(name).files[0].content.trim()));
    await assert.rejects(
      readFile(join(consumer, `src/frontend/components/${other}.tsx`)),
      { code: "ENOENT" },
    );
    await assert.rejects(
      readFile(join(consumer, "src/frontend/components/Guard.tsx")),
      { code: "ENOENT" },
    );
    await run(join(root, "node_modules/.bin/tsc"), ["--project", consumer]);
    console.log(`${name} standalone consumer install and typecheck passed.`);
  }
} finally {
  server.close();
  await rm(consumer, { recursive: true, force: true });
}
