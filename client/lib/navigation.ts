import type { Role } from "@shared/api";

export function getHomeRouteForRole(role: Role) {
  switch (role) {
    case "owner":
      return "/business-dashboard";
    case "admin":
      return "/admin-panel";
    case "user":
    default:
      return "/account";
  }
}

export function getRoleWorkspaceLabel(role: Role) {
  switch (role) {
    case "owner":
      return "Business dashboard";
    case "admin":
      return "Admin panel";
    case "user":
    default:
      return "Guest account";
  }
}

export function getSupportRouteForRole(role: Role) {
  switch (role) {
    case "owner":
      return "/business-dashboard/support";
    case "admin":
      return "/admin-panel/support";
    case "user":
    default:
      return "/account/support";
  }
}
