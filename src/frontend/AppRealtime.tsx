import { useEffect } from "react";
import { AuthApp } from "./components/AuthApp";
import { useAuth } from "./contexts/AuthContext";
import { auth } from "./lib/auth";

// AuthProvider restores GAS first. External auth synchronization is a side effect;
// Firebase failure never changes the GAS route's access conditions.
function FirebaseSessionSync() {
  const { token, isLoading, isSessionRestoreFailed } = useAuth();
  useEffect(() => {
    if (isLoading || isSessionRestoreFailed) return;
    void auth.sync().catch((error) => {
      console.error("Firebase authentication synchronization failed", error);
    });
  }, [token, isLoading, isSessionRestoreFailed]);
  return null;
}

export default function App() {
  return <AuthApp sessionEffects={<FirebaseSessionSync />} />;
}
