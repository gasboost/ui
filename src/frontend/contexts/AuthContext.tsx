import { createAuthContext } from "@gasboost/react";
import { auth } from "../lib/auth";

export const { AuthProvider, useAuth } = createAuthContext(auth);
