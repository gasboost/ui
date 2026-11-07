import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const consumer = await mkdtemp(join(tmpdir(), "gasboost-guard-"));
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
  item.registryDependencies = (item.registryDependencies ?? []).map(
    (name) => `${base}/${name.split("/").at(-1)}.json`,
  );
}
function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: consumer,
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
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "guard-smoke",
      private: true,
      dependencies: {
        ...Object.fromEntries(
          Object.entries(pkg.dependencies).filter(
            ([name]) =>
              ![
                "@gasboost/auth-client",
                "@gasboost/client",
                "@gasboost/react",
                "react-router-dom",
              ].includes(name),
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
        paths: { "@/*": ["./src/*"] },
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
      style: "new-york",
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
    "Installing guard and its registry dependencies into a fresh consumer...",
  );
  console.log(
    await run(process.execPath, [cli, "add", `${base}/guard.json`, "--yes"]),
  );
  for (const item of items.values()) {
    for (const file of item.files) {
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
export const policy = new AuthorizationPolicy({ staff: ["create", "read"] });\n`,
  );
  await writeFile(
    join(consumer, "src/guard.types.tsx"),
    `import { PermissionGuard } from "./frontend/components/Guard";
import { useAuth } from "./frontend/contexts/AuthContext";
import { auth } from "./frontend/lib/auth";
const allowed = <PermissionGuard requirement={{ staff: ["read"] }}>OK</PermissionGuard>;
// @ts-expect-error Unknown resource
const badResource = <PermissionGuard requirement={{ unknown: ["read"] }}>No</PermissionGuard>;
// @ts-expect-error Unknown action
const badAction = <PermissionGuard requirement={{ staff: ["delete"] }}>No</PermissionGuard>;
function check() {
  const { user } = useAuth();
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
  // Use the checked-in compiler; dependencies are resolved from the consumer.
  await run(join(root, "node_modules/.bin/tsc"), ["--project", consumer]);
  console.log(
    "Installed consumer typecheck and negative resource/action checks passed.",
  );
  const customRoutes =
    'export const routes = { user: { login: "/custom-login" }, system: { forbidden: "/custom-forbidden" }, home: "/home" } as const;\n';
  await writeFile(join(consumer, "src/shared/routes.ts"), customRoutes);
  console.log(
    await run(
      process.execPath,
      [cli, "add", `${base}/guard.json`, "--yes"],
      "n\n",
    ),
  );
  assert.equal(
    await readFile(join(consumer, "src/shared/routes.ts"), "utf8"),
    customRoutes,
  );
  console.log("Existing consumer routes preserved when overwrite is declined.");
} finally {
  server.close();
  await rm(consumer, { recursive: true, force: true });
}
