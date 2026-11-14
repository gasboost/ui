import { appsScriptAuth } from "@gasboost/auth-client/appsscript";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { authStorage, client } from "@/lib/auth-rpc";
import { firebaseAuth } from "@/lib/firebase";
import { queryClient } from "@/lib/query";

export const auth = appsScriptAuth({
  client,
  storage: authStorage,
  getUserId: ({ session }) => session.userId,
  hooks: {
    afterSignIn: async ({ hooks }) => {
      queryClient.clear();
      await signInWithCustomToken(firebaseAuth, hooks.customToken);
    },
    afterSignOut: () => queryClient.clear(),
  },
  externalAuth: {
    getUserId: async () => {
      await firebaseAuth.authStateReady();
      return firebaseAuth.currentUser?.uid ?? null;
    },
    signIn: async () => {
      const { customToken } = await client.issueFirebaseCustomToken();
      await signInWithCustomToken(firebaseAuth, customToken);
    },
    signOut: () => signOut(firebaseAuth),
  },
});
