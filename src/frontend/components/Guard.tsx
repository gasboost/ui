import { useBootstrap } from "@gasboost/bootstrap/react";
import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { policy } from "../../shared/policy";
import { routes } from "../../shared/routes";
import { useAuth } from "../contexts/AuthContext";

export function BootstrapGuard() {
  const { initialized } = useBootstrap();
  const { search } = useLocation();
  if (!initialized) {
    return (
      <Navigate to={{ pathname: routes.system.bootstrap, search }} replace />
    );
  }

  return <Outlet />;
}

type GuardProps = { children: ReactNode };

export function AuthGuard() {
  const { user, isLoading, isSessionRestoreFailed } = useAuth();

  if (isLoading || isSessionRestoreFailed) return null;
  if (!user) return <Navigate to={routes.auth.signIn} replace />;

  return <Outlet />;
}

type PermissionGuardProps = GuardProps & {
  requirement: Parameters<typeof policy.can>[1];
};

export function PermissionGuard({ requirement }: PermissionGuardProps) {
  const { user, isLoading, isSessionRestoreFailed } = useAuth();

  if (isLoading || isSessionRestoreFailed) return null;
  if (!user) return <Navigate to={routes.auth.signIn} replace />;

  if (!policy.can(user.data.permissions, requirement)) {
    return <Navigate to={routes.system.forbidden} replace />;
  }

  return <Outlet />;
}
