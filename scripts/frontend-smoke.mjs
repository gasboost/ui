import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const registry = JSON.parse(
  await readFile(join(root, "registry.json"), "utf8"),
);
const items = new Map(
  await Promise.all(
    registry.items.map(async ({ name }) => [
      name,
      JSON.parse(
        await readFile(join(root, "dist/registry", `${name}.json`), "utf8"),
      ),
    ]),
  ),
);
const server = createServer((req, res) => {
  const item = items.get(req.url.slice(1).replace(/\.json$/, ""));
  if (!item) return res.writeHead(404).end();
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(item));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
for (const item of items.values())
  item.registryDependencies = (item.registryDependencies ?? []).map((name) =>
    name.startsWith("gasboost/ui/")
      ? `${base}/${name.split("/").at(-1)}.json`
      : name,
  );
// Exactly one owner for each target across a resolved dependency graph.
function closure(name, found = new Set()) {
  if (found.has(name)) return found;
  found.add(name);
  for (const dep of items.get(name).registryDependencies) {
    if (dep.startsWith(base))
      closure(
        dep
          .split("/")
          .at(-1)
          .replace(/\.json$/, ""),
        found,
      );
  }
  return found;
}
function run(cwd, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, npm_config_strict_peer_dependencies: "true" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve(output) : reject(new Error(output)),
    );
  });
}
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const cli = join(root, "node_modules/shadcn/dist/index.js");
try {
  for (const [label, name, database] of [
    ["frontend", "frontend", false],
    ["database-frontend", "frontend", true],
    ["auth-frontend", "frontend-auth", true],
    ["realtime-auth-frontend", "frontend-auth-realtime", true],
  ]) {
    const cwd = await mkdtemp(join(tmpdir(), `gasboost-${label}-`));
    console.log(`Installing ${label} via shadcn CLI...`);
    try {
      const selected = [...closure(name)];
      const targets = new Set();
      for (const n of selected)
        for (const file of items.get(n).files) {
          assert.ok(
            !targets.has(file.target),
            `Duplicate target: ${file.target}`,
          );
          targets.add(file.target);
          assert.ok(
            !file.target.includes("backend/") &&
              !file.target.includes("tests/"),
          );
        }
      const auth = name !== "frontend";
      const realtime = name === "frontend-auth-realtime";
      const dependencies = {
        react: pkg.dependencies.react,
        "react-dom": pkg.dependencies["react-dom"],
        "@gasboost/app": pkg.dependencies["@gasboost/app"],
        cn: pkg.dependencies.cn,
      };
      if (database)
        Object.assign(dependencies, {
          "@gasboost/sheetorm": pkg.dependencies["@gasboost/sheetorm"],
          "@gasboost/table": pkg.dependencies["@gasboost/table"],
          zod: pkg.dependencies.zod,
        });
      if (auth)
        for (const n of [
          "@gasboost/auth",
          "@gasboost/auth-app",
          "@gasboost/auth-sheetorm",
          "@gasboost/bootstrap",
          "@gasboost/rls",
        ])
          dependencies[n] = pkg.dependencies[n];
      await writeFile(
        join(cwd, "package.json"),
        JSON.stringify({
          name: label,
          private: true,
          type: "module",
          dependencies,
          devDependencies: Object.fromEntries(
            [
              "vite",
              "@vitejs/plugin-react",
              "@tailwindcss/vite",
              "@types/react",
              "@types/react-dom",
              "@types/google-apps-script",
            ].map((n) => [n, pkg.devDependencies[n]]),
          ),
        }),
      );
      await writeFile(join(cwd, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
      await writeFile(
        join(cwd, "tsconfig.json"),
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
            types: ["vite/client", "react", "google-apps-script"],
          },
          include: ["src"],
        }),
      );
      await mkdir(join(cwd, "src/frontend"), { recursive: true });
      // create owns HTML and bundler configuration. These are test fixtures only.
      const html = `<!doctype html><html><body><div id="root"></div>${auth ? '<script type="application/json" id="bootstrap-data">{"initialized":true}</script>' : ""}<script type="module" src="/src/frontend/main.tsx"></script></body></html>`;
      await writeFile(join(cwd, "index.html"), html);

      await writeFile(
        join(cwd, "vite.config.mjs"),
        `import { defineConfig } from "vite"; import react from "@vitejs/plugin-react"; import tailwind from "@tailwindcss/vite"; export default defineConfig({ plugins: [react(), tailwind()], resolve: { alias: { "@": new URL("./src/frontend", import.meta.url).pathname } } });`,
      );
      await writeFile(
        join(cwd, "components.json"),
        JSON.stringify({
          $schema: "https://ui.shadcn.com/schema.json",
          style: "base-nova",
          rsc: false,
          tsx: true,
          tailwind: {
            config: "",
            css: "src/frontend/style.css",
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
      if (auth) {
        await cp(join(root, "src/backend"), join(cwd, "src/backend"), {
          recursive: true,
        });
        // Match create's Apps Script authentication contract in this fixture.
        const authPath = join(cwd, "src/backend/lib/auth.ts");
        await writeFile(
          authPath,
          (await readFile(authPath, "utf8"))
            .replace(
              "emailPassword: {\n    enabled: true",
              "emailPassword: {\n    enabled: false",
            )
            .replace(
              "appsScript: {\n    enabled: false",
              "appsScript: {\n    enabled: true",
            ),
        );
        await mkdir(join(cwd, "src/shared"), { recursive: true });
        for (const f of ["auth.ts", "policy.ts", "tables.ts"])
          await cp(join(root, "src/shared", f), join(cwd, "src/shared", f));
        if (realtime) {
          await writeFile(
            authPath,
            (await readFile(authPath, "utf8")).replace(
              "  repository,",
              '  repository,\n  hooks: { afterSignIn: () => ({ customToken: "fixture" }) },',
            ),
          );
          const path = join(cwd, "src/backend/main.ts");
          await writeFile(
            path,
            (await readFile(path, "utf8")).replace(
              ".calls(handlers(auth));",
              '.calls(handlers(auth)).call("issueFirebaseCustomToken", () => ({ customToken: "fixture" }));',
            ),
          );
        }
      } else {
        await mkdir(join(cwd, "src/backend"), { recursive: true });
        await writeFile(
          join(cwd, "src/backend/main.ts"),
          'import { AppsScript, type InferAppsScript } from "@gasboost/app"; const app = new AppsScript(); export type AppType = InferAppsScript<typeof app>; export default app;\n',
        );
        if (database)
          await writeFile(
            join(cwd, "src/backend/db.ts"),
            'export { SheetDB } from "@gasboost/sheetorm";\n',
          );
      }
      const backend = await readFile(join(cwd, "src/backend/main.ts"), "utf8");
      console.log(
        await run(cwd, process.execPath, [
          cli,
          "add",
          `${base}/${name}.json`,
          "--yes",
        ]),
      );
      assert.equal(
        await readFile(join(cwd, "src/backend/main.ts"), "utf8"),
        backend,
      );
      const installed = JSON.parse(
        await readFile(join(cwd, "package.json"), "utf8"),
      );
      if (!auth) {
        for (const dep of [
          "@gasboost/auth-client",
          "@gasboost/bootstrap",
          "@tanstack/react-query",
          "firebase",
        ])
          assert.ok(
            !installed.dependencies[dep],
            `Unexpected direct dependency: ${dep}`,
          );
        for (const target of targets)
          assert.ok(!/auth|[Bb]ootstrap|firebase|query\.ts/.test(target));
      }
      if (!realtime) assert.ok(!installed.dependencies.firebase);
      for (const target of targets)
        await readFile(join(cwd, target.replace(/^~\//, "")));
      await rm(join(cwd, "pnpm-lock.yaml"));
      await run(cwd, "pnpm", [
        "install",
        "--lockfile-only",
        "--strict-peer-dependencies",
      ]);
      await run(cwd, "pnpm", [
        "install",
        "--strict-peer-dependencies",
        "--frozen-lockfile",
      ]);
      await run(cwd, join(root, "node_modules/.bin/tsc"), ["--project", cwd]);
      console.log(await run(cwd, "pnpm", ["exec", "vite", "build"]));
      // Start the installed app's own Vite, request HTML and every entry module,
      // and verify transformed imports. Vite must resolve the complete graph.
      const runner = join(cwd, "serve.mjs");
      await writeFile(
        runner,
        `import { createServer } from "vite";
const server = await createServer({ server: { port: 0, host: "127.0.0.1" } });
try { await server.listen(); const base = server.resolvedUrls.local[0];
for (const path of ["", "src/frontend/main.tsx", "src/frontend/App.tsx", "src/frontend/style.css"]) { const response = await fetch(base + path); if (!response.ok) throw new Error(path + ": " + await response.text()); }
} finally { await server.close(); }`,
      );
      await run(cwd, process.execPath, [runner]);
      console.log(
        `${label}: fresh install, strict peers, typecheck, Vite dev and build passed.`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }
} finally {
  server.close();
}
