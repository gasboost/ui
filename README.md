# @gasboost/ui

GAS BOOST向けのフロントエンド連携を配布するshadcn GitHub registryです。

## インストール

RPCクライアントのみを導入する場合:

```sh
pnpm dlx shadcn@latest add gasboost/ui/appsscript-client
```

認証クライアントも導入する場合（`appsscript-client`も自動で導入されます）:

```sh
pnpm dlx shadcn@latest add gasboost/ui/auth-client
```

## 利用条件

- shadcn CLIを利用できるプロジェクトを用意してください。
- 配置先は`src/frontend/lib/appsscript.ts`と`src/frontend/lib/auth.ts`です。
- 利用側の`src/backend/main.ts`から、GAS BOOSTの`InferAppsScript<typeof app>`で推論した`AppType`をexportしてください。異なる構成では`appsscript.ts`の型importを調整してください。
- 認証を使うバックエンドには`@gasboost/auth-app`の`handlers(auth)`を登録してください。バックエンドの実装・依存パッケージは利用側で用意します。

`appsscript-client`は認証連携用の`authStorage`と`authMetadataProvider`も含み、`@gasboost/client`と`@gasboost/auth-client`を導入します。`auth-client`はその同じstorageインスタンスを`appsScriptAuth`に渡します。

```ts
import { auth } from "./lib/auth";

await auth.restoreSession();
await auth.signIn({ email: "user@example.com", password: "your-password" });
await auth.signOut();
```

transportを省略しているため、標準の`AppsScriptTransport`（`google.script.run`）を使います。GASのHTML Service内で動くフロントエンド向けです。外部ホスティングの場合は、利用側で対応するtransportを設定してください。Bridgeはこの2項目には含めません。

これらの項目は`App.tsx`や`main.tsx`を生成しません。

## ページの認証・認可ガード

```sh
pnpm dlx shadcn@latest add gasboost/ui/guard
```

`Guard.tsx` と `src/shared/routes.ts` を配布します。`auth-context` → `auth-client` → `appsscript-client` も依存として導入されます。React 19、React Router 7 の環境で、`AuthProvider` と Router の内側に Guard を配置してください。ルーター本体、遷移先の画面、メニュー、バックエンドは利用側で用意します。

### 既存の routes がある場合

インストール前に変更をコミットするなど、既存ファイルを保存してください。**`--overwrite` は指定せず**、`src/shared/routes.ts` の上書き確認には **No** を選択します。既存の認証クライアントやContextをカスタマイズしている場合も、上書きを断ってください。導入後に差分を確認し、既存 routes に以下の2キーを追加するか、Guard の参照を既存のキー名に合わせます。

```ts
// src/shared/routes.ts — 利用側で編集・拡張する共通定義
export const routes = {
  user: { login: "/login" },
  system: { forbidden: "/forbidden" },
} as const;
```

`routes.user.login` / `routes.system.forbidden` の値を変更すると、Guard の遷移先も変わります。Route、Link、メニューなどもこの同じ定義を参照してください。初期値の画面がない場合は、利用側のURLへ変更します。

### 共有policyとバックエンドの準備

`PermissionGuard` は利用側の `src/shared/policy.ts` を参照します。このファイルは配布時に生成・上書きしません。既存のpolicyが `shared/authorization.ts` などにある場合は、Guard のimportをそのファイルへ変更し、バックエンドと同じインスタンスを参照してください。

```ts
// src/shared/policy.ts
import { AuthorizationPolicy } from "@gasboost/auth/authorization";

export const policy = new AuthorizationPolicy({
  staff: ["create", "read"],
})
  .linkRole("system-admin", { staff: ["create", "read"] })
  .linkRole("staff", { staff: ["read"] });
```

バックエンドは `@gasboost/auth@^0.10.0` / `@gasboost/auth-app@^0.7.0`、フロントエンドは `@gasboost/auth-client@^0.6.0` を使用します。SheetORMの認証repositoryを使う場合は `@gasboost/auth-sheetorm@^0.4.2` が必要です。既存の `AppsScriptAuth` オプションに以下を追加し、そのauthを `handlers(auth)` に渡してください。

```ts
user: {
  data: async ({ user }) => ({
    permissions: await authorization.resolve(user.id),
  }),
},
```

`authorization` は共有policyを使う `AppsScriptAuthorization` です。利用側の `AppType` → RPC client → auth client → AuthContext を通じて `user.data.permissions` が推論されます。既存の認証クライアントを上書きしなかった場合も、上記の対応バージョンへ更新してください。

### 利用例

```tsx
import { Route, Routes } from "react-router-dom";
import { routes } from "./shared/routes";
import { AuthGuard, PermissionGuard } from "./frontend/components/Guard";

// AuthProvider と Router の内側。各 Page は利用側で定義します。
<Routes>
  <Route path={routes.user.login} element={<LoginPage />} />
  <Route path={routes.system.forbidden} element={<ForbiddenPage />} />
  <Route
    path="/account"
    element={
      <AuthGuard>
        <AccountPage />
      </AuthGuard>
    }
  />
  <Route
    path="/staff/new"
    element={
      <PermissionGuard requirement={{ staff: ["create"] }}>
        <CreateEmployeePage />
      </PermissionGuard>
    }
  />
</Routes>;
```

両Guardはセッション復元中や認証操作中に何も表示せず、未認証ならログイン画面へ `replace` で遷移します。`PermissionGuard` は `policy.can(user.data.permissions, requirement)` で同期判定し、権限不足ならforbidden画面へ遷移します。判定のためのRPCは発行しません（AuthProviderによるセッション復元は別途行われます）。`requirement` は共有policyから推論され、不正なresource/actionは型エラーになります。

Guardはページアクセス用です。ボタンの表示制御には `policy.can()` を直接使ってください。**バックエンドでも実行時の認可が必要です。** クライアントのpermissionsはログイン・セッション復元等で取得した時点の情報です。

## 開発・検証

```sh
pnpm install --frozen-lockfile
pnpm format
pnpm typecheck
pnpm test
pnpm registry:smoke
```

`registry:smoke` はregistryをbuildし、一時的なconsumerへ実際のshadcn CLIで依存を含めてインストールします。共有policyからの型推論、不正なresource/actionの型エラー、上書きを断った既存routesの保持を確認します。npmへのアクセスが必要です。生成物は `dist/registry` に出力し、Gitの管理対象に含めません。GAS実環境へのデプロイは行いません。

TypeScriptの `skipLibCheck` はGASとDOMの `MimeType` 宣言の競合を避けるために指定しています。配布ソースとconsumerの型チェックは有効です。
