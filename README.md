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
