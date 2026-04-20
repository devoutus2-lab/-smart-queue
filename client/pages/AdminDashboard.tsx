import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  History,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Search,
  Settings2,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AdminAssistantAnalytics, AdminBusinessInput, AdminPlatformSettings, BusinessCategory } from "@shared/api";
import RoleWorkspaceShell from "@/components/RoleWorkspaceShell";
import { PasswordInput } from "@/components/ui/password-input";
import { SupportInboxPanel } from "@/components/SupportInboxPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import { api } from "@/lib/api";

type AdminSection =
  | "overview"
  | "analytics"
  | "assistant"
  | "businesses"
  | "claims"
  | "owners"
  | "accounts"
  | "subscriptions"
  | "support"
  | "moderation"
  | "announcements"
  | "activity"
  | "settings";

const defaultHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openTime: "09:00",
  closeTime: "17:00",
  isClosed: dayOfWeek === 0 || dayOfWeek === 6,
}));

const initialBusinessForm: AdminBusinessInput = {
  slug: "",
  name: "",
  category: "retail",
  description: "",
  address: "",
  phone: "",
  email: "",
  latitude: 40.7128,
  longitude: -74.006,
  rating: 4.5,
  reviewsCount: 0,
  imageUrl: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
  tags: ["new"],
  queueSettings: {
    averageServiceMinutes: 15,
    maxSkips: 2,
    maxReschedules: 2,
    pauseLimitMinutes: 30,
    bookingHorizonDays: 14,
    isQueueOpen: false,
  },
  hours: defaultHours,
  services: [
    {
      name: "General service",
      description: "Default front-desk lane for walk-in support.",
      averageServiceMinutes: 15,
      maxActiveQueue: 20,
      supportsAppointments: true,
      isActive: true,
    },
  ],
  counters: [
    {
      name: "Main counter",
      status: "open",
      activeServiceIds: [],
      assignedStaffName: "",
    },
  ],
};

const defaultSettings: AdminPlatformSettings = {
  assistantSupportEscalationEnabled: true,
  supportAutoAssignEnabled: true,
  defaultQueuePauseLimitMinutes: 30,
  defaultBookingHorizonDays: 14,
  claimsRequireManualReview: true,
};

function getAdminSection(pathname: string): AdminSection {
  if (pathname === "/admin-panel/analytics") return "analytics";
  if (pathname === "/admin-panel/assistant") return "assistant";
  if (pathname === "/admin-panel/businesses") return "businesses";
  if (pathname === "/admin-panel/claims") return "claims";
  if (pathname === "/admin-panel/owners") return "owners";
  if (pathname === "/admin-panel/accounts") return "accounts";
  if (pathname === "/admin-panel/subscriptions") return "subscriptions";
  if (pathname === "/admin-panel/support") return "support";
  if (pathname === "/admin-panel/moderation") return "moderation";
  if (pathname === "/admin-panel/announcements") return "announcements";
  if (pathname === "/admin-panel/activity") return "activity";
  if (pathname === "/admin-panel/settings") return "settings";
  return "overview";
}

function badgeClass(status: string) {
  if (["active", "published", "resolved", "trial"].includes(status)) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  }
  if (["suspended", "escalated", "urgent", "dismissed", "cancelled", "expired", "past_due"].includes(status)) {
    return "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
  }
  if (["pending", "draft", "in_progress"].includes(status)) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  }
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)));
}

function requestDeleteConfirmation(kind: "account" | "business", label: string) {
  const expected = kind === "business" ? "DELETE BUSINESS" : "DELETE ACCOUNT";
  const confirmation = window.prompt(
    kind === "business"
      ? `Delete "${label}" permanently?\nThis action cannot be undone.\nType ${expected} to confirm.`
      : `Delete "${label}" permanently?\nThis action cannot be undone.\nType ${expected} to confirm.`,
    "",
  );

  const value = confirmation?.trim() ?? null;
  if (!value) return null;
  if (value !== expected) {
    window.alert(`Deletion cancelled. Please type ${expected} exactly.`);
    return null;
  }

  return value;
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="stat-shell p-6">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-3 text-4xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      {hint ? <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  );
}

