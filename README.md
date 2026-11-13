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

`Guard.tsx` と `src/shared/routes.ts` を配布します。`auth-context` → `auth-client` → `appsscript-client` も依存として導入されます。`@gasboost/react@^0.4.1`、React 19、React Router 7 の環境で、`AuthProvider` と Router の内側に Guard を配置してください。ルーター本体、遷移先の画面、メニュー、バックエンドは利用側で用意します。

### 既存の routes がある場合

インストール前に変更をコミットするなど、既存ファイルを保存してください。**`--overwrite` は指定せず**、`src/shared/routes.ts` の上書き確認には **No** を選択します。既存の認証クライアントやContextをカスタマイズしている場合も、上書きを断ってください。導入後に差分を確認し、既存 routes に以下の2キーを追加するか、Guard の参照を既存のキー名に合わせます。

```ts
// src/shared/routes.ts — 利用側で編集・拡張する共通定義
export const routes = {
  auth: { signIn: "/sign-in" },
  system: { forbidden: "/forbidden" },
} as const;
```

`routes.auth.signIn` / `routes.system.forbidden` の値を変更すると、Guard の遷移先も変わります。Route、Link、メニューなどもこの同じ定義を参照してください。初期値の画面がない場合は、利用側のURLへ変更します。

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

バックエンドは `@gasboost/auth@^0.12.0` / `@gasboost/auth-app@^0.9.0`、フロントエンドは `@gasboost/auth-client@^0.8.1` を使用します。SheetORMの認証repositoryを使う場合は `@gasboost/auth-sheetorm@^0.5.1` が必要です。既存の `AppsScriptAuth` オプションに以下を追加し、そのauthを `handlers(auth)` に渡してください。

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
  <Route path={routes.auth.signIn} element={<LoginPage />} />
  <Route path={routes.system.forbidden} element={<ForbiddenPage />} />
  <Route element={<AuthGuard />}>
    <Route path="/account" element={<AccountPage />} />
  </Route>
  <Route element={<PermissionGuard requirement={{ staff: ["create"] }} />}>
    <Route path="/staff/new" element={<CreateEmployeePage />} />
  </Route>
</Routes>;
```

両Guardはセッション復元中や認証操作中、および `useAuth().isSessionRestoreFailed` がtrueの間は何も表示しません。復元失敗時にAuthClientが古いユーザー・token・permissionsを保持していても、保護ページは表示せず、画面遷移もしません。復元失敗の表示や再試行UIが必要な場合はGuardの外側で同フラグを参照してください。復元が正常に完了して未認証なら、ログイン画面へ `replace` で遷移します。`PermissionGuard` は `policy.can(user.data.permissions, requirement)` で同期判定し、権限不足ならforbidden画面へ遷移します。判定のためのRPCは発行しません（AuthProviderによるセッション復元は別途行われます）。`requirement` は共有policyから推論され、不正なresource/actionは型エラーになります。

Guardはページアクセス用です。ボタンの表示制御には `Can` または `policy.can()` を使ってください。**バックエンドでも実行時の認可が必要です。** クライアントのpermissionsはログイン・セッション復元等で取得した時点の情報です。

## ログイン・アカウント登録ページ

```sh
pnpm dlx shadcn@latest add gasboost/ui/sign-in-page gasboost/ui/sign-up-page
```

`components/SignInPage.tsx` と `components/SignUpPage.tsx`、パスワードの表示切り替えができる `components/ui/PasswordInput.tsx`、必要なフォーム・UI依存関係を導入します。入力検証、API呼び出し、エラー表示は各Page内にあります。PasswordInputのみ必要な場合は `gasboost/ui/password-input` を指定します。

PageはRouterと `QueryClientProvider` の内側に配置し、認証状態を使う画面には `AuthProvider` を配置してください。利用側で以下のRouteを登録します。

```tsx
<Route path={routes.auth.signIn} element={<SignInPage />} />
<Route path={routes.auth.signUp} element={<SignUpPage />} />
```

既存のroutesを保持する場合は `routes.home`、`routes.auth.signIn`、`routes.auth.signUp`、`routes.system.bootstrap`、`routes.system.forbidden` を追加してください。認証成功後は `routes.home` へ遷移します。認証エラーコードを返すため、バックエンドでは `handlers(auth)` の前に `authErrorHandler()` を登録してください。Guardが参照する共有policyとバックエンドは利用側で用意します。

## パスワードの再発行・再設定ページ

それぞれ個別にインストールできます。互いのPageやGuard、AuthContextには依存しません。

```sh
pnpm dlx shadcn@latest add gasboost/ui/forgot-password-page
pnpm dlx shadcn@latest add gasboost/ui/reset-password-page
```

`components/ForgotPasswordPage.tsx` / `components/ResetPasswordPage.tsx` と共有routes、必要なフォーム・UI依存を導入します。Routerと `QueryClientProvider` の内側、ログインを要求するGuardの外側に配置してください。

```tsx
import { ForgotPasswordPage } from "./frontend/components/ForgotPasswordPage";
import { ResetPasswordPage } from "./frontend/components/ResetPasswordPage";

