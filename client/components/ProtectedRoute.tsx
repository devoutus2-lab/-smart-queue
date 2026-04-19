import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AppLoadingState } from "@/components/AppLoadingState";
import { useSession } from "@/context/SessionContext";
import { getHomeRouteForRole } from "@/lib/navigation";

export default function ProtectedRoute({
  children,
  role,
}: {
  children: ReactNode;
  role?: "user" | "owner" | "admin";
}) {
  const { user, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) {
    return <AppLoadingState title="Preparing your space" message="We’re opening the right view for you and syncing the latest account state." />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    return <Navigate to={getHomeRouteForRole(user.role)} replace state={{ redirectedFrom: location.pathname }} />;
  }

  return <>{children}</>;
}
