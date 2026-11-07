import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { policy } from "../../shared/policy";
import { routes } from "../../shared/routes";
import { useAuth } from "../contexts/AuthContext";

type GuardProps = { children: ReactNode };

export function AuthGuard({ children }: GuardProps) {
  const { user, isLoading, isSessionRestoreFailed } = useAuth();

  if (isLoading || isSessionRestoreFailed) return null;
  if (!user) return <Navigate to={routes.user.login} replace />;

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
  if (!user) return <Navigate to={routes.user.login} replace />;

  if (!policy.can(user.data.permissions, requirement)) {
    return <Navigate to={routes.system.forbidden} replace />;
  }

  return <>{children}</>;
}
