import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AuthPayload, UserDashboard, UserProfile } from "@shared/api";
import {
  Bell,
  CalendarClock,
  Clock3,
  LifeBuoy,
  MapPin,
  MessageSquareMore,
  ReceiptText,
  Search,
  Settings2,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import RoleWorkspaceShell from "@/components/RoleWorkspaceShell";
import { useSession } from "@/context/SessionContext";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

function getTimeGreeting(name: string) {
  const hour = new Date().getHours();
  const period = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  return `${period}, ${name}!`;
}

type UserWorkspaceFrameContext = {
  dashboard: UserDashboard | undefined;
  profile: UserProfile | undefined;
  displayUser: AuthPayload["user"] | undefined;
  initials: string;
};

type UserWorkspaceFrameProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  activePathOverride?: string;
  dashboardOverride?: UserDashboard;
  profileOverride?: UserProfile;
  userOverride?: AuthPayload["user"];
  extraAside?: ReactNode;
  children: ReactNode | ((context: UserWorkspaceFrameContext) => ReactNode);
};

export default function UserWorkspaceFrame({
  title,
  subtitle,
  badge,
  activePathOverride,
  dashboardOverride,
  profileOverride,
  userOverride,
  extraAside,
  children,
}: UserWorkspaceFrameProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useSession();
  useRealtimeInvalidation();
  const scope = getAccountScope(userOverride ?? user);

  const dashboardQuery = useQuery({
    queryKey: accountQueryKeys.userDashboard(scope.userId),
    queryFn: api.getUserDashboard,
    refetchInterval: 30_000,
    enabled: dashboardOverride == null,
  });
  const profileQuery = useQuery({
    queryKey: accountQueryKeys.profile(scope.userId),
    queryFn: api.getProfile,
    enabled: profileOverride == null,
  });
  const notificationsQuery = useQuery({
    queryKey: accountQueryKeys.notifications(scope.role, scope.userId),
    queryFn: api.getNotifications,
    enabled: dashboardOverride == null,
    refetchInterval: 30_000,
  });

  const dashboard = dashboardOverride ?? dashboardQuery.data;
  const profile = profileOverride ?? profileQuery.data?.profile;
  const displayUser = userOverride ?? user;
  const displayName = (profile?.name ?? displayUser?.name ?? "User").trim();
  const resolvedBadge = badge ?? displayName;
  const greetingLabel = getTimeGreeting(displayName);
  const unreadNotifications = notificationsQuery.data?.notifications.filter((item) => !item.isRead).length ?? 0;
  const initials = useMemo(
    () =>
      displayName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [displayName],
  );

  const content =
    typeof children === "function"
      ? children({
          dashboard,
          profile,
          displayUser,
          initials,
        })
      : children;

  return (
    <RoleWorkspaceShell
      badge={resolvedBadge}
      title={title}
      subtitle={subtitle}
      navItems={[
        { to: "/account", label: "Home", icon: Sparkles },
        { to: "/account/search", label: "Search", icon: Search },
        { to: "/account/queues", label: "Live queues", icon: Clock3 },
        { to: "/account/map", label: "Map view", icon: MapPin },
        { to: "/account/appointments", label: "Appointments", icon: CalendarClock },
        { to: "/account/receipts", label: "Receipts", icon: ReceiptText },
        { to: "/account/messages", label: "Messages", icon: MessageSquareMore },
        { to: "/account/support", label: "Support", icon: LifeBuoy },
        { to: "/account/notifications", label: "Notifications", icon: Bell, badgeCount: unreadNotifications },
        { to: "/account/profile", label: "Profile", icon: UserCircle2 },
        { to: "/account/settings", label: "Settings", icon: Settings2 },
      ]}
      activePath={activePathOverride ?? location.pathname}
      homeLabel="Browse businesses"
      homeTo="/"
      onSignOut={async () => {
        await logout();
        navigate("/login");
      }}
      aside={
        <>
          <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-blue-900 to-blue-700 p-6 text-white">
            <div className="flex items-center gap-4">
              {profile?.avatarUrl ? (
                <img alt={profile.name} className="h-16 w-16 rounded-2xl object-cover" src={profile.avatarUrl} />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold">{initials}</div>
              )}
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-amber-300">{displayName}</div>
                <div className="mt-1 text-xl font-bold">{greetingLabel}</div>
                <div className="text-sm text-blue-100">{profile?.email ?? displayUser?.email}</div>
              </div>
            </div>
            <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/10 p-4 text-sm leading-6 text-blue-100">
              {dashboard?.recommendation?.message ?? "Your upcoming visits and saved places stay organized here."}
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Live queues</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{dashboard?.activeEntries.length ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Appointments</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {dashboard?.upcomingAppointments.length ?? 0}
              </div>
            </div>
          </div>

          {extraAside ? <div className="mt-6">{extraAside}</div> : null}
        </>
      }
    >
      {content}
    </RoleWorkspaceShell>
  );
}