<Route path={routes.auth.forgotPassword} element={<ForgotPasswordPage />} />
<Route path={routes.auth.resetPassword} element={<ResetPasswordPage />} />
```

既存ファイルの上書きを断った場合は `routes.auth.forgotPassword`（初期値 `/forgot-password`）、`routes.auth.resetPassword`（`/reset-password`）、`routes.auth.signIn` を既存routesに追加してください。ログイン画面から再発行ページへのリンクも利用側で配置できます。

Forgotは `client.forgotPassword({ email })` を呼び、登録有無によらず同じ完了案内を表示します。Resetは `useSearchParams()` の `token` と新しいパスワードを `client.resetPassword({ token, newPassword })` に渡します。確認欄はRPCに送信しません。トークン欠損時は送信できず、不正・期限切れ・使用済みの場合は再発行リンクを案内します。通信などの失敗は手動で再試行できます。成功後はログインへのリンクを表示し、自動ログインは行いません。

バックエンドは既存の `handlers(auth)` と、その前に登録した `authErrorHandler()` を使用します。パスワードリセットの有効化（`emailPassword.passwordReset`）、通知メールの実装とリンクの生成は利用側の責務です。追加のバックエンドAPIやパッケージのバージョン更新は不要です。

GASでは既存の `AppsScriptRouter` の内側に `HashRouter` を配置してください。メールのURL例は `https://script.google.com/macros/s/DEPLOYMENT_ID/exec?token=URL_ENCODED_TOKEN#/reset-password` です。`AppsScriptRouter` がGAS親ページのqueryをHashRouterに同期するため、Pageはiframeの `window.location.search` を直接読みません。HashRouterのqueryを使う `.../exec#/reset-password?token=URL_ENCODED_TOKEN` にも対応します。トークンは `encodeURIComponent()` でエンコードし、実際のデプロイURLと設定したresetルートを使ってください。

## 認証・認可エラーページ

```sh
pnpm dlx shadcn@latest add gasboost/ui/auth-error-pages
```

`components/UnauthorizedPage.tsx` と `components/ForbiddenPage.tsx`、Card / Button、および依存する Guard と共有routesを導入します。既存ファイルの上書き確認には、上記「既存の routes がある場合」と同様に対応してください。共有policyとバックエンドは利用側で用意します。

`UnauthorizedPage` はログインが必要な状態を説明し、初期値では `routes.auth.signIn` へのリンクを表示します。`ForbiddenPage` は権限不足を説明し、初期値では `routes.home` へ戻れます。各PageはRouterの内側で使います。Page自体は認証・認可の判定、セッション復元、RPC呼び出しを行いません。

```tsx
import { UnauthorizedPage } from "./frontend/components/UnauthorizedPage";
import { ForbiddenPage } from "./frontend/components/ForbiddenPage";

// AuthProvider と Router の内側。HomePage / AccountPage は利用側で定義します。
<Routes>
  <Route path={routes.auth.signIn} element={<SignInPage />} />
  <Route path={routes.system.forbidden} element={<ForbiddenPage />} />
  <Route path="/unauthorized" element={<UnauthorizedPage />} />
  <Route path={routes.home} element={<HomePage />} />
  <Route element={<AuthGuard />}>
    <Route path="/account" element={<AccountPage />} />
  </Route>
  <Route element={<PermissionGuard requirement={{ staff: ["read"] }} />}>
    <Route path="/staff" element={<StaffPage />} />
  </Route>
</Routes>;
```

既存Guardは未認証時に `routes.auth.signIn`、権限不足時に `routes.system.forbidden` へ遷移します。`/unauthorized` は利用側の任意の例で、共有routesへの追加やGuardからの自動遷移はありません。ログイン前に案内を挟む場合は、`routes.auth.signIn` のRouteに `<UnauthorizedPage signInTo="/login-form" />` を配置し、別の `/login-form` Routeに `SignInPage` を配置してください。この場合は案内自身をリンク先に指定しないようにします。案内とforbiddenのRouteはGuardの外側に置き、戻り先には利用者がアクセスできるページを指定してください。

`UnauthorizedPage` の `signInTo`、`ForbiddenPage` の `returnTo` でリンク先を明示できます（React Routerの `To` 型）。両Pageの `title` / `description` / `actionLabel` で文言を変更できます。配布されたTSXを直接編集して配置や見た目も変更できます。

```tsx
<ForbiddenPage
  returnTo={routes.home}
  title="この画面は利用できません"
  description="必要な権限については管理者にお問い合わせください。"
  actionLabel="トップへ戻る"
/>
```