function InlineWarning({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { logout } = useSession();
  const section = getAdminSection(location.pathname);

  const overviewQuery = useQuery({ queryKey: ["admin-overview"], queryFn: api.getAdminOverview });
  const analyticsQuery = useQuery({ queryKey: ["admin-analytics"], queryFn: api.getAdminAnalytics });
  const assistantAnalyticsQuery = useQuery({ queryKey: ["admin-assistant-analytics"], queryFn: api.getAdminAssistantAnalytics });
  const commandCenterQuery = useQuery({ queryKey: ["admin-command-center"], queryFn: api.getAdminCommandCenter });
  const businessesQuery = useQuery({ queryKey: ["admin-businesses"], queryFn: api.getAdminBusinesses });
  const claimsQuery = useQuery({ queryKey: ["admin-claims"], queryFn: api.getAdminClaimRequests });
  const accountsQuery = useQuery({ queryKey: ["admin-accounts"], queryFn: api.getAdminAccounts });
  const subscriptionsQuery = useQuery({ queryKey: ["admin-subscriptions"], queryFn: api.getAdminSubscriptions });
  const announcementsQuery = useQuery({ queryKey: ["admin-announcements"], queryFn: api.getAdminAnnouncements });
  const activityQuery = useQuery({ queryKey: ["admin-activity"], queryFn: api.getAdminActivityLog });
  const settingsQuery = useQuery({ queryKey: ["admin-platform-settings"], queryFn: api.getAdminPlatformSettings });

  const businesses = businessesQuery.data?.businesses ?? [];
  const claims = claimsQuery.data?.claims ?? [];
  const accounts = accountsQuery.data?.accounts ?? [];
  const owners = accounts.filter((account) => account.role === "owner");
  const subscriptions = subscriptionsQuery.data?.subscriptions ?? [];
  const announcements = announcementsQuery.data?.announcements ?? [];
  const activity = activityQuery.data?.activity ?? [];
  const commandCenter = commandCenterQuery.data;
  const analytics = analyticsQuery.data;
  const assistantAnalytics: AdminAssistantAnalytics | undefined = assistantAnalyticsQuery.data;

  const [search, setSearch] = useState("");
  const [businessForm, setBusinessForm] = useState(initialBusinessForm);
  const [businessDraft, setBusinessDraft] = useState({
    name: "",
    category: "retail" as BusinessCategory,
    description: "",
    address: "",
    phone: "",
    email: "",
    websiteUrl: "",
    recordStatus: "active" as "active" | "suspended",
    moderationReason: "",
  });
  const [ownerForm, setOwnerForm] = useState({ name: "", email: "", password: "password123", businessId: "" });
  const [announcementForm, setAnnouncementForm] = useState<{
    title: string;
    message: string;
    audience: "users" | "owners" | "all";
    status: "draft" | "published" | "archived";
  }>({
    title: "",
    message: "",
    audience: "all",
    status: "draft",
  });
  const [settingsForm, setSettingsForm] = useState(defaultSettings);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [lastResetLink, setLastResetLink] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBusinessId && businesses.length) setSelectedBusinessId(businesses[0].id);
    if (!selectedAccountId && accounts.length) setSelectedAccountId(accounts[0].id);
    if (!selectedOwnerId && owners.length) setSelectedOwnerId(owners[0].id);
  }, [accounts, businesses, owners, selectedAccountId, selectedBusinessId, selectedOwnerId]);

  useEffect(() => {
    if (!settingsQuery.data?.settings) return;
    setSettingsForm(settingsQuery.data.settings);
  }, [settingsQuery.data?.settings]);

  const selectedBusiness = businesses.find((item) => item.id === selectedBusinessId) ?? null;
  const selectedAccount = accounts.find((item) => item.id === selectedAccountId) ?? null;
  const selectedOwner = owners.find((item) => item.id === selectedOwnerId) ?? null;

  useEffect(() => {
    if (!selectedBusiness) return;
    setBusinessDraft({
      name: selectedBusiness.name,
      category: selectedBusiness.category,
      description: selectedBusiness.description,
      address: selectedBusiness.address,
      phone: selectedBusiness.phone ?? "",
      email: selectedBusiness.email ?? "",
      websiteUrl: selectedBusiness.websiteUrl ?? "",
      recordStatus: selectedBusiness.recordStatus,
      moderationReason: selectedBusiness.moderationReason ?? "",
    });
  }, [selectedBusiness]);

  const filteredBusinesses = useMemo(
    () =>
      businesses.filter((item) => {
        if (!search) return true;
        const term = search.toLowerCase();
        return item.name.toLowerCase().includes(term) || item.ownerName?.toLowerCase().includes(term) || item.address.toLowerCase().includes(term);
      }),
    [businesses, search],
  );

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((item) => {
        if (!search) return true;
        const term = search.toLowerCase();
        return item.name.toLowerCase().includes(term) || item.email.toLowerCase().includes(term) || item.businessName?.toLowerCase().includes(term);
      }),
    [accounts, search],
  );

  const suspendedBusinesses = businesses.filter((item) => item.recordStatus === "suspended");
  const suspendedAccounts = accounts.filter((item) => item.accountStatus === "suspended");
  const flaggedBusinesses = businesses.filter((item) => Object.values(item.healthFlags).some(Boolean));
  const flaggedAccounts = accounts.filter((item) => Object.values(item.healthFlags).some(Boolean));
  const recentAnnouncements = announcements.slice(0, 8);
  const roleDistribution = analytics?.roleDistribution ?? {
    users: 0,
    owners: 0,
    businesses: 0,
    total: 0,
  };
  const donutTotal = Math.max(roleDistribution.total, 1);
  const donutCircumference = 2 * Math.PI * 42;
  const donutSegments = [
    { label: "Users", short: "U", value: roleDistribution.users, color: "#3d8bff" },
    { label: "Owners", short: "O", value: roleDistribution.owners, color: "#ff6a3d" },
    { label: "Businesses", short: "B", value: roleDistribution.businesses, color: "#1ecb6b" },
  ];
  const donutOffsets = donutSegments.reduce<number[]>((acc, segment, index) => {
    const previous = index === 0 ? 0 : acc[index - 1] + (donutSegments[index - 1].value / donutTotal) * donutCircumference;
    acc.push(previous);
    return acc;
  }, []);
  const trendDays = analytics?.last7Days ?? [];
  const maxTrendValue = Math.max(...trendDays.map((day) => day.completedQueues), 1);
  const trendPoints = trendDays
    .map((day, index) => {
      const x = 24 + index * 52;
      const y = 112 - (day.completedQueues / maxTrendValue) * 76;
      return `${x},${y}`;
    })
    .join(" ");

  const refreshAdmin = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-assistant-analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-command-center"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-businesses"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-claims"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-activity"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] }),
      queryClient.invalidateQueries({ queryKey: ["support-conversations"] }),
    ]);
  };

  const createBusinessMutation = useMutation({
    mutationFn: api.createAdminBusiness,
    onSuccess: async () => {
      setBusinessForm(initialBusinessForm);
      await refreshAdmin();
    },
  });

  const createOwnerMutation = useMutation({
    mutationFn: api.createOwner,
    onSuccess: async () => {
      setOwnerForm({ name: "", email: "", password: "password123", businessId: "" });
      await refreshAdmin();
    },
  });

  const updateBusinessMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: typeof businessDraft }) => api.updateAdminBusiness(id, payload),
    onSuccess: refreshAdmin,
  });

  const assignOwnerMutation = useMutation({
    mutationFn: ({ businessId, ownerUserId }: { businessId: number; ownerUserId: number | null }) => api.assignAdminBusinessOwner(businessId, { ownerUserId }),
    onSuccess: refreshAdmin,
  });

  const accountStatusMutation = useMutation({
    mutationFn: ({ id, accountStatus, moderationReason }: { id: number; accountStatus: "active" | "suspended"; moderationReason: string }) =>
      api.updateAdminAccountStatus(id, { accountStatus, moderationReason }),
    onSuccess: refreshAdmin,
  });

  const forceResetMutation = useMutation({
    mutationFn: (id: number) => api.forceAdminAccountReset(id),
    onSuccess: async (response) => {
      setLastResetLink(response.resetLinkPreview ?? null);
      await refreshAdmin();
    },
  });

  const transferOwnerMutation = useMutation({
    mutationFn: ({ id, businessId }: { id: number; businessId: number | null }) => api.transferAdminOwnerBusiness(id, { businessId }),
    onSuccess: refreshAdmin,
  });

  const deleteBusinessMutation = useMutation({
    mutationFn: ({ id, confirmation }: { id: number; confirmation: string }) => api.deleteAdminBusiness(id, { confirmation }),
    onSuccess: async (_response, variables) => {
      if (selectedBusinessId === variables.id) setSelectedBusinessId(null);
      await refreshAdmin();
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: ({ id, confirmation }: { id: number; confirmation: string }) => api.deleteAdminAccount(id, { confirmation }),
    onSuccess: async (_response, variables) => {
      if (selectedAccountId === variables.id) setSelectedAccountId(null);
      if (selectedOwnerId === variables.id) setSelectedOwnerId(null);
      setLastResetLink((current) => (selectedAccountId === variables.id || selectedOwnerId === variables.id ? null : current));
      await refreshAdmin();
    },
  });

  const claimReviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "dismissed" | "imported" }) => api.reviewAdminClaimRequest(id, { status, reviewNotes: status === "dismissed" ? "Reviewed in admin console." : "" }),
    onSuccess: refreshAdmin,
  });

  const claimImportMutation = useMutation({
    mutationFn: async (claimId: number) => {
      const claim = claims.find((item) => item.id === claimId);
      if (!claim) throw new Error("Claim not found");
      await api.importAdminBusiness({
        provider: claim.provider,
        placeId: claim.placeId,
        name: claim.businessName,
        category: claim.category,
        description: `${claim.businessName} imported from an admin-reviewed claim request.`,
        address: claim.address,
        phone: claim.phone ?? "",
        email: claim.email ?? "",
        websiteUrl: claim.websiteUrl ?? "",
        latitude: claim.latitude,
        longitude: claim.longitude,
        imageUrl: claim.imageUrl,
        rating: 0,
        reviewsCount: 0,
        tags: ["imported", claim.category],
      });
      await api.reviewAdminClaimRequest(claimId, { status: "imported", reviewNotes: "Imported into the Smart Queue directory." });
    },
    onSuccess: refreshAdmin,
  });

  const subscriptionMutation = useMutation({
    mutationFn: ({ businessId, plan, interval, status }: { businessId: number; plan: "starter" | "growth" | "premium"; interval: "monthly" | "yearly"; status: "trial" | "active" | "cancelled" | "expired" | "past_due" }) =>
      api.updateAdminSubscription(businessId, { plan, interval, status }),
    onSuccess: refreshAdmin,
  });

  const announcementMutation = useMutation({
    mutationFn: api.createAdminAnnouncement,
    onSuccess: async () => {
      setAnnouncementForm({ title: "", message: "", audience: "all", status: "draft" });
      await refreshAdmin();
    },
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "draft" | "published" | "archived" }) => {
      const current = announcements.find((item) => item.id === id);
      if (!current) throw new Error("Announcement not found");
      return api.updateAdminAnnouncement(id, {
        title: current.title,
        message: current.message,
        audience: current.audience,
        status,
      });
    },
    onSuccess: refreshAdmin,
  });

  const settingsMutation = useMutation({
    mutationFn: api.updateAdminPlatformSettings,
    onSuccess: refreshAdmin,
  });

  const navItems: { to: string; label: string; icon: LucideIcon; badgeCount?: number }[] = [
    { to: "/admin-panel", label: "Overview", icon: LayoutDashboard },
    { to: "/admin-panel/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/admin-panel/assistant", label: "A.I. assistant", icon: BarChart3 },
    { to: "/admin-panel/businesses", label: "Businesses", icon: Building2 },
    { to: "/admin-panel/claims", label: "Claims", icon: ClipboardList, badgeCount: commandCenter?.pendingClaimsCount },
    { to: "/admin-panel/owners", label: "Owners", icon: UserPlus },
    { to: "/admin-panel/accounts", label: "Accounts", icon: Users },
    { to: "/admin-panel/subscriptions", label: "Subscriptions", icon: CreditCard, badgeCount: commandCenter?.expiringSubscriptionsCount },
    { to: "/admin-panel/support", label: "Support", icon: LifeBuoy, badgeCount: commandCenter?.unresolvedSupportCount },
    { to: "/admin-panel/moderation", label: "Moderation", icon: ShieldAlert, badgeCount: suspendedAccounts.length + suspendedBusinesses.length },
    { to: "/admin-panel/announcements", label: "Announcements", icon: Megaphone },
    { to: "/admin-panel/activity", label: "Activity", icon: History },
    { to: "/admin-panel/settings", label: "Settings", icon: Settings2 },
  ];

  const canDeleteSelectedBusiness = selectedBusiness?.recordStatus === "suspended";
  const canDeleteSelectedAccount = selectedAccount?.accountStatus === "suspended" && selectedAccount.role !== "admin";
  const canDeleteSelectedOwner = selectedOwner?.accountStatus === "suspended";
  const selectedBusinessWarnings = selectedBusiness
    ? [
        selectedBusiness.healthFlags.missingOwnerAssignment ? "This business does not currently have an assigned owner." : null,
        selectedBusiness.healthFlags.missingContactDetails ? "Business contact details are incomplete, which weakens directory trust." : null,
        selectedBusiness.healthFlags.highSupportLoad ? "This business is generating a high support load and may need admin follow-up." : null,
        selectedBusiness.healthFlags.needsModerationNote ? "This suspended business is missing a moderation reason." : null,
      ].filter(Boolean)
    : [];
  const selectedAccountWarnings = selectedAccount
    ? [
        selectedAccount.healthFlags.missingBusinessAssignment ? "This owner account is active but has no business assignment." : null,
        selectedAccount.healthFlags.highSupportLoad ? "This account is linked to a high support load." : null,
        selectedAccount.healthFlags.hasNoRecentSignIn ? "This account has not signed in recently." : null,
        selectedAccount.healthFlags.needsModerationNote ? "This suspended account is missing a moderation reason." : null,
      ].filter(Boolean)
    : [];

  return (
    <RoleWorkspaceShell
      badge="Admin panel"
      title="Platform operations"
      subtitle="Run Smart Queue like a real operations console with routing, triage, moderation, claims, subscriptions, and platform-wide settings."
      navItems={navItems}
      activePath={location.pathname}
      homeLabel="View public site"
      homeTo="/"
      onSignOut={async () => {
        await logout();
        navigate("/login");
      }}
      aside={
        <div className="space-y-5">
          <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 p-6 text-white">
            <div className="text-xs uppercase tracking-[0.25em] text-amber-200">Operations pulse</div>
            <div className="mt-3 text-2xl font-bold">{commandCenter?.operationsSummary.title ?? "Admin operations"}</div>
            <div className="mt-2 text-sm leading-6 text-blue-100">{commandCenter?.operationsSummary.message ?? "Platform queues, governance, and support load appear here."}</div>
            <Button className="mt-5 w-full bg-white/10 text-white hover:bg-white/20" variant="outline" onClick={() => navigate(commandCenter?.operationsSummary.primaryActionHref ?? "/admin-panel")}>
              {commandCenter?.operationsSummary.primaryActionLabel ?? "Open overview"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="section-shell panel-roomy">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Urgent queues</div>
            <div className="mt-4 grid gap-3">
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Escalated support</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{commandCenter?.supportQueue.escalatedCount ?? 0}</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Stale claims</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{commandCenter?.claimsQueue.stalePendingCount ?? 0}</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Suspended records</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{(commandCenter?.suspendedAccountsCount ?? 0) + (commandCenter?.suspendedBusinessesCount ?? 0)}</div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {section === "overview" ? (
        <section className="space-y-6">
          <div className="section-shell panel-roomy">
            <div className="toolbar-row">
              <div>
                <h2 className="section-heading text-slate-900 dark:text-slate-100">Command center</h2>
                <p className="subtle-lead mt-2">The admin overview now highlights the most important queue of work first instead of treating every module as equally urgent.</p>
              </div>
              <Button className="site-primary-button" onClick={() => navigate(commandCenter?.operationsSummary.primaryActionHref ?? "/admin-panel")}>
                {commandCenter?.operationsSummary.primaryActionLabel ?? "Open overview"}
              </Button>
            </div>
            <div className="mt-6 rounded-[1.6rem] border border-blue-100 bg-blue-50/70 p-6 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Highest priority now</div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{commandCenter?.operationsSummary.title ?? "Admin operations"}</div>
              <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{commandCenter?.operationsSummary.message}</div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Database mode</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{commandCenter?.deployHealth.provider ?? "sqlite"}</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{commandCenter?.deployHealth.persistenceMode ?? "unknown"}</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Storage durability</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {commandCenter?.deployHealth.persistenceDurable ? "Durable" : "Temporary"}
                </div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{commandCenter?.deployHealth.location ?? "Unavailable"}</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Hosted app URL</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">
                  {commandCenter?.deployHealth.appUrl ?? "Missing APP_URL"}
                </div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Trust proxy: {String(commandCenter?.deployHealth.trustProxy ?? "unknown")}</div>
              </div>
            </div>
          </div>

          <div className="kpi-grid">
            <StatCard label="Users" value={overviewQuery.data?.usersCount ?? 0} />
            <StatCard label="Owners" value={overviewQuery.data?.ownersCount ?? 0} />
            <StatCard label="Businesses" value={overviewQuery.data?.businessesCount ?? 0} />
            <StatCard label="Open support" value={commandCenter?.unresolvedSupportCount ?? 0} />
            <StatCard label="Pending claims" value={commandCenter?.pendingClaimsCount ?? 0} />
            <StatCard label="Expiring subscriptions" value={commandCenter?.expiringSubscriptionsCount ?? 0} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="section-shell panel-roomy">
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Priority queues</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[
                  { label: "Support triage", value: commandCenter?.supportQueue.escalatedCount ?? 0, hint: `${commandCenter?.supportQueue.unassignedCount ?? 0} unassigned`, to: "/admin-panel/support" },
                  { label: "Claims review", value: commandCenter?.claimsQueue.stalePendingCount ?? 0, hint: `${commandCenter?.claimsQueue.importReadyCount ?? 0} import-ready`, to: "/admin-panel/claims" },
                  { label: "Moderation", value: suspendedAccounts.length + suspendedBusinesses.length, hint: `${(commandCenter?.moderationQueue.accountsMissingReasonCount ?? 0) + (commandCenter?.moderationQueue.businessesMissingReasonCount ?? 0)} missing reasons`, to: "/admin-panel/moderation" },
                  { label: "Subscriptions", value: commandCenter?.expiringSubscriptionsCount ?? 0, hint: "Renewal window", to: "/admin-panel/subscriptions" },
                ].map((item) => (
                  <button key={item.label} className="info-card text-left" onClick={() => navigate(item.to)} type="button">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{item.label}</div>
                    <div className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-100">{item.value}</div>
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="section-shell panel-roomy">
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Operational warnings</h2>
              <div className="mt-5 space-y-3">
                {commandCenter?.deployHealth.storageWarning ? <InlineWarning>{commandCenter.deployHealth.storageWarning}</InlineWarning> : null}
                {(commandCenter?.supportQueue.staleCount ?? 0) > 0 ? <InlineWarning>{commandCenter?.supportQueue.staleCount} support conversation(s) have been unresolved for more than two days.</InlineWarning> : null}
                {(commandCenter?.claimsQueue.stalePendingCount ?? 0) > 0 ? <InlineWarning>{commandCenter?.claimsQueue.stalePendingCount} claim request(s) have been pending for more than three days.</InlineWarning> : null}
                {(commandCenter?.moderationQueue.accountsMissingReasonCount ?? 0) + (commandCenter?.moderationQueue.businessesMissingReasonCount ?? 0) > 0 ? (
                  <InlineWarning>{(commandCenter?.moderationQueue.accountsMissingReasonCount ?? 0) + (commandCenter?.moderationQueue.businessesMissingReasonCount ?? 0)} suspended record(s) are missing a moderation reason.</InlineWarning>
                ) : null}
                {!(
                  commandCenter?.deployHealth.storageWarning
                  || (commandCenter?.supportQueue.staleCount ?? 0)
                  || (commandCenter?.claimsQueue.stalePendingCount ?? 0)
                  || ((commandCenter?.moderationQueue.accountsMissingReasonCount ?? 0) + (commandCenter?.moderationQueue.businessesMissingReasonCount ?? 0))
                ) ? (
                  <div className="empty-panel">No urgent warnings are blocking the admin queue right now.</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="section-shell panel-roomy">
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Governance watchlist</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Businesses needing review</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{flaggedBusinesses.length}</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Missing owners, incomplete contact details, high support load, or weak moderation context.</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Accounts needing review</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{flaggedAccounts.length}</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Missing assignments, old sign-in history, heavy support load, or weak moderation context.</div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="section-shell panel-roomy">
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Recent platform activity</h2>
              <div className="mt-5 space-y-3">
                {(commandCenter?.recentActivity ?? []).slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{item.summary}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {item.adminName ?? "System"} | {formatTimestamp(item.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-shell panel-roomy">
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Recent owner signups</h2>
              <div className="mt-5 grid gap-4">
                {(commandCenter?.recentOwnerSignups ?? []).slice(0, 6).map((owner) => (
                  <div key={owner.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{owner.name}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{owner.email}</div>
                    <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {owner.businessName ?? "No business assigned"}
                    </div>
                    {owner.healthFlags.missingBusinessAssignment ? <div className="mt-3 text-sm text-amber-700 dark:text-amber-300">Needs business assignment before the owner workflow is fully usable.</div> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {section === "analytics" ? (
        <section className="space-y-6">
          <div className="mx-auto max-w-6xl">
            <div className="group relative">
              <div className="absolute -inset-1 rounded-[1.5rem] bg-gradient-to-r from-emerald-600 to-sky-600 opacity-25 blur transition duration-500 group-hover:opacity-50" />
              <div className="relative overflow-hidden rounded-[1.5rem] bg-white p-6 shadow-xl dark:bg-gray-900">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-xl font-bold text-transparent">
                      Platform Analytics
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Smart Queue Admin Dashboard</p>
                  </div>

                  <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 dark:bg-emerald-900/20">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Live</span>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-4 dark:from-gray-800 dark:to-gray-900">
                    <div className="relative z-10">
                      <span className="block text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {analytics?.hero.queueCompletionRate ?? 0}%
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Queue Completion Rate</span>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-sky-500" />
                  </div>
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-4 dark:from-gray-800 dark:to-gray-900">
                    <div className="relative z-10">
                      <span className="block text-2xl font-bold text-sky-600 dark:text-sky-400">
                        {analytics?.hero.activeAccounts ?? 0}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Active Accounts</span>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-sky-500 to-emerald-500" />
                  </div>
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-4 dark:from-gray-800 dark:to-gray-900">
                    <div className="relative z-10">
                      <span className="block text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {analytics?.hero.platformGrowth ?? 0}%
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Platform Growth</span>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-sky-500" />
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <div className="mb-1 flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Monthly Activity Target</span>
                      <span>{analytics?.hero.monthlyTargetProgress ?? 0}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
                        style={{ width: `${analytics?.hero.monthlyTargetProgress ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex space-x-2">
                    {donutSegments.map((segment) => (
                      <div
                        key={segment.label}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium text-white"
                        style={{ background: `linear-gradient(135deg, ${segment.color}, ${segment.color}cc)` }}
                      >
                        {segment.short}
                      </div>
                    ))}
                  </div>

                  <Button
                    className="bg-gradient-to-r from-emerald-500 to-sky-500 text-white hover:scale-105 hover:from-emerald-600 hover:to-sky-600"
                    onClick={() => {
                      document.getElementById("admin-analytics-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div id="admin-analytics-details" className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-[18px] bg-[#232733] p-8 text-[#f3f6fa] shadow-[0_4px_24px_0_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between">
                <h2 className="bg-gradient-to-r from-white via-[#f3f6fa] to-[#e3e8ef] bg-clip-text text-[1.35rem] font-bold text-transparent">
                  Platform Distribution
                </h2>
                <div className="text-sm text-[#6c7383]">Live mix</div>
              </div>
              <div className="mt-6 flex justify-center">
                <svg viewBox="0 0 120 120" className="h-[170px] w-[170px]">
                  <circle cx="60" cy="60" r="42" fill="none" stroke="#1a1f29" strokeWidth="14" />
                  {donutSegments.map((segment, index) => {
                    const dash = (segment.value / donutTotal) * donutCircumference;
                    return (
                      <circle
                        key={segment.label}
                        cx="60"
                        cy="60"
                        r="42"
                        fill="none"
                        stroke={segment.color}
                        strokeWidth="14"
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${donutCircumference}`}
                        strokeDashoffset={-donutOffsets[index]}
                        transform="rotate(-90 60 60)"
                      />
                    );
                  })}
                  <text x="60" y="56" textAnchor="middle" className="fill-[#f3f6fa] text-[1.25rem] font-semibold">
                    {roleDistribution.total}
                  </text>
                  <text x="60" y="72" textAnchor="middle" className="fill-[#b0b6c3] text-[0.7rem]">
                    Entities
                  </text>
                </svg>
              </div>
              <div className="mt-5 space-y-3">
                {donutSegments.map((segment) => (
                  <div key={segment.label} className="flex items-center justify-between text-base text-[#b0b6c3]">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                      <span>{segment.label}</span>
                    </div>
                    <span className="text-xl font-semibold text-[#f3f6fa]">{segment.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[18px] bg-[#232733] p-8 text-[#f3f6fa] shadow-[0_4px_24px_0_rgba(0,0,0,0.18)] xl:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="bg-gradient-to-r from-white via-[#f3f6fa] to-[#e3e8ef] bg-clip-text text-[1.35rem] font-bold text-transparent">
                  Queue Activity Trend
                </h2>
                <div className="text-sm text-[#6c7383]">Last 7 days</div>
              </div>
              <div className="mt-6">
                <svg viewBox="0 0 360 140" className="h-[140px] w-full">
                  <polyline fill="none" stroke="#3d8bff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" points={trendPoints} />
                  {trendDays.map((day, index) => {
                    const x = 24 + index * 52;
                    const y = 112 - (day.completedQueues / maxTrendValue) * 76;
                    return (
                      <g key={day.date}>
                        <circle cx={x} cy={y} r="5" fill="#1ecb6b" />
                        <text x={x} y="134" textAnchor="middle" fill="#b0b6c3" fontSize="12">
                          {day.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-[#1b2029] p-4">
                  <div className="text-sm text-[#b0b6c3]">Best day</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{analytics?.insights.bestDayLabel ?? "N/A"}</div>
                </div>
                <div className="rounded-2xl bg-[#1b2029] p-4">
                  <div className="text-sm text-[#b0b6c3]">Completed queues</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{analytics?.hero.monthlyCompletedQueues ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-[#1b2029] p-4">
                  <div className="text-sm text-[#b0b6c3]">Top plan</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{analytics?.insights.topSubscriptionPlan ?? "none"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[18px] bg-[#232733] p-6 text-[#f3f6fa] shadow-[0_4px_24px_0_rgba(0,0,0,0.18)]">
              <div className="text-sm text-[#b0b6c3]">Pending Appointments</div>
              <div className="mt-3 text-3xl font-semibold">{analytics?.summary.pendingAppointmentsCount ?? 0}</div>
            </div>
            <div className="rounded-[18px] bg-[#232733] p-6 text-[#f3f6fa] shadow-[0_4px_24px_0_rgba(0,0,0,0.18)]">
              <div className="text-sm text-[#b0b6c3]">Active Subscriptions</div>
              <div className="mt-3 text-3xl font-semibold">{analytics?.summary.activeSubscriptionsCount ?? 0}</div>
            </div>
            <div className="rounded-[18px] bg-[#232733] p-6 text-[#f3f6fa] shadow-[0_4px_24px_0_rgba(0,0,0,0.18)]">
              <div className="text-sm text-[#b0b6c3]">Pending Claims</div>
              <div className="mt-3 text-3xl font-semibold">{analytics?.summary.pendingClaimsCount ?? 0}</div>
            </div>
            <div className="rounded-[18px] bg-[#232733] p-6 text-[#f3f6fa] shadow-[0_4px_24px_0_rgba(0,0,0,0.18)]">
              <div className="text-sm text-[#b0b6c3]">Support Load</div>
              <div className="mt-3 text-3xl font-semibold">{analytics?.insights.supportLoad ?? 0}</div>
            </div>
          </div>
        </section>
      ) : null}

      {section === "assistant" ? (
        <section className="space-y-6">
          <div className="kpi-grid">
            <StatCard label="Assistant sessions" value={assistantAnalytics?.totalAssistantSessions ?? 0} />
            <StatCard label="Resolved sessions" value={assistantAnalytics?.totalResolvedSessions ?? 0} hint={`${assistantAnalytics?.resolvedRate ?? 0}% resolved`} />
            <StatCard label="Escalations" value={assistantAnalytics?.totalEscalations ?? 0} hint={`${assistantAnalytics?.escalationRate ?? 0}% escalation rate`} />
            <StatCard label="Average rating" value={assistantAnalytics?.averageRating ?? 0} hint={`${assistantAnalytics?.totalRatings ?? 0} ratings received`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="section-shell panel-roomy">
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Assistant rating distribution</h2>
              <div className="mt-5 grid gap-3">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = assistantAnalytics?.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5] ?? 0;
                  const totalRatings = assistantAnalytics?.totalRatings ?? 0;
                  const share = totalRatings ? Math.round((count / totalRatings) * 100) : 0;
                  return (
                    <div key={rating} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{rating} star</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{count} ratings</div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#2457d6,#4c73ef,#d1a447)]" style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="section-shell panel-roomy">
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Recent low-rated assistant sessions</h2>
              {(assistantAnalytics?.totalEscalations ?? 0) > 0 ? (
                <div className="mt-4">
                  <InlineWarning>{assistantAnalytics?.totalEscalations} assistant session(s) escalated into support and may need process or knowledge improvements.</InlineWarning>
                </div>
              ) : null}
              <div className="mt-5 space-y-3">
                {assistantAnalytics?.recentLowRatedSessions.length ? (
                  assistantAnalytics.recentLowRatedSessions.map((item) => (
                    <div key={item.feedbackId} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{item.ownerName}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{item.role} • {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown time"}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${badgeClass(item.rating <= 2 ? "urgent" : "pending")}`}>
                          {item.rating}/5
                        </span>
                      </div>
                      <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                        {item.assistantMessage}
                      </div>
                      {item.comment ? (
                        <div className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Feedback note: {item.comment}</div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="empty-panel">No low-rated assistant sessions yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {section === "businesses" ? (
        <section className="grid gap-8 2xl:grid-cols-[0.9fr_1.1fr]">
          <div className="section-shell panel-roomy">
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Create business</h2>
            <div className="dense-form-grid mt-6">
              <Input placeholder="Slug" value={businessForm.slug} onChange={(event) => setBusinessForm((current) => ({ ...current, slug: event.target.value }))} />
              <Input placeholder="Business name" value={businessForm.name} onChange={(event) => setBusinessForm((current) => ({ ...current, name: event.target.value }))} />
              <select className="field-select" value={businessForm.category} onChange={(event) => setBusinessForm((current) => ({ ...current, category: event.target.value as BusinessCategory }))}>
                {["restaurant", "bank", "hospital", "government", "salon", "retail"].map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <Input placeholder="Email" value={businessForm.email} onChange={(event) => setBusinessForm((current) => ({ ...current, email: event.target.value }))} />
              <Input placeholder="Phone" value={businessForm.phone} onChange={(event) => setBusinessForm((current) => ({ ...current, phone: event.target.value }))} />
              <Input placeholder="Address" value={businessForm.address} onChange={(event) => setBusinessForm((current) => ({ ...current, address: event.target.value }))} />
            </div>
            <textarea className="field-textarea mt-5 min-h-[120px]" placeholder="Description" value={businessForm.description} onChange={(event) => setBusinessForm((current) => ({ ...current, description: event.target.value }))} />
            <Button className="site-primary-button mt-5" disabled={createBusinessMutation.isPending} onClick={() => createBusinessMutation.mutate(businessForm)}>
              {createBusinessMutation.isPending ? "Creating..." : "Create business"}
            </Button>
          </div>

          <div className="section-shell panel-roomy">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Search business or owner" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="mt-5 grid gap-6 2xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="min-w-0 space-y-3">
                {filteredBusinesses.map((business) => (
                  <button
                    key={business.id}
                    className={`w-full rounded-2xl border p-4 text-left ${
                      selectedBusinessId === business.id ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-slate-950" : "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                    onClick={() => setSelectedBusinessId(business.id)}
                    type="button"
                  >
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{business.name}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{business.ownerName ?? "No owner assigned"}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${badgeClass(business.recordStatus)}`}>{business.recordStatus}</span>
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {business.pendingClaimCount} claims
                      </span>
                      {Object.values(business.healthFlags).some(Boolean) ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          Needs review
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>

              {selectedBusiness ? (
                <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{selectedBusiness.name}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedBusiness.address}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${badgeClass(selectedBusiness.recordStatus)}`}>{selectedBusiness.recordStatus}</span>
                  </div>
                  <div className="dense-form-grid mt-5">
                    <Input value={businessDraft.name} onChange={(event) => setBusinessDraft((current) => ({ ...current, name: event.target.value }))} />
                    <select className="field-select" value={businessDraft.category} onChange={(event) => setBusinessDraft((current) => ({ ...current, category: event.target.value as BusinessCategory }))}>
                      {["restaurant", "bank", "hospital", "government", "salon", "retail"].map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <Input value={businessDraft.email} onChange={(event) => setBusinessDraft((current) => ({ ...current, email: event.target.value }))} />
                    <Input value={businessDraft.phone} onChange={(event) => setBusinessDraft((current) => ({ ...current, phone: event.target.value }))} />
                    <Input value={businessDraft.address} onChange={(event) => setBusinessDraft((current) => ({ ...current, address: event.target.value }))} />
                    <Input value={businessDraft.websiteUrl} placeholder="Website URL" onChange={(event) => setBusinessDraft((current) => ({ ...current, websiteUrl: event.target.value }))} />
                  </div>
                  <textarea className="field-textarea mt-4 min-h-[110px]" value={businessDraft.description} onChange={(event) => setBusinessDraft((current) => ({ ...current, description: event.target.value }))} />
                  <textarea className="field-textarea mt-4 min-h-[96px]" placeholder="Moderation reason" value={businessDraft.moderationReason} onChange={(event) => setBusinessDraft((current) => ({ ...current, moderationReason: event.target.value }))} />
                  <div className="mt-4 grid gap-4 2xl:grid-cols-2">
                    <select className="field-select" value={selectedBusiness.ownerId ? String(selectedBusiness.ownerId) : ""} onChange={(event) => assignOwnerMutation.mutate({ businessId: selectedBusiness.id, ownerUserId: event.target.value ? Number(event.target.value) : null })}>
                      <option value="">No owner assigned</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>{owner.name}</option>
                      ))}
                    </select>
                    <select className="field-select" value={businessDraft.recordStatus} onChange={(event) => setBusinessDraft((current) => ({ ...current, recordStatus: event.target.value as "active" | "suspended" }))}>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  {selectedBusinessWarnings.length ? (
                    <div className="mt-4 space-y-3">
                      {selectedBusinessWarnings.map((warning) => <InlineWarning key={warning}>{warning}</InlineWarning>)}
                    </div>
                  ) : null}
                  <div className="mt-5 grid gap-3 2xl:grid-cols-2">
                    <Button className="site-primary-button w-full" disabled={updateBusinessMutation.isPending} onClick={() => updateBusinessMutation.mutate({ id: selectedBusiness.id, payload: businessDraft })}>
                      Save business
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={updateBusinessMutation.isPending}
                      onClick={() =>
                        updateBusinessMutation.mutate({
                          id: selectedBusiness.id,
                          payload: {
                            ...businessDraft,
                            recordStatus: selectedBusiness.recordStatus === "active" ? "suspended" : "active",
                            moderationReason: selectedBusiness.recordStatus === "active" ? businessDraft.moderationReason || "Suspended from admin console." : "",
                          },
                        })
                      }
                    >
                      {selectedBusiness.recordStatus === "active" ? "Suspend business" : "Reactivate business"}
                    </Button>
                  </div>
                  <Button
                    className="mt-3 w-full border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    variant="outline"
                    disabled={!canDeleteSelectedBusiness || deleteBusinessMutation.isPending}
                    onClick={() => {
                      const confirmation = requestDeleteConfirmation("business", selectedBusiness.name);
                      if (!confirmation) return;
                      deleteBusinessMutation.mutate({ id: selectedBusiness.id, confirmation });
                    }}
                  >
                    Delete business
                  </Button>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {selectedBusiness.recordStatus === "active"
                      ? "Suspending a business now requires a moderation reason so the rest of the admin team has context."
                      : "Delete is available only after the business is suspended and reviewed."}
                  </div>
                </div>
              ) : (
                <div className="empty-panel">Select a business to manage.</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {section === "claims" ? (
        <section className="section-shell panel-roomy">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Claims and imports</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Review external place claims, import valid businesses, or dismiss duplicates and low-quality requests.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                {claims.filter((claim) => claim.status === "pending").length} pending
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {commandCenter?.claimsQueue.stalePendingCount ?? 0} stale
              </span>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            {claims.map((claim) => (
              <div key={claim.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{claim.businessName}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{claim.address}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Requested by {claim.requestedByName} | {claim.provider}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${badgeClass(claim.status)}`}>{claim.status}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button className="site-primary-button" disabled={claim.status !== "pending" || claimImportMutation.isPending} onClick={() => claimImportMutation.mutate(claim.id)}>
                    Import business
                  </Button>
                  <Button variant="outline" disabled={claim.status !== "pending" || claimReviewMutation.isPending} onClick={() => claimReviewMutation.mutate({ id: claim.id, status: "dismissed" })}>
                    Dismiss claim
                  </Button>
                </div>
                {claim.status === "pending" && daysSince(claim.createdAt) != null && daysSince(claim.createdAt)! >= 3 ? (
                  <div className="mt-3 text-sm text-amber-700 dark:text-amber-300">This claim has been pending for {daysSince(claim.createdAt)} days and should be reviewed soon.</div>
                ) : null}
                {claim.reviewedAt ? (
                  <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Reviewed by {claim.reviewedByAdminName ?? "Admin"} | {formatTimestamp(claim.reviewedAt)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {section === "owners" ? (
        <section className="grid gap-8 2xl:grid-cols-[0.9fr_1.1fr]">
          <div className="section-shell panel-roomy">
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Create owner account</h2>
            <div className="dense-form-grid mt-6">
              <Input placeholder="Owner name" value={ownerForm.name} onChange={(event) => setOwnerForm((current) => ({ ...current, name: event.target.value }))} />
              <Input placeholder="Email" value={ownerForm.email} onChange={(event) => setOwnerForm((current) => ({ ...current, email: event.target.value }))} />
              <PasswordInput placeholder="Password" value={ownerForm.password} onChange={(event) => setOwnerForm((current) => ({ ...current, password: event.target.value }))} />
              <select className="field-select" value={ownerForm.businessId} onChange={(event) => setOwnerForm((current) => ({ ...current, businessId: event.target.value }))}>
                <option value="">No business assigned</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>{business.name}</option>
                ))}
              </select>
            </div>
            <Button
              className="site-primary-button mt-5"
              disabled={createOwnerMutation.isPending}
              onClick={() =>
                createOwnerMutation.mutate({
                  name: ownerForm.name,
                  email: ownerForm.email,
                  password: ownerForm.password,
                  businessId: ownerForm.businessId ? Number(ownerForm.businessId) : null,
                })
              }
            >
              {createOwnerMutation.isPending ? "Creating..." : "Create owner"}
            </Button>
          </div>

          <div className="section-shell panel-roomy">
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Owner management</h2>
            <div className="mt-5 grid gap-6 2xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="min-w-0 space-y-3">
                {owners.map((owner) => (
                  <button
                    key={owner.id}
                    className={`w-full rounded-2xl border p-4 text-left ${
                      selectedOwnerId === owner.id ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-slate-950" : "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                    onClick={() => setSelectedOwnerId(owner.id)}
                    type="button"
                  >
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{owner.name}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{owner.businessName ?? "No business assigned"}</div>
                    <div className="mt-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${badgeClass(owner.accountStatus)}`}>{owner.accountStatus}</span>
                    </div>
                  </button>
                ))}
              </div>

              {selectedOwner ? (
                <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{selectedOwner.name}</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedOwner.email}</div>
                  <div className="mt-4 grid gap-3 2xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Last sign-in</div>
                      <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{formatTimestamp(selectedOwner.lastSignInAt)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Assigned business</div>
                      <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{selectedOwner.businessName ?? "None"}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 2xl:grid-cols-2">
                    <select className="field-select" value={selectedOwner.businessId ? String(selectedOwner.businessId) : ""} onChange={(event) => transferOwnerMutation.mutate({ id: selectedOwner.id, businessId: event.target.value ? Number(event.target.value) : null })}>
                      <option value="">No business assigned</option>
                      {businesses.map((business) => (
                        <option key={business.id} value={business.id}>{business.name}</option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      onClick={() =>
                        accountStatusMutation.mutate({
                          id: selectedOwner.id,
                          accountStatus: selectedOwner.accountStatus === "active" ? "suspended" : "active",
                          moderationReason: selectedOwner.accountStatus === "active" ? "Suspended from owner management." : "",
                        })
                      }
                    >
                      {selectedOwner.accountStatus === "active" ? "Suspend owner" : "Reactivate owner"}
                    </Button>
                  </div>
                  {selectedOwner.healthFlags.missingBusinessAssignment ? <div className="mt-4 text-sm text-amber-700 dark:text-amber-300">This owner account is active but not attached to a business yet.</div> : null}
                  <div className="mt-4 grid gap-3 2xl:grid-cols-2">
                    <Button className="w-full" variant="outline" onClick={() => forceResetMutation.mutate(selectedOwner.id)}>Generate reset link</Button>
                    <Button className="w-full" variant="outline" onClick={() => navigate("/admin-panel/accounts")}>Open full account record</Button>
                  </div>
                  <Button
                    className="mt-3 w-full border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    variant="outline"
                    disabled={!canDeleteSelectedOwner || deleteAccountMutation.isPending}
                    onClick={() => {
                      const confirmation = requestDeleteConfirmation("account", selectedOwner.name);
                      if (!confirmation) return;
                      deleteAccountMutation.mutate({ id: selectedOwner.id, confirmation });
                    }}
                  >
                    Delete owner
                  </Button>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Delete is available only after the owner account is suspended, and suspended owners cannot be assigned back to a business until reactivated.</div>
                </div>
              ) : (
                <div className="empty-panel">Select an owner to manage.</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {section === "accounts" ? (
        <section className="section-shell panel-roomy">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search accounts, emails, or businesses" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="mt-5 grid gap-6 2xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="min-w-0 space-y-3">
              {filteredAccounts.map((account) => (
                <button
                  key={account.id}
                  className={`w-full rounded-2xl border p-4 text-left ${
                    selectedAccountId === account.id ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-slate-950" : "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  }`}
                  onClick={() => setSelectedAccountId(account.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 dark:text-slate-100">{account.name}</div>
                      <div className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">{account.email}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${badgeClass(account.accountStatus)}`}>{account.accountStatus}</span>
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{account.role}</div>
                </button>
              ))}
            </div>

            {selectedAccount ? (
              <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{selectedAccount.name}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedAccount.email}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${badgeClass(selectedAccount.accountStatus)}`}>{selectedAccount.accountStatus}</span>
                </div>
                <div className="mt-5 grid gap-4 2xl:grid-cols-3">
                  <StatCard label="Queues" value={selectedAccount.queueCount} />
                  <StatCard label="Appointments" value={selectedAccount.appointmentCount} />
                  <StatCard label="Support cases" value={selectedAccount.supportConversationCount} />
                </div>
                <div className="mt-4 grid gap-3 2xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Business</div>
                    <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{selectedAccount.businessName ?? "Not assigned"}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Last sign-in</div>
                    <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{formatTimestamp(selectedAccount.lastSignInAt)}</div>
                  </div>
                </div>
                {selectedAccount.moderationReason ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                    {selectedAccount.moderationReason}
                  </div>
                ) : null}
                {selectedAccountWarnings.length ? (
                  <div className="mt-4 space-y-3">
                    {selectedAccountWarnings.map((warning) => <InlineWarning key={warning}>{warning}</InlineWarning>)}
                  </div>
                ) : null}
                <div className="mt-5 grid gap-3 2xl:grid-cols-2">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() =>
                      accountStatusMutation.mutate({
                        id: selectedAccount.id,
                        accountStatus: selectedAccount.accountStatus === "active" ? "suspended" : "active",
                        moderationReason: selectedAccount.accountStatus === "active" ? "Suspended from account management." : "",
                      })
                    }
                  >
                    {selectedAccount.accountStatus === "active" ? "Suspend account" : "Reactivate account"}
                  </Button>
                  <Button className="w-full" variant="outline" onClick={() => forceResetMutation.mutate(selectedAccount.id)}>Generate reset link</Button>
                </div>
                <Button
                  className="mt-3 w-full border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  variant="outline"
                  disabled={!canDeleteSelectedAccount || deleteAccountMutation.isPending}
                  onClick={() => {
                    const confirmation = requestDeleteConfirmation("account", selectedAccount.name);
                    if (!confirmation) return;
                    deleteAccountMutation.mutate({ id: selectedAccount.id, confirmation });
                  }}
                >
                  Delete account
                  </Button>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {selectedAccount.role === "admin"
                    ? "Admin accounts stay protected from deletion here."
                    : selectedAccount.accountStatus === "active"
                      ? "Suspending an account now requires a moderation reason so other admins can understand the action."
                      : "Delete is available only after the account is suspended."}
                </div>
                {lastResetLink ? (
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                    Reset link preview: {lastResetLink}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="empty-panel">Select an account to inspect.</div>
            )}
          </div>
        </section>
      ) : null}

      {section === "subscriptions" ? (
        <section className="section-shell panel-roomy">
          <h2 className="section-heading text-slate-900 dark:text-slate-100">Subscriptions</h2>
          {(commandCenter?.expiringSubscriptionsCount ?? 0) > 0 ? (
            <div className="mt-5">
              <InlineWarning>{commandCenter?.expiringSubscriptionsCount} subscription(s) are inside the next billing window and may need admin review.</InlineWarning>
            </div>
          ) : null}
          <div className="mt-5 grid gap-4">
            {subscriptions.map((subscription) => (
              <div key={subscription.businessId} className="rounded-3xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{subscription.businessName}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subscription.plan} | {subscription.interval}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${badgeClass(subscription.status)}`}>{subscription.status}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <select className="field-select" value={subscription.plan} onChange={(event) => subscriptionMutation.mutate({ businessId: subscription.businessId, plan: event.target.value as "starter" | "growth" | "premium", interval: subscription.interval, status: subscription.status })}>
                    {["starter", "growth", "premium"].map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                  </select>
                  <select className="field-select" value={subscription.interval} onChange={(event) => subscriptionMutation.mutate({ businessId: subscription.businessId, plan: subscription.plan, interval: event.target.value as "monthly" | "yearly", status: subscription.status })}>
                    {["monthly", "yearly"].map((interval) => <option key={interval} value={interval}>{interval}</option>)}
                  </select>
                  <select className="field-select" value={subscription.status} onChange={(event) => subscriptionMutation.mutate({ businessId: subscription.businessId, plan: subscription.plan, interval: subscription.interval, status: event.target.value as "trial" | "active" | "cancelled" | "expired" | "past_due" })}>
                    {["trial", "active", "cancelled", "expired", "past_due"].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
                <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  {subscription.status === "past_due"
                    ? "This business is behind on billing and may need direct admin follow-up."
                    : subscription.status === "cancelled"
                      ? "Cancellation is recorded. Keep an eye on access expectations and renewal requests."
                      : subscription.nextBillingAt
                        ? `Next billing: ${formatTimestamp(subscription.nextBillingAt)}`
                        : "No upcoming billing date is recorded yet."}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {section === "support" ? (
        <SupportInboxPanel
          mode="admin"
          title="Support operations"
          description="Triage platform issues, assign cases, add internal notes, and respond to users and businesses from the admin console."
        />
      ) : null}

      {section === "moderation" ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <div className="section-shell panel-roomy">
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Suspended businesses</h2>
            <div className="mt-5 space-y-3">
              {suspendedBusinesses.map((business) => (
                <div key={business.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{business.name}</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{business.moderationReason ?? "No reason recorded"}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Moderated {formatTimestamp(business.moderatedAt)}</div>
                  {business.healthFlags.needsModerationNote ? <div className="mt-3 text-sm text-amber-700 dark:text-amber-300">This record should be updated with a moderation reason before long-term follow-up.</div> : null}
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() =>
                      updateBusinessMutation.mutate({
                        id: business.id,
                        payload: {
                          name: business.name,
                          category: business.category,
                          description: business.description,
                          address: business.address,
                          phone: business.phone ?? "",
                          email: business.email ?? "",
                          websiteUrl: business.websiteUrl ?? "",
                          recordStatus: "active",
                          moderationReason: "",
                        },
                      })
                    }
                  >
                    Reactivate business
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="section-shell panel-roomy">
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Suspended accounts</h2>
            <div className="mt-5 space-y-3">
              {suspendedAccounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{account.name}</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{account.email}</div>
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{account.moderationReason ?? "No reason recorded"}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Moderated {formatTimestamp(account.moderatedAt)}</div>
                  {account.healthFlags.needsModerationNote ? <div className="mt-3 text-sm text-amber-700 dark:text-amber-300">This record should be updated with a moderation reason before long-term follow-up.</div> : null}
                  <Button className="mt-4" variant="outline" onClick={() => accountStatusMutation.mutate({ id: account.id, accountStatus: "active", moderationReason: "" })}>
                    Reactivate account
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {section === "announcements" ? (
        <section className="grid gap-8 2xl:grid-cols-[0.95fr_1.05fr]">
          <div className="section-shell panel-roomy">
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Create announcement</h2>
            <div className="dense-form-grid mt-6">
              <Input placeholder="Title" value={announcementForm.title} onChange={(event) => setAnnouncementForm((current) => ({ ...current, title: event.target.value }))} />
              <select className="field-select" value={announcementForm.audience} onChange={(event) => setAnnouncementForm((current) => ({ ...current, audience: event.target.value as "users" | "owners" | "all" }))}>
                {["all", "users", "owners"].map((audience) => <option key={audience} value={audience}>{audience}</option>)}
              </select>
              <select className="field-select" value={announcementForm.status} onChange={(event) => setAnnouncementForm((current) => ({ ...current, status: event.target.value as "draft" | "published" | "archived" }))}>
                {["draft", "published"].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <textarea className="field-textarea mt-5 min-h-[140px]" placeholder="Announcement message" value={announcementForm.message} onChange={(event) => setAnnouncementForm((current) => ({ ...current, message: event.target.value }))} />
            <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Draft announcements stay internal. Published announcements notify the selected audience and should read like final operator communication.
            </div>
            <Button className="site-primary-button mt-5" disabled={announcementMutation.isPending} onClick={() => announcementMutation.mutate(announcementForm)}>
              {announcementMutation.isPending ? "Saving..." : "Save announcement"}
            </Button>
          </div>

          <div className="section-shell panel-roomy">
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Announcement history</h2>
            <div className="mt-5 space-y-3">
              {recentAnnouncements.map((announcement) => (
                <div key={announcement.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{announcement.title}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{announcement.message}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${badgeClass(announcement.status)}`}>{announcement.status}</span>
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Audience: {announcement.audience} | {formatTimestamp(announcement.createdAt)}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {announcement.status !== "published" ? <Button variant="outline" onClick={() => updateAnnouncementMutation.mutate({ id: announcement.id, status: "published" })}>Publish</Button> : null}
                    {announcement.status !== "archived" ? <Button variant="outline" onClick={() => updateAnnouncementMutation.mutate({ id: announcement.id, status: "archived" })}>Archive</Button> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {section === "activity" ? (
        <section className="section-shell panel-roomy">
          <h2 className="section-heading text-slate-900 dark:text-slate-100">Activity log</h2>
          <div className="mt-5 space-y-3">
            {activity.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{item.summary}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <span>{item.actionType}</span>
                  <span>{item.targetType}</span>
                  <span>{item.adminName ?? "System"}</span>
                  <span>{formatTimestamp(item.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {section === "settings" ? (
        <section className="section-shell panel-roomy">
          <h2 className="section-heading text-slate-900 dark:text-slate-100">Platform settings</h2>
          {(settingsForm.defaultQueuePauseLimitMinutes > 120 || settingsForm.defaultBookingHorizonDays > 60) ? (
            <div className="mt-5">
              <InlineWarning>These defaults are unusually permissive and may create operator or guest confusion across the platform.</InlineWarning>
            </div>
          ) : null}
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Assistant support escalation</div>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Send technical issues straight to support instead of letting the assistant guess.</div>
              <input className="mt-4 h-6 w-6 accent-blue-600" checked={settingsForm.assistantSupportEscalationEnabled} onChange={(event) => setSettingsForm((current) => ({ ...current, assistantSupportEscalationEnabled: event.target.checked }))} type="checkbox" />
            </label>
            <label className="rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Support auto-assign</div>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Automatically attach new support threads to an admin when triage is active.</div>
              <input className="mt-4 h-6 w-6 accent-blue-600" checked={settingsForm.supportAutoAssignEnabled} onChange={(event) => setSettingsForm((current) => ({ ...current, supportAutoAssignEnabled: event.target.checked }))} type="checkbox" />
            </label>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Default queue pause limit</div>
              <Input className="mt-4" type="number" value={settingsForm.defaultQueuePauseLimitMinutes} onChange={(event) => setSettingsForm((current) => ({ ...current, defaultQueuePauseLimitMinutes: Number(event.target.value) || 0 }))} />
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Default booking horizon</div>
              <Input className="mt-4" type="number" value={settingsForm.defaultBookingHorizonDays} onChange={(event) => setSettingsForm((current) => ({ ...current, defaultBookingHorizonDays: Number(event.target.value) || 1 }))} />
            </div>
            <label className="rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900 md:col-span-2">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Claims require manual review</div>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Keep new directory claim requests in the admin approval queue.</div>
              <input className="mt-4 h-6 w-6 accent-blue-600" checked={settingsForm.claimsRequireManualReview} onChange={(event) => setSettingsForm((current) => ({ ...current, claimsRequireManualReview: event.target.checked }))} type="checkbox" />
            </label>
          </div>
          <Button className="site-primary-button mt-6" disabled={settingsMutation.isPending} onClick={() => settingsMutation.mutate(settingsForm)}>
            {settingsMutation.isPending ? "Saving..." : "Save platform settings"}
          </Button>
        </section>
      ) : null}
    </RoleWorkspaceShell>
  );
}
