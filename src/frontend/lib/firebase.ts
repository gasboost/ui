import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
export const firebaseAuth = getAuth(app);
export const firebaseDatabase = getDatabase(app);
// Emulator connections must be configured before the first SDK operation.
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
  connectAuthEmulator(
    firebaseAuth,
    import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL,
  );
}
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_FIREBASE_DATABASE_EMULATOR_HOST
) {
  connectDatabaseEmulator(
    firebaseDatabase,
    import.meta.env.VITE_FIREBASE_DATABASE_EMULATOR_HOST,
    Number(import.meta.env.VITE_FIREBASE_DATABASE_EMULATOR_PORT || 9000),
  );
}
