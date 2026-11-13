export const routes = {
  home: "/",
  auth: {
    signIn: "/sign-in",
    signUp: "/sign-up",
  },
  system: {
    forbidden: "/forbidden",
    bootstrap: "/bootstrap",
    unauthorized: "/unauthorized",
  },
} as const;
