import {
  InMemoryCacheService,
  InMemoryContext,
  InMemoryPropertiesService,
  InMemorySession,
  OAuthScope,
  SecurityPolicy,
} from "@gasboost/fake-core";
import { NodeLockService, NodeUrlFetchApp } from "@gasboost/fake-node";
import { SheetsStub, SpreadsheetAppStub } from "@gasboost/sheetorm";
import { gasboost } from "@gasboost/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const cacheService = new InMemoryCacheService({
  script: {
    "e2e-session": JSON.stringify({
      id: "e2e-session",
      userId: "e2e-admin",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 21600_000).toISOString(),
    }),
  },
});

function devAuth({
  module,
  sessionId,
}: {
  module: string;
  sessionId: string;
}): Plugin {
  return {
    name: "dev-auth",
    apply: "serve",

    transformIndexHtml: {
      order: "pre",
      handler: () => [
        {
          tag: "script",
          attrs: { type: "module" },
          injectTo: "head",
          children: `
                    import { auth } from ${JSON.stringify(module)};
                    
                    localStorage.setItem("@gasboost/auth", ${JSON.stringify(sessionId)});
                    await auth.sync();
                    `,
        },
      ],
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const isLocal = command === "serve" && mode === "development";

  const bootstrapState = {
    initialized: false,
    bootstrap: {
      token: "test-token",
      expiresAt: Date.now() + 21600_000,
      attempts: 0,
      email: "oshima.automate.growth@gmail.com",
      notified: true,
    },
  };

  const propertiesService = new InMemoryPropertiesService({
    script: {
      AUTH_PEPPER: "your-auth-pepper-value",
      APP_STATE: JSON.stringify(bootstrapState),
    },
  });
  const target = process.env.BUILD_TARGET;

  const { build, dev } = gasboost({
    entry: "src/backend/main.ts",
    runtime: {
      SpreadsheetApp: SpreadsheetAppStub,
      Sheets: SheetsStub,
      PropertiesService: propertiesService,
      CacheService: cacheService,
      UrlFetchApp: new NodeUrlFetchApp(),
      LockService: new NodeLockService({
        scriptId: "test-script-id",
        userId: "test-user-id",
      }),
      MailApp: {
        sendEmail: () => {
          console.log("sendEmail called");
        },
      },
      Session: new InMemorySession(
        new InMemoryContext(
          "oshima.automate.growth@gmail.com",
          "oshima.automate.growth@gmail.com",
          {
            type: "WEB_APP",
            executeAs: "OWNER",
          },
          new SecurityPolicy([OAuthScope.USERINFO_EMAIL]),
          "ja",
          "Asia/Tokyo",
        ),
      ),
    },
    localRpc: {
      override: mode === "development",
      database: {
        __GASBOOST_SPREADSHEET_ID__: {
          employees: [{ userId: "e2e-admin" }, { userId: "staff-1" }],

          user: [
            { id: "e2e-admin", name: "管理者" },
            { id: "staff-1", name: "田中太郎" },
          ],

          account: [],
          passwordReset: [],

          authorizationRole: [
            {
              id: "role-1",
              userId: "e2e-admin",
              role: "system-admin",
            },
          ],

          authorizationPermission: [],
        },
      },
      rtdb: {
        emulator: {
          namespace: "demo-rednose-pos",
        },
      },
      auth: {
        emulator: {
          host: "localhost",
          port: 9099,
        },
      },
    },
    template: {
      __BOOTSTRAP__: JSON.stringify({ initialized: true }),
    },
  });

  if (target === "server") {
    return {
      plugins: [build],
      build: {
        outDir: "dist/server",
        emptyOutDir: true,
        chunkSizeWarningLimit: 1000,
      },
    };
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(command === "serve"
        ? [
            dev,
            devAuth({
              module: "./src/frontend/lib/auth.ts",
              sessionId: "e2e-session",
            }),
          ]
        : []),
    ],
    build: {
      outDir: "dist/client",
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src/frontend", import.meta.url)),
      },
    },
  };
});