401 / 403相当の状態を案内するUIであり、GAS RPCがHTTP 401 / 403を返す前提はありません。表示先は利用側のRouter設定で決まります。バックエンドの実行時認可も引き続き必要です。

## RPCジョブの状況・再試行

```sh
pnpm dlx shadcn@latest add gasboost/ui/server-job
```

`ServerJobList.tsx` / `ServerJobItem.tsx` と、Badge / Button / DropdownMenu / Spinnerを導入します。`@gasboost/client@^0.7.0` と `@gasboost/react@^0.4.2` を使用します。

既存の `src/frontend/lib/appsscript.ts` をカスタマイズしている場合は上書きを断り、**既存の呼び出しから `jobs` もexport**してください。クライアントを二重生成すると別のキューになります。

```ts
export const { client, jobs } = appsScriptClient<AppType>({
  metadataProviders: [authMetadataProvider(authStorage)],
});

// 第2引数のlabelをそのまま表示します。省略時はRPCメソッド名です。
await client.createEmployee({ name: "田中太郎" }, { label: "従業員の登録" });
```

RPCは自動でキューに入るため、`jobs.start()` でRPCを包まないでください。

```tsx
import { ServerJobList } from "./frontend/components/ServerJobList";

// 利用側のヘッダーなどに配置します。専用LayoutやProviderは不要です。
<ServerJobList />;
```

ジョブが0件なら非表示です。1件以上ならアイコンと件数だけを表示し、クリックすると各ジョブの名前・状態を確認できます。実行中のSpinnerを優先し、実行中がなく失敗があれば失敗アイコン、それ以外は時計アイコンになります。待機中だけ「キャンセル」、失敗時だけ「再試行」を表示します。行全体が1つのmenu itemで、矢印キーで移動しEnter / Spaceで操作でき、操作後も他のジョブが残っていればDropdownを開いたままにします。内部エラー情報は表示しません。

`ServerJobItem` はStoreを購読せず、`job: AppsScriptJob<unknown>` と `onRetry` / `onCancel` を受け取る表示・操作部品です。DropdownMenu内で使います。

ジョブはクライアントメモリ内のRPCキューです。成功するとStoreから削除され、成功履歴は残りません。サーバー永続化、リロード後の履歴、実行途中のキャンセル、進捗率、バックグラウンドでの継続実行を保証するものではありません。

## 開発・検証

```sh
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm format
pnpm typecheck
pnpm test
pnpm registry:smoke
```

`registry:smoke` はregistryをbuildし、一時的なconsumerへ認証Page・パスワード再設定Page・認証エラーページ・ServerJobとBootstrapを実際のshadcn CLIで依存を含めてインストールし、strict peer条件と配布ソースの型チェックを確認します。`@gasboost/react@^0.4.1` の依存宣言と復元失敗フラグの型、共有policyからの型推論、不正なresource/actionの型エラー、上書きを断った既存routesの保持を確認します。パスワード再発行・再設定Pageはそれぞれ単独でもインストール・型チェックします。npmへのアクセスが必要です。生成物は `dist/registry` に出力し、Gitの管理対象に含めません。GAS実環境へのデプロイは行いません。

TypeScriptの `skipLibCheck` はGASとDOMの `MimeType` 宣言の競合を避けるために指定しています。配布ソースとconsumerの型チェックは有効です。

## Bootstrap の Provider 配置

`pnpm dlx shadcn@latest add gasboost/ui/bootstrap` で初期設定ページと Guard を導入します。
`BootstrapGuard` は未初期化なら `routes.system.bootstrap` へクエリ文字列を保持して遷移します。
ページの `useMutation` に必要な `QueryClientProvider` は Guard の外側に、認証復元を行う `AuthProvider` は Guard の内側に配置します。

```tsx
<AppsScriptRouter>
  <HashRouter>
    <AppsScriptProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <BootstrapProvider initialState={bootstrap}>
          <Routes>
            <Route path={routes.system.bootstrap} element={<BootstrapPage />} />
            <Route element={<BootstrapGuard />}>
              <Route
                path="/*"
                element={
                  <AuthProvider>
                    <App />
                  </AuthProvider>
                }
              />
            </Route>
          </Routes>
        </BootstrapProvider>
      </QueryClientProvider>
    </AppsScriptProvider>
  </HashRouter>
</AppsScriptRouter>
```

`bootstrap` は `lib/bootstrap.ts` の初期値、`queryClient` は TanStack Query の `new QueryClient()` です。
`AppsScriptRouter` が同期した URL の token はクエリ文字列を保持した遷移後に `useSearchParams()` から読み取り、RPC の `initialized === true` の場合だけ `BootstrapProvider` の状態を更新します。
