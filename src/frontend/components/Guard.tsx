import { useBootstrap } from "@gasboost/bootstrap/react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { policy } from "../../shared/policy";
import { routes } from "../../shared/routes";
import { useAuth } from "../contexts/AuthContext";
import { BootstrapPage } from "../features/bootstrap/BootstrapPage";

type BootstrapGuardProps = {
  children: ReactNode;
};

export function BootstrapGuard({ children }: BootstrapGuardProps) {
  const { initialized } = useBootstrap();
  if (!initialized) {
    return <BootstrapPage />;
  }

  return children;
}

type GuardProps = { children: ReactNode };

export function AuthGuard({ children }: GuardProps) {
  const { user, isLoading, isSessionRestoreFailed } = useAuth();

  if (isLoading || isSessionRestoreFailed) return null;
  if (!user) return <Navigate to={routes.auth.signIn} replace />;

  return <>{children}</>;
}

type PermissionGuardProps = GuardProps & {
  requirement: Parameters<typeof policy.can>[1];
};

export function PermissionGuard({
  requirement,
  children,
}: PermissionGuardProps) {
  const { user, isLoading, isSessionRestoreFailed } = useAuth();

  if (isLoading || isSessionRestoreFailed) return null;
  if (!user) return <Navigate to={routes.auth.signIn} replace />;

  if (!policy.can(user.data.permissions, requirement)) {
    return <Navigate to={routes.system.forbidden} replace />;
  }

  return <>{children}</>;
}
