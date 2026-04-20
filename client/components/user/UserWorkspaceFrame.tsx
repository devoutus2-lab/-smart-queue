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
          <div className="rounded-[1.35rem] bg-gradient-to-br from-slate-950 via-blue-900 to-blue-700 p-5 text-white sm:rounded-[1.5rem] sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              {profile?.avatarUrl ? (
                <img alt={profile.name} className="h-14 w-14 rounded-2xl object-cover sm:h-16 sm:w-16" src={profile.avatarUrl} />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold sm:h-16 sm:w-16 sm:text-xl">{initials}</div>
              )}
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300 sm:text-xs sm:tracking-[0.25em]">{displayName}</div>
                <div className="mt-1 text-lg font-bold sm:text-xl">{greetingLabel}</div>
                <div className="text-sm text-blue-100">{profile?.email ?? displayUser?.email}</div>
              </div>
            </div>
            <div className="mt-5 rounded-[1.2rem] border border-white/10 bg-white/10 p-4 text-sm leading-6 text-blue-100 sm:mt-6 sm:rounded-[1.4rem]">
              {dashboard?.recommendation?.message ?? "Your upcoming visits and saved places stay organized here."}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:mt-6 lg:grid-cols-1">
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
