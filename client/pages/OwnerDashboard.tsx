import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Globe,
  LifeBuoy,
  MessageCircleReply,
  MessageSquareMore,
  Power,
  ReceiptText,
  Settings2,
  Sparkles,
  Star,
  Store,
  Users2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  Appointment,
  AppointmentStatus,
  BusinessHour,
  OwnerBusinessProfileInput,
  OwnerCounterInput,
  OwnerNoticeInput,
  OwnerReceiptInput,
  OwnerServiceInput,
  QueueEntry,
  QueueRealtimeEvent,
  QueueStatus,
} from "@shared/api";
import { AppLoadingState } from "@/components/AppLoadingState";
import { InboxPanel } from "@/components/InboxPanel";
import NotificationCenter from "@/components/NotificationCenter";
import ReceiptPreviewCard from "@/components/ReceiptPreviewCard";
import RoleWorkspaceShell from "@/components/RoleWorkspaceShell";
import { SupportInboxPanel } from "@/components/SupportInboxPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { demoOwnerDashboard, demoOwnerUser } from "@/demo/demoData";
import { useDemoMode } from "@/context/DemoModeContext";
import { useSession } from "@/context/SessionContext";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

type BusinessSection =
  | "today"
  | "queue"
  | "appointments"
  | "services"
  | "messages"
  | "receipts"
  | "notifications"
  | "analytics"
  | "feedback"
  | "settings"
  | "support";

type QueueActionName = "call-next" | "in-service" | "delay" | "complete" | "no-show";
type QueueAssignmentDraft = { serviceId: string; counterId: string; staffName: string };

const initialServiceForm: OwnerServiceInput = {
  name: "",
  description: "",
  averageServiceMinutes: 15,
  maxActiveQueue: 20,
  supportsAppointments: true,
  isActive: true,
};

const initialCounterForm: OwnerCounterInput = {
  name: "",
  status: "open",
  activeServiceIds: [],
  assignedStaffName: "",
};

const initialNoticeForm: OwnerNoticeInput = {
  title: "",
  message: "",
  severity: "info",
  isActive: true,
};

const initialReceiptDraft: Omit<OwnerReceiptInput, "visitType" | "visitId"> = {
  ownerNote: "",
  lineItemLabel: "",
  amountCents: null,
  totalCents: null,
  paymentNote: "",
};

const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const defaultHours: BusinessHour[] = dayLabels.map((_, dayOfWeek) => ({
  dayOfWeek,
  openTime: "09:00",
  closeTime: "17:00",
  isClosed: dayOfWeek === 0,
}));

function getBusinessSection(pathname: string): BusinessSection {
  if (pathname === "/business-dashboard/today") return "today";
  if (pathname === "/business-dashboard/queue") return "queue";
  if (pathname === "/business-dashboard/appointments") return "appointments";
  if (pathname === "/business-dashboard/services") return "services";
  if (pathname === "/business-dashboard/messages") return "messages";
  if (pathname === "/business-dashboard/receipts") return "receipts";
  if (pathname === "/business-dashboard/notifications") return "notifications";
  if (pathname === "/business-dashboard/analytics") return "analytics";
  if (pathname === "/business-dashboard/feedback") return "feedback";
  if (pathname === "/business-dashboard/settings") return "settings";
  if (pathname === "/business-dashboard/support") return "support";
  return "today";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function queueStatusMeta(status: QueueStatus) {
  switch (status) {
    case "waiting":
      return { label: "Waiting in line", description: "Guest is active in line and can be called when the team is ready.", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
    case "called":
      return { label: "Called to the business", description: "Guest has been called and should be moving to service now.", chip: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200" };
    case "in_service":
      return { label: "In service", description: "Visit is actively being handled now.", chip: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-200" };
    case "paused":
      return { label: "Paused by guest", description: "Guest placed the visit on a short hold. This is different from a delayed visit.", chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200" };
    case "delayed":
      return { label: "Delayed visit", description: "This visit needs business follow-up. It is not simply paused by the guest.", chip: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-200" };
    default:
      return { label: status.replace("_", " "), description: "Queue status updated.", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
  }
}

function getRecentGuestAction(entry: QueueEntry) {
  const latestEvent = [...entry.timeline].reverse().find((event) =>
    ["paused", "resumed", "skipped", "rescheduled", "pause-expired"].includes(event.eventType),
  );
  if (!latestEvent) return null;
  switch (latestEvent.eventType) {
    case "paused":
      return "Guest most recently paused this visit.";
    case "resumed":
      return "Guest most recently resumed this visit.";
    case "skipped":
      return "Guest most recently let the next waiting guests go first.";
    case "rescheduled":
      return "Guest most recently rejoined later with a fresh place in line.";
    case "pause-expired":
      return "The guest hold expired, so this visit now needs follow-up.";
    default:
      return latestEvent.label;
  }
}

function appointmentStatusMeta(status: AppointmentStatus) {
  switch (status) {
    case "pending":
      return { label: "Pending review", description: "This booking still needs an owner decision." };
    case "approved":
      return { label: "Approved", description: "The appointment is confirmed and should be prepared for." };
    case "completed":
      return { label: "Completed", description: "Visit is finished and ready for follow-up like receipts or feedback." };
    case "cancelled":
      return { label: "Cancelled", description: "The booking was cancelled before the visit happened." };
    case "rejected":
      return { label: "Rejected", description: "The business declined the booking request." };
    case "converted":
      return { label: "Moved to live queue", description: "The appointment has already been converted into a queue visit." };
    case "expired":
      return { label: "Expired", description: "The booking was never confirmed before its scheduled time passed." };
    default:
      return { label: status, description: "Appointment status updated." };
  }
}

function createQueueDrafts(entries: QueueEntry[]): Record<number, QueueAssignmentDraft> {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.id,
      {
        serviceId: entry.serviceId == null ? "" : String(entry.serviceId),
        counterId: entry.counterId == null ? "" : String(entry.counterId),
        staffName: entry.staffName ?? "",
      },
    ]),
  );
}

function getAllowedQueueActions(entry: QueueEntry) {
  const actions: Array<{ action: QueueActionName; label: string; variant?: "default" | "outline" | "destructive" }> = [];
  if (entry.availableOwnerActions.canCall.allowed) actions.push({ action: "call-next", label: "Call next" });
  if (entry.availableOwnerActions.canStartService.allowed) {
    actions.push({ action: "in-service", label: "Start service" });
  }
  if (entry.availableOwnerActions.canDelay.allowed) actions.push({ action: "delay", label: "Mark delay", variant: "outline" });
  if (entry.availableOwnerActions.canComplete.allowed) actions.push({ action: "complete", label: "Complete" });
  if (entry.availableOwnerActions.canNoShow.allowed) {
    actions.push({ action: "no-show", label: "No show", variant: "destructive" });
  }
  return actions;
}

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { logout, user } = useSession();
  const { enabled: demoEnabled, currentPreset } = useDemoMode();
  const scope = getAccountScope(user);
  const [queueRealtimeMessage, setQueueRealtimeMessage] = useState("");
  const handleQueueEvent = useCallback((event: QueueRealtimeEvent) => {
    if (event.businessId !== Number(scope.ownerBusinessId)) return;
    setQueueRealtimeMessage(event.message);
  }, [scope.ownerBusinessId]);
  useRealtimeInvalidation(handleQueueEvent);

  const [serviceForm, setServiceForm] = useState(initialServiceForm);
  const [counterForm, setCounterForm] = useState(initialCounterForm);
  const [noticeForm, setNoticeForm] = useState(initialNoticeForm);
  const [hoursForm, setHoursForm] = useState<BusinessHour[]>(defaultHours);
  const [feedbackReplies, setFeedbackReplies] = useState<Record<number, string>>({});
  const [queueDrafts, setQueueDrafts] = useState<Record<number, QueueAssignmentDraft>>({});
  const [receiptDrafts, setReceiptDrafts] = useState<Record<string, Omit<OwnerReceiptInput, "visitType" | "visitId">>>({});
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
  const [businessProfileForm, setBusinessProfileForm] = useState<OwnerBusinessProfileInput>({
    name: "",
    phone: "",
    email: "",
    address: "",
    websiteUrl: "",
  });

  const isDemoFigure = location.pathname === "/demo/figure-5" || (demoEnabled && currentPreset === "figure5_owner_dashboard");
  const dashboardQuery = useQuery({
    queryKey: accountQueryKeys.ownerDashboard(scope.ownerBusinessId),
    queryFn: api.getOwnerDashboard,
    enabled: !isDemoFigure,
  });
  const notificationsQuery = useQuery({
    queryKey: accountQueryKeys.notifications(scope.role, scope.userId),
    queryFn: api.getNotifications,
    enabled: !isDemoFigure,
    refetchInterval: 30_000,
  });
  const ownerReceiptsQuery = useQuery({
    queryKey: accountQueryKeys.ownerReceipts(scope.ownerBusinessId),
    queryFn: api.getOwnerReceipts,
    enabled: !isDemoFigure,
  });

  const dashboard = isDemoFigure ? demoOwnerDashboard : dashboardQuery.data;
  const displayUser = isDemoFigure ? demoOwnerUser : user;
  const section = isDemoFigure ? "queue" : getBusinessSection(location.pathname);
  const receiptCenter = ownerReceiptsQuery.data;

  useEffect(() => {
    if (!dashboard?.business.hours.length) return;
    setHoursForm([...dashboard.business.hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
  }, [dashboard?.business.hours]);

  useEffect(() => {
    if (!dashboard?.business) return;
    setBusinessProfileForm({
      name: dashboard.business.name,
      phone: dashboard.business.phone ?? "",
      email: dashboard.business.email ?? "",
      address: dashboard.business.address,
      websiteUrl: dashboard.business.websiteUrl ?? "",
    });
  }, [dashboard?.business]);

  useEffect(() => {
    if (!dashboard?.feedback.length) return;
    setFeedbackReplies((current) => {
      const next = { ...current };
      dashboard.feedback.forEach((item) => {
        if (next[item.id] === undefined) next[item.id] = item.ownerReply ?? "";
      });
      return next;
    });
  }, [dashboard?.feedback]);

  useEffect(() => {
    if (!dashboard?.queueEntries.length) return;
    setQueueDrafts(createQueueDrafts(dashboard.queueEntries));
  }, [dashboard?.queueEntries]);

  useEffect(() => {
    const firstReceiptId = ownerReceiptsQuery.data?.receipts?.[0]?.id ?? null;
    if (selectedReceiptId == null && firstReceiptId != null) {
      setSelectedReceiptId(firstReceiptId);
    }
  }, [ownerReceiptsQuery.data?.receipts, selectedReceiptId]);

  const refreshOwnerWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.ownerDashboard(scope.ownerBusinessId) }),
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.notifications(scope.role, scope.userId) }),
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.ownerReceipts(scope.ownerBusinessId) }),
      queryClient.invalidateQueries({ queryKey: ["conversations", "owner", scope.ownerBusinessId] }),
      queryClient.invalidateQueries({ queryKey: ["support-conversations", "owner", scope.ownerBusinessId] }),
      queryClient.invalidateQueries({ queryKey: ["businesses"] }),
      queryClient.invalidateQueries({ queryKey: ["business-markers"] }),
    ]);
  };

  const queueToggle = useMutation({ mutationFn: api.setOwnerQueueOpen, onSuccess: refreshOwnerWorkspace });
  const queueAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: QueueActionName }) => api.ownerQueueAction(id, action),
    onSuccess: refreshOwnerWorkspace,
  });
  const appointmentAction = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" | "completed" | "cancelled" }) =>
      api.updateOwnerAppointment(id, { status }),
    onSuccess: refreshOwnerWorkspace,
  });
  const assignAction = useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: QueueAssignmentDraft }) =>
      api.assignOwnerQueue(id, {
        counterId: draft.counterId ? Number(draft.counterId) : null,
        serviceId: draft.serviceId ? Number(draft.serviceId) : null,
        staffName: draft.staffName,
      }),
    onSuccess: refreshOwnerWorkspace,
  });
  const createService = useMutation({
    mutationFn: api.createOwnerService,
    onSuccess: async () => {
      setServiceForm(initialServiceForm);
      await refreshOwnerWorkspace();
    },
  });
  const createCounter = useMutation({
    mutationFn: api.createOwnerCounter,
    onSuccess: async () => {
      setCounterForm(initialCounterForm);
      await refreshOwnerWorkspace();
    },
  });
  const createNotice = useMutation({
    mutationFn: api.createOwnerNotice,
    onSuccess: async () => {
      setNoticeForm(initialNoticeForm);
      await refreshOwnerWorkspace();
    },
  });
  const saveHours = useMutation({ mutationFn: api.updateOwnerHours, onSuccess: refreshOwnerWorkspace });
  const saveBusinessProfile = useMutation({ mutationFn: api.updateOwnerBusinessProfile, onSuccess: refreshOwnerWorkspace });
  const saveReceiptSettings = useMutation({ mutationFn: api.updateOwnerReceiptSettings, onSuccess: refreshOwnerWorkspace });
  const issueReceipt = useMutation({
    mutationFn: api.createOwnerReceipt,
    onSuccess: async (response) => {
      setSelectedReceiptId(response.receipt.id);
      await refreshOwnerWorkspace();
    },
  });
  const replyToFeedback = useMutation({
    mutationFn: ({ id, reply }: { id: number; reply: string }) => api.replyToFeedback(id, { reply }),
    onSuccess: refreshOwnerWorkspace,
  });
  const subscriptionMutation = useMutation({ mutationFn: api.updateOwnerSubscription, onSuccess: refreshOwnerWorkspace });

  const initials = useMemo(
    () =>
      (displayUser?.name || "Q")
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [displayUser?.name],
  );
  const unreadNotifications = notificationsQuery.data?.notifications.filter((item) => !item.isRead).length ?? 0;
  const selectedReceipt = receiptCenter?.receipts.find((item) => item.id === selectedReceiptId) ?? receiptCenter?.receipts[0] ?? null;

  const analyticsSummary = useMemo(() => {
    if (!dashboard) {
      return { totalThroughput: 0, averageWait: 0, conversionRate: 0, topService: null as null | { serviceName: string; throughputToday: number } };
    }
    const topService = [...dashboard.analytics.servicePerformance].sort((left, right) => right.throughputToday - left.throughputToday)[0] ?? null;
    return {
      totalThroughput: dashboard.analytics.servicePerformance.reduce((sum, service) => sum + service.throughputToday, 0),
      averageWait:
        dashboard.analytics.servicePerformance.length > 0
          ? Math.round(
              dashboard.analytics.servicePerformance.reduce((sum, service) => sum + service.averageWaitMinutes, 0) /
                dashboard.analytics.servicePerformance.length,
            )
          : 0,
      conversionRate: Math.round(dashboard.analytics.appointmentConversionRate * 100),
      topService: topService ? { serviceName: topService.serviceName, throughputToday: topService.throughputToday } : null,
    };
  }, [dashboard]);

  const analyticsBestDay = useMemo(() => {
    if (!dashboard?.analytics.last7Days.length) return null;
    return [...dashboard.analytics.last7Days].sort((left, right) => right.servedCount - left.servedCount)[0] ?? null;
  }, [dashboard?.analytics.last7Days]);

  const counterLoadMap = useMemo(() => {
    const map = new Map<number, number>();
    dashboard?.queueEntries.forEach((entry) => {
      if (entry.counterId == null || ["completed", "cancelled", "no_show", "transferred"].includes(entry.status)) return;
      map.set(entry.counterId, (map.get(entry.counterId) ?? 0) + 1);
    });
    return map;
  }, [dashboard?.queueEntries]);

  const navItems: Array<{ to: string; label: string; icon: LucideIcon; badgeCount?: number }> = [
    { to: "/business-dashboard", label: "Today", icon: Sparkles },
    { to: "/business-dashboard/queue", label: "Queue", icon: Clock3, badgeCount: dashboard?.queueAttention.unassignedCount || dashboard?.queueAttention.delayedCount ? dashboard.queueAttention.unassignedCount + dashboard.queueAttention.delayedCount : undefined },
    { to: "/business-dashboard/appointments", label: "Appointments", icon: CalendarClock, badgeCount: dashboard?.appointmentCounts.pending || undefined },
    { to: "/business-dashboard/messages", label: "Messages", icon: MessageSquareMore, badgeCount: dashboard?.conversations.filter((item) => item.status === "active").length || undefined },
    { to: "/business-dashboard/services", label: "Services", icon: Store },
    { to: "/business-dashboard/receipts", label: "Receipts", icon: ReceiptText },
    { to: "/business-dashboard/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/business-dashboard/feedback", label: "Feedback", icon: Star, badgeCount: dashboard?.feedback.filter((item) => !item.ownerReply?.trim()).length || undefined },
    { to: "/business-dashboard/notifications", label: "Notifications", icon: Bell, badgeCount: unreadNotifications || undefined },
    { to: "/business-dashboard/settings", label: "Settings", icon: Settings2 },
    { to: "/business-dashboard/support", label: "Support", icon: LifeBuoy },
  ];

  if (!dashboard) {
    return <AppLoadingState title="Loading business dashboard" message="Syncing queue flow, appointments, team setup, receipts, and guest communication." />;
  }

  return (
    <RoleWorkspaceShell
      badge="Business dashboard"
      title={dashboard.business.name}
      subtitle="Operate today's flow first, then handle setup, trust, and support without losing context."
      navItems={navItems}
      activePath={location.pathname}
      onSignOut={async () => {
        await logout();
        navigate("/login");
      }}
      aside={
        <div className="space-y-5">
          <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-blue-900 to-amber-700 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold">{initials}</div>
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-amber-200">Business owner</div>
                <div className="mt-1 text-xl font-bold">{displayUser?.name}</div>
                <div className="text-sm text-blue-100">{dashboard.business.name}</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-blue-100">Queue</div>
                <div className="mt-2 text-2xl font-bold">{dashboard.queueOpen ? "Open" : "Paused"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-blue-100">Guests</div>
                <div className="mt-2 text-2xl font-bold">{dashboard.activeCount}</div>
              </div>
            </div>
          </div>

          <div className="section-shell panel-roomy">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Operational priority</div>
            <div className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">{dashboard.operationsSummary.title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{dashboard.operationsSummary.message}</div>
            <div className="mt-5 grid gap-3">
              <Button asChild className="site-primary-button">
                <Link to={dashboard.operationsSummary.primaryActionHref}>{dashboard.operationsSummary.primaryActionLabel}</Link>
              </Button>
              {dashboard.operationsSummary.secondaryActionHref ? (
                <Button asChild variant="outline">
                  <Link to={dashboard.operationsSummary.secondaryActionHref}>{dashboard.operationsSummary.secondaryActionLabel}</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="section-shell panel-roomy">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Attention</div>
            <div className="mt-4 grid gap-3">
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Needs assignment</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard.queueAttention.unassignedCount}</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Pending appointments</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard.appointmentCounts.pending}</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Unread notifications</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{unreadNotifications}</div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {section === "today" ? (
        <>
          <section className="kpi-grid">
            {[
              ["Active guests", dashboard.activeCount],
              ["Waiting", dashboard.waitingCount],
              ["Called", dashboard.calledCount],
              ["Today's appointments", dashboard.todayAppointments],
            ].map(([label, value]) => (
              <div key={String(label)} className="stat-shell p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{label}</div>
                <div className="mt-3 text-4xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
              </div>
            ))}
          </section>

          <section className="section-shell panel-roomy">
            <div className="toolbar-row">
              <div>
                <h2 className="section-heading text-slate-900 dark:text-slate-100">Run today's operations</h2>
                <p className="subtle-lead mt-2">This view now surfaces the next operational decision first instead of making you scan every section manually.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to={dashboard.operationsSummary.primaryActionHref}>{dashboard.operationsSummary.primaryActionLabel}</Link>
                </Button>
                <Button
                  className={dashboard.queueOpen ? "bg-red-600 text-white hover:bg-red-700" : "bg-green-600 text-white hover:bg-green-700"}
                  disabled={queueToggle.isPending}
                  onClick={() => queueToggle.mutate(!dashboard.queueOpen)}
                >
                  <Power className="mr-2 h-4 w-4" />
                  {dashboard.queueOpen ? "Pause joins" : "Open joins"}
                </Button>
              </div>
            </div>

            <div className="mt-6 rounded-[1.6rem] border border-blue-100 bg-blue-50/70 p-6 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Priority right now</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard.operationsSummary.title}</div>
                  <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{dashboard.operationsSummary.message}</div>
                </div>
                <Button asChild className="site-primary-button">
                  <Link to={dashboard.operationsSummary.primaryActionHref}>
                    {dashboard.operationsSummary.primaryActionLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {dashboard.setupWarnings.length ? (
              <div className="mt-6 grid gap-4">
                {dashboard.setupWarnings.map((warning) => (
                  <div key={warning} className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div>{warning}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
              <div className="space-y-5">
                <div className="rounded-[1.6rem] border border-slate-100 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    <Users2 className="h-4 w-4" />
                    Queue attention
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="info-card">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Unassigned</div>
                      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard.queueAttention.unassignedCount}</div>
                    </div>
                    <div className="info-card">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Delayed</div>
                      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard.queueAttention.delayedCount}</div>
                    </div>
                    <div className="info-card">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Active counters</div>
                      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard.queueAttention.activeCounterCount}</div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {dashboard.queueAttention.canOperateSmoothly
                      ? "Counters and service lanes are in a healthy state for current demand."
                      : "Today's queue has risks that could slow guests down if the team does not intervene."}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-slate-100 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    <CalendarClock className="h-4 w-4" />
                    Upcoming appointments
                  </div>
                  <div className="mt-4 space-y-3">
                    {[...dashboard.pendingAppointments, ...dashboard.upcomingAppointments].slice(0, 5).map((appointment) => {
                      const meta = appointmentStatusMeta(appointment.status);
                      return (
                        <div key={appointment.id} className="rounded-[1.2rem] bg-slate-50 p-4 dark:bg-slate-950">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">{appointment.userName}</div>
                              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{appointment.serviceName ?? "General service"} | {formatDateTime(appointment.scheduledFor)}</div>
                            </div>
                            <div className="workspace-chip">{meta.label}</div>
                          </div>
                          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{meta.description}</div>
                        </div>
                      );
                    })}
                    {!dashboard.pendingAppointments.length && !dashboard.upcomingAppointments.length ? <div className="empty-panel p-5">No appointments need owner attention right now.</div> : null}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[1.6rem] border border-slate-100 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    <BarChart3 className="h-4 w-4" />
                    Performance snapshot
                  </div>
                  <div className="mt-4 space-y-4">
                    <div className="info-card">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Served today</div>
                      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{analyticsSummary.totalThroughput}</div>
                    </div>
                    <div className="info-card">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Avg wait</div>
                      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{analyticsSummary.averageWait} min</div>
                    </div>
                    <div className="info-card">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Appointment conversion</div>
                      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{analyticsSummary.conversionRate}%</div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    {analyticsSummary.topService
                      ? `Top service today: ${analyticsSummary.topService.serviceName} with ${analyticsSummary.topService.throughputToday} completed visits.`
                      : "Top-service insights will appear once your team serves guests."}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-slate-100 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Guest trust follow-up</div>
                  <div className="mt-4 grid gap-4">
                    <div className="info-card">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Reviews awaiting reply</div>
                      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard.feedback.filter((item) => !item.ownerReply?.trim()).length}</div>
                    </div>
                    <div className="info-card">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Active guest conversations</div>
                      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard.conversations.filter((item) => item.status === "active").length}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {section === "queue" ? (
        <section className="section-shell panel-roomy">
          <div className="toolbar-row">
            <div>
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Queue controls</h2>
              <p className="subtle-lead mt-2">Action buttons now follow real queue rules, and assignments are saved as one coordinated operational step.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="workspace-chip">{dashboard.queueAttention.unassignedCount} need assignment</div>
              <Button
                className={dashboard.queueOpen ? "bg-red-600 text-white hover:bg-red-700" : "bg-green-600 text-white hover:bg-green-700"}
                disabled={queueToggle.isPending}
                onClick={() => queueToggle.mutate(!dashboard.queueOpen)}
              >
                <Power className="mr-2 h-4 w-4" />
                {dashboard.queueOpen ? "Pause joins" : "Open joins"}
              </Button>
            </div>
          </div>

          {!dashboard.queueAttention.canOperateSmoothly ? (
            <div className="mt-6 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              Queue flow has open operational risks. Review assignments, delayed visits, and counter readiness before traffic increases.
            </div>
          ) : null}
          {queueRealtimeMessage ? (
            <div className="mt-6 rounded-[1.4rem] border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
              {queueRealtimeMessage}
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            {dashboard.queueEntries.map((entry) => {
              const meta = queueStatusMeta(entry.status);
              const draft = queueDrafts[entry.id] ?? { serviceId: "", counterId: "", staffName: "" };
              const availableActions = getAllowedQueueActions(entry);
              const selectedServiceId = draft.serviceId ? Number(draft.serviceId) : entry.serviceId;
              const compatibleCounters = dashboard.counters.filter((counter) => {
                if (selectedServiceId == null) return true;
                return counter.activeServiceIds.length === 0 || counter.activeServiceIds.includes(selectedServiceId);
              });
              return (
                <div key={entry.id} className="rounded-[1.6rem] border border-slate-100 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">{entry.queueNumber}</div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.chip}`}>{meta.label}</span>
                      </div>
                      <div className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">{entry.userName}</div>
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {entry.serviceName ?? "No service yet"} | ETA {entry.estimatedWaitMinutes} min | {entry.position != null ? `Queue position ${entry.position}` : "Not currently in callable order"}
                      </div>
                      <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{entry.statusDescription}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="workspace-chip border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          Skips used {entry.skipsUsed}
                        </span>
                        <span className="workspace-chip border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          Rejoins used {entry.reschedulesUsed}
                        </span>
                        {entry.pauseExpiresAt ? (
                          <span className="workspace-chip border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                            Hold ends {new Date(entry.pauseExpiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        ) : null}
                      </div>
                      {getRecentGuestAction(entry) ? (
                        <div className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
                          {getRecentGuestAction(entry)}
                        </div>
                      ) : null}
                      {!entry.serviceId || !entry.counterId || !entry.staffName?.trim() ? (
                        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                          This visit is not fully assigned yet. Add a service, counter, and staff member before starting service.
                        </div>
                      ) : null}
                      {!entry.availableOwnerActions.canCall.allowed && entry.status === "paused" ? (
                        <div className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {entry.availableOwnerActions.canCall.reason}
                        </div>
                      ) : null}
                      {!entry.availableOwnerActions.canCall.allowed && entry.status === "delayed" ? (
                        <div className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {entry.availableOwnerActions.canCall.reason}
                        </div>
                      ) : null}
                      {!entry.availableOwnerActions.canStartService.allowed && entry.status === "called" ? (
                        <div className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {entry.availableOwnerActions.canStartService.reason}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
                      {availableActions.map((item) => (
                        <Button
                          key={`${entry.id}-${item.action}`}
                          className="w-full sm:w-auto"
                          size="sm"
                          variant={item.variant ?? "default"}
                          disabled={queueAction.isPending}
                          onClick={() => queueAction.mutate({ id: entry.id, action: item.action })}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      value={draft.serviceId}
                      onChange={(event) =>
                        setQueueDrafts((current) => ({
                          ...current,
                          [entry.id]: { ...draft, serviceId: event.target.value, counterId: "" },
                        }))
                      }
                    >
                      <option value="">Select service</option>
                      {dashboard.services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} ({service.isActive ? "active" : "inactive"})
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      value={draft.counterId}
                      onChange={(event) =>
                        setQueueDrafts((current) => ({
                          ...current,
                          [entry.id]: { ...draft, counterId: event.target.value },
                        }))
                      }
                    >
                      <option value="">Assign counter</option>
                      {compatibleCounters.map((counter) => (
                        <option key={counter.id} value={counter.id}>
                          {counter.name} ({counter.status}, {counterLoadMap.get(counter.id) ?? 0} active)
                        </option>
                      ))}
                    </select>
                    <Input
                      value={draft.staffName}
                      placeholder="Assigned staff"
                      onChange={(event) =>
                        setQueueDrafts((current) => ({
                          ...current,
                          [entry.id]: { ...draft, staffName: event.target.value },
                        }))
                      }
                    />
                    <Button
                      className="site-primary-button w-full xl:w-auto"
                      disabled={assignAction.isPending}
                      onClick={() => assignAction.mutate({ id: entry.id, draft })}
                    >
                      Save assignment
                    </Button>
                  </div>

                  {draft.counterId && selectedServiceId != null ? (
                    <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      Counter compatibility is filtered so the team only assigns counters that can handle the selected service.
                    </div>
                  ) : null}
                </div>
              );
            })}
            {dashboard.queueEntries.length === 0 ? <div className="empty-panel p-10 text-center">No guests are waiting right now.</div> : null}
          </div>
        </section>
      ) : null}

      {section === "appointments" ? (
        <section className="space-y-7">
          <div className="section-shell panel-roomy">
            <div className="toolbar-row">
              <div>
                <h2 className="section-heading text-slate-900 dark:text-slate-100">Appointment operations</h2>
                <p className="subtle-lead mt-2">Bookings are grouped by operational stage so you can review new requests, prepare upcoming visits, and close out completed ones.</p>
              </div>
              <div className="mobile-chip-row">
                <div className="workspace-chip">{dashboard.appointmentCounts.pending} pending</div>
                <div className="workspace-chip">{dashboard.appointmentCounts.upcoming} upcoming</div>
              </div>
            </div>
          </div>

          <section className="section-shell panel-roomy">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Pending review</h3>
            <div className="mt-5 space-y-4">
              {dashboard.pendingAppointments.map((appointment) => {
                const meta = appointmentStatusMeta(appointment.status);
                return (
                  <div key={appointment.id} className="rounded-[1.35rem] border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80 sm:rounded-[1.5rem] sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{appointment.userName}</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{appointment.serviceName ?? "General service"} | {formatDateTime(appointment.scheduledFor)}</div>
                        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{meta.description}</div>
                      </div>
                      <div className="mobile-button-row w-full lg:w-auto">
                        <Button className="w-full sm:w-auto" size="sm" disabled={appointmentAction.isPending} onClick={() => appointmentAction.mutate({ id: appointment.id, status: "approved" })}>Approve</Button>
                        <Button className="w-full sm:w-auto" size="sm" variant="destructive" disabled={appointmentAction.isPending} onClick={() => appointmentAction.mutate({ id: appointment.id, status: "rejected" })}>Reject</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!dashboard.pendingAppointments.length ? <div className="empty-panel p-8 text-center">No appointments need review right now.</div> : null}
            </div>
          </section>

          <section className="section-shell panel-roomy">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Approved and upcoming</h3>
            <div className="mt-5 space-y-4">
              {dashboard.upcomingAppointments.map((appointment) => {
                const meta = appointmentStatusMeta(appointment.status);
                return (
                  <div key={appointment.id} className="rounded-[1.35rem] border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80 sm:rounded-[1.5rem] sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{appointment.userName}</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{appointment.serviceName ?? "General service"} | {formatDateTime(appointment.scheduledFor)}</div>
                        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{meta.description}</div>
                      </div>
                      <div className="mobile-button-row w-full lg:w-auto">
                        <Button className="w-full sm:w-auto" size="sm" disabled={appointmentAction.isPending} onClick={() => appointmentAction.mutate({ id: appointment.id, status: "completed" })}>Mark completed</Button>
                        <Button className="w-full sm:w-auto" size="sm" variant="outline" disabled={appointmentAction.isPending} onClick={() => appointmentAction.mutate({ id: appointment.id, status: "cancelled" })}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!dashboard.upcomingAppointments.length ? <div className="empty-panel p-8 text-center">No approved appointments are waiting for service right now.</div> : null}
            </div>
          </section>

          <section className="section-shell panel-roomy">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recent appointment outcomes</h3>
            <div className="mt-5 space-y-3">
              {dashboard.recentAppointments.map((appointment) => {
                const meta = appointmentStatusMeta(appointment.status);
                return (
                  <div key={appointment.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{appointment.userName}</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{appointment.serviceName ?? "General service"} | {formatDateTime(appointment.scheduledFor)}</div>
                      </div>
                      <div className="workspace-chip">{meta.label}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{meta.description}</div>
                  </div>
                );
              })}
              {!dashboard.recentAppointments.length ? <div className="empty-panel p-8 text-center">Appointment history will appear here after visits start moving through the workflow.</div> : null}
            </div>
          </section>
        </section>
      ) : null}

      {section === "services" ? (
        <section className="grid gap-7 2xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-7">
            <div className="section-shell panel-roomy">
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Add service lane</h2>
              <p className="subtle-lead mt-2">Define the service timing, queue capacity, and whether that lane can be booked in advance.</p>
              <div className="mt-5 grid gap-4">
                <Input placeholder="Service name" value={serviceForm.name} onChange={(event) => setServiceForm((current) => ({ ...current, name: event.target.value }))} />
                <Textarea placeholder="Describe what this service is for" value={serviceForm.description} onChange={(event) => setServiceForm((current) => ({ ...current, description: event.target.value }))} />
                <div className="dense-form-grid">
                  <Input type="number" min="5" placeholder="Average minutes" value={serviceForm.averageServiceMinutes} onChange={(event) => setServiceForm((current) => ({ ...current, averageServiceMinutes: Number(event.target.value || 0) }))} />
                  <Input type="number" min="1" placeholder="Max queue size" value={serviceForm.maxActiveQueue} onChange={(event) => setServiceForm((current) => ({ ...current, maxActiveQueue: Number(event.target.value || 0) }))} />
                </div>
                <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-700">
                  Supports appointments
                  <Switch checked={serviceForm.supportsAppointments} onCheckedChange={(checked) => setServiceForm((current) => ({ ...current, supportsAppointments: checked }))} />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-700">
                  Service is active
                  <Switch checked={serviceForm.isActive} onCheckedChange={(checked) => setServiceForm((current) => ({ ...current, isActive: checked }))} />
                </label>
                <Button className="site-primary-button w-full sm:w-auto" disabled={createService.isPending} onClick={() => createService.mutate(serviceForm)}>Create service lane</Button>
              </div>
            </div>

            <div className="section-shell panel-roomy">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Add counter</h3>
              <p className="subtle-lead mt-2">Counters now declare which services they can handle, so queue assignment stays operationally valid.</p>
              <div className="mt-5 grid gap-4">
                <Input placeholder="Counter name" value={counterForm.name} onChange={(event) => setCounterForm((current) => ({ ...current, name: event.target.value }))} />
                <Input placeholder="Assigned staff" value={counterForm.assignedStaffName} onChange={(event) => setCounterForm((current) => ({ ...current, assignedStaffName: event.target.value }))} />
                <select className="field-select" value={counterForm.status} onChange={(event) => setCounterForm((current) => ({ ...current, status: event.target.value as OwnerCounterInput["status"] }))}>
                  <option value="open">Open</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Supported services</div>
                  <div className="mt-3 grid gap-3">
                    {dashboard.services.map((service) => (
                      <label key={service.id} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                        <input
                          className="h-5 w-5 accent-blue-600"
                          checked={counterForm.activeServiceIds.includes(service.id)}
                          type="checkbox"
                          onChange={(event) =>
                            setCounterForm((current) => ({
                              ...current,
                              activeServiceIds: event.target.checked
                                ? [...current.activeServiceIds, service.id]
                                : current.activeServiceIds.filter((value) => value !== service.id),
                            }))
                          }
                        />
                        <span>{service.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button className="w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto" disabled={createCounter.isPending} onClick={() => createCounter.mutate(counterForm)}>Create counter</Button>
              </div>
            </div>
          </div>

          <div className="space-y-7">
            <div className="section-shell panel-roomy">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Service setup</h3>
              <div className="mt-4 space-y-3">
                {dashboard.services.map((service) => (
                  <div key={service.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{service.name}</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{service.description}</div>
                      </div>
                      <div className="workspace-chip">{service.isActive ? "Active" : "Inactive"}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="workspace-chip">{service.averageServiceMinutes} min average</span>
                      <span className="workspace-chip">Queue cap {service.maxActiveQueue}</span>
                      <span className="workspace-chip">{service.supportsAppointments ? "Appointments enabled" : "Queue only"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-shell panel-roomy">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Counter readiness</h3>
              <div className="mt-4 space-y-3">
                {dashboard.counters.map((counter) => (
                  <div key={counter.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{counter.name}</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{counter.assignedStaffName || "No staff assigned yet"}</div>
                      </div>
                      <div className="workspace-chip">{counter.status}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {counter.activeServiceIds.map((serviceId) => {
                        const service = dashboard.services.find((item) => item.id === serviceId);
                        return (
                          <span key={`${counter.id}-${serviceId}`} className="workspace-chip">
                            {service?.name ?? `Service ${serviceId}`}
                          </span>
                        );
                      })}
                      {!counter.activeServiceIds.length ? <span className="workspace-chip">No services configured</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {section === "messages" ? (
        <InboxPanel
          mode="owner"
          title="Guest messages"
          emptyLabel="Guest conversations now sit in their own workspace so replies, visit context, and archived chats do not get buried under queue controls."
        />
      ) : null}

      {section === "support" ? (
        <SupportInboxPanel
          autoCreate
          mode="requester"
          title="Technical support"
          description="Use support for broken behavior, missing data, or problems that prevent your team from operating the business dashboard normally."
        />
      ) : null}

      {section === "receipts" ? (
        <section className="grid gap-7 2xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.95fr)]">
          <div className="space-y-7">
            <div className="section-shell panel-roomy">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <ReceiptText className="h-5 w-5 text-blue-600" />
                    <h2 className="section-heading text-slate-900 dark:text-slate-100">Digital receipts</h2>
                  </div>
                  <p className="subtle-lead mt-3">
                    Keep receipts tied to completed visits, and explain clearly to staff when receipts are disabled or not yet eligible.
                  </p>
                </div>
                <label className="inline-flex w-fit shrink-0 items-center gap-3 self-start whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <span>Enable receipts</span>
                  <Switch
                    checked={receiptCenter?.supportsReceipts ?? dashboard.business.capabilities.supportsReceipts}
                    onCheckedChange={(checked) => saveReceiptSettings.mutate({ supportsReceipts: checked })}
                  />
                </label>
              </div>
              {!receiptCenter?.supportsReceipts ? (
                <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                  Receipts are currently disabled for this business. Enable them before issuing follow-up records to guests.
                </div>
              ) : null}
            </div>

            <div className="section-shell panel-roomy">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Eligible completed visits</h3>
              <div className="mt-5 space-y-4">
                {(receiptCenter?.eligibleVisits ?? []).map((visit) => {
                  const draftKey = `${visit.visitType}-${visit.id}`;
                  const draft = receiptDrafts[draftKey] ?? initialReceiptDraft;
                  return (
                    <div key={draftKey} className="rounded-[1.5rem] border border-slate-100 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-900/80">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{visit.userName}</div>
                          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {visit.serviceName ?? "General service"} | {visit.visitType === "queue" ? "Live queue" : "Appointment"}
                          </div>
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {formatDateTime(visit.completedAt ?? visit.scheduledFor ?? new Date().toISOString())}
                          </div>
                        </div>
                        {visit.existingReceiptId ? (
                          <Button variant="outline" onClick={() => setSelectedReceiptId(visit.existingReceiptId)}>
                            Open {visit.existingReferenceNumber}
                          </Button>
                        ) : null}
                      </div>

                      {!visit.existingReceiptId ? (
                        <div className="mt-5 grid gap-3">
                          <Input
                            placeholder="Owner note (optional)"
                            value={draft.ownerNote}
                            onChange={(event) => setReceiptDrafts((current) => ({ ...current, [draftKey]: { ...draft, ownerNote: event.target.value } }))}
                          />
                          <div className="grid gap-3 md:grid-cols-2">
                            <Input
                              placeholder="Line item label"
                              value={draft.lineItemLabel}
                              onChange={(event) => setReceiptDrafts((current) => ({ ...current, [draftKey]: { ...draft, lineItemLabel: event.target.value } }))}
                            />
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="Amount in cents"
                              value={draft.amountCents ?? ""}
                              onChange={(event) =>
                                setReceiptDrafts((current) => ({
                                  ...current,
                                  [draftKey]: { ...draft, amountCents: event.target.value === "" ? null : Number(event.target.value) },
                                }))
                              }
                            />
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="Total in cents"
                              value={draft.totalCents ?? ""}
                              onChange={(event) =>
                                setReceiptDrafts((current) => ({
                                  ...current,
                                  [draftKey]: { ...draft, totalCents: event.target.value === "" ? null : Number(event.target.value) },
                                }))
                              }
                            />
                            <Input
                              placeholder="Payment note"
                              value={draft.paymentNote}
                              onChange={(event) => setReceiptDrafts((current) => ({ ...current, [draftKey]: { ...draft, paymentNote: event.target.value } }))}
                            />
                          </div>
                          <Button
                            className="site-primary-button w-full sm:w-auto"
                            disabled={issueReceipt.isPending || !(receiptCenter?.supportsReceipts ?? dashboard.business.capabilities.supportsReceipts)}
                            onClick={() =>
                              issueReceipt.mutate({
                                visitType: visit.visitType,
                                visitId: visit.id,
                                ownerNote: draft.ownerNote,
                                lineItemLabel: draft.lineItemLabel,
                                amountCents: draft.amountCents,
                                totalCents: draft.totalCents,
                                paymentNote: draft.paymentNote,
                              })
                            }
                          >
                            {issueReceipt.isPending ? "Issuing receipt..." : "Issue receipt"}
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-slate-800 dark:text-blue-100">
                          Receipt already issued for this completed visit.
                        </div>
                      )}
                    </div>
                  );
                })}
                {!(receiptCenter?.eligibleVisits ?? []).length ? <div className="empty-panel p-8 text-center">Completed visits eligible for receipts will appear here.</div> : null}
              </div>
            </div>
          </div>

          <div className="space-y-7">
            <div className="section-shell panel-roomy">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Issued receipts</h3>
              <div className="mt-5 space-y-3">
                {(receiptCenter?.receipts ?? []).map((receipt) => (
                  <button
                    key={receipt.id}
                    className={`w-full rounded-[1.3rem] border p-4 text-left transition ${
                      selectedReceipt?.id === receipt.id
                        ? "border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-slate-900"
                        : "border-slate-100 bg-white/80 hover:border-blue-200 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900/80"
                    }`}
                    type="button"
                    onClick={() => setSelectedReceiptId(receipt.id)}
                  >
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{receipt.referenceNumber}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{receipt.userName} | {receipt.serviceName ?? "General service"}</div>
                  </button>
                ))}
                {!(receiptCenter?.receipts ?? []).length ? <div className="empty-panel p-8 text-center">No receipts have been issued yet.</div> : null}
              </div>
            </div>

            <div className="section-shell panel-roomy">
              {selectedReceipt ? <ReceiptPreviewCard receipt={selectedReceipt} /> : <div className="empty-panel p-10 text-center">Issue or select a receipt to preview the soft-copy version here.</div>}
            </div>
          </div>
        </section>
      ) : null}

      {section === "notifications" ? (
        <NotificationCenter
          scope="owner"
          title="Business notifications"
          subtitle="Notifications should help the team operate: queue changes, appointment updates, guest messages, and important system notices."
        />
      ) : null}

      {section === "analytics" ? (
        <section className="grid gap-7 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
          <div className="section-shell panel-roomy">
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Performance analytics</h2>
            <p className="subtle-lead mt-2">Use analytics to understand throughput, wait time, and service-level pressure without leaving the operator workspace.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Served today</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{analyticsSummary.totalThroughput}</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Avg wait</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{analyticsSummary.averageWait} min</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">No shows</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard.analytics.noShowCount}</div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {dashboard.analytics.servicePerformance.map((service) => (
                <div key={service.serviceId} className="rounded-[1.4rem] border border-slate-100 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{service.serviceName}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{service.throughputToday} completions today</div>
                    </div>
                    <div className="workspace-chip">{service.averageWaitMinutes}m avg wait</div>
                  </div>
                </div>
              ))}
              {!dashboard.analytics.servicePerformance.length ? <div className="empty-panel p-8 text-center">Analytics will start filling in as your team serves guests.</div> : null}
            </div>
          </div>

          <div className="space-y-7">
            <div className="section-shell panel-roomy">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">7-day highlights</h3>
              <div className="mt-5 space-y-4">
                <div className="info-card">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Best day</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{analyticsBestDay?.label ?? "No data yet"}</div>
                </div>
                <div className="info-card">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Peak window</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard.analytics.busiestWindows[0]?.label ?? "No peak yet"}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {section === "feedback" ? (
        <section className="grid gap-7 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
          <div className="section-shell panel-roomy">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-amber-500" />
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Guest feedback and reviews</h2>
            </div>
            <p className="subtle-lead mt-3">Replying here affects what future guests see, so unresolved low ratings and unanswered reviews should stay visible.</p>
            <div className="mt-5 space-y-4">
              {dashboard.feedback.map((feedback) => (
                <div key={feedback.id} className="rounded-[1.5rem] border border-slate-100 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{feedback.userName}</div>
                      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{feedback.visitLabel}</div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star key={`${feedback.id}-${index}`} className={`h-4 w-4 ${index < feedback.rating ? "fill-current" : "text-slate-300 dark:text-slate-700"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{feedback.comment}</div>
                  {feedback.rating <= 3 && !feedback.ownerReply?.trim() ? (
                    <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                      This low-rated review is still visible without an owner reply.
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-3">
                    <Textarea value={feedbackReplies[feedback.id] ?? ""} onChange={(event) => setFeedbackReplies((current) => ({ ...current, [feedback.id]: event.target.value }))} placeholder="Write a business reply" />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        className="site-primary-button"
                        disabled={replyToFeedback.isPending || (feedbackReplies[feedback.id] ?? "").trim().length < 2}
                        onClick={() => replyToFeedback.mutate({ id: feedback.id, reply: feedbackReplies[feedback.id] ?? "" })}
                      >
                        <MessageCircleReply className="mr-2 h-4 w-4" />
                        {feedback.ownerReply ? "Update reply" : "Reply to feedback"}
                      </Button>
                      {feedback.ownerReply ? <div className="text-sm text-slate-500 dark:text-slate-400">Guests will see this reply on the business page.</div> : null}
                    </div>
                  </div>
                </div>
              ))}
              {!dashboard.feedback.length ? <div className="empty-panel p-8 text-center">No guest feedback has been submitted yet.</div> : null}
            </div>
          </div>

          <div className="space-y-7">
            <div className="section-shell panel-roomy">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Review summary</h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className="info-card">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Average rating</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {dashboard.feedback.length ? (dashboard.feedback.reduce((sum, item) => sum + item.rating, 0) / dashboard.feedback.length).toFixed(1) : "0.0"}
                  </div>
                </div>
                <div className="info-card">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Awaiting reply</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard.feedback.filter((item) => !item.ownerReply?.trim()).length}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {section === "settings" ? (
        <section className="grid gap-7 2xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-7">
            <div className="section-shell panel-roomy">
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-blue-600" />
                <h2 className="section-heading text-slate-900 dark:text-slate-100">Business settings</h2>
              </div>
              <p className="subtle-lead mt-3">Keep the public-facing profile accurate, because this information directly affects guest trust and search quality.</p>
              {dashboard.setupWarnings.length ? (
                <div className="mt-5 space-y-3">
                  {dashboard.setupWarnings.map((warning) => (
                    <div key={warning} className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                      {warning}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Business name</div>
                  <Input className="mt-2" value={businessProfileForm.name} onChange={(event) => setBusinessProfileForm((current) => ({ ...current, name: event.target.value }))} placeholder="Business name" />
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Contact</div>
                  <div className="mt-2 grid gap-3">
                    <Input value={businessProfileForm.phone} onChange={(event) => setBusinessProfileForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Business phone" />
                    <Input type="email" value={businessProfileForm.email} onChange={(event) => setBusinessProfileForm((current) => ({ ...current, email: event.target.value }))} placeholder="Business email" />
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Address</div>
                  <Textarea className="mt-2" value={businessProfileForm.address} onChange={(event) => setBusinessProfileForm((current) => ({ ...current, address: event.target.value }))} placeholder="Business address" />
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    <Globe className="h-3.5 w-3.5" />
                    Website
                  </div>
                  <Input className="mt-2" value={businessProfileForm.websiteUrl} onChange={(event) => setBusinessProfileForm((current) => ({ ...current, websiteUrl: event.target.value }))} placeholder="https://company.com" />
                </div>
              </div>
              <div className="mobile-button-row mt-5">
                <Button className="site-primary-button w-full sm:w-auto" disabled={saveBusinessProfile.isPending} onClick={() => saveBusinessProfile.mutate(businessProfileForm)}>
                  {saveBusinessProfile.isPending ? "Saving business details..." : "Save business details"}
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  variant="outline"
                  onClick={() =>
                    setBusinessProfileForm({
                      name: dashboard.business.name,
                      phone: dashboard.business.phone ?? "",
                      email: dashboard.business.email ?? "",
                      address: dashboard.business.address,
                      websiteUrl: dashboard.business.websiteUrl ?? "",
                    })
                  }
                >
                  Reset details
                </Button>
              </div>
            </div>

            <div className="section-shell panel-roomy">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-blue-600" />
                <h2 className="section-heading text-slate-900 dark:text-slate-100">Posted hours</h2>
              </div>
              <p className="subtle-lead mt-3">Hours are part of operational truth. Keep them accurate so guests can trust queue and booking availability.</p>
              <div className="mt-5 space-y-3">
                {hoursForm.map((hour, index) => (
                  <div key={hour.dayOfWeek} className="rounded-2xl border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 lg:min-w-[140px]">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{dayLabels[hour.dayOfWeek]}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{hour.isClosed ? "Closed for this day" : `${hour.openTime} to ${hour.closeTime}`}</div>
                      </div>
                      <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <input
                          type="time"
                          disabled={hour.isClosed}
                          value={hour.openTime}
                          className="flex min-h-[3.15rem] w-full rounded-xl border border-input bg-background/95 px-4 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          onChange={(event) => setHoursForm((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, openTime: event.target.value } : item)))}
                        />
                        <input
                          type="time"
                          disabled={hour.isClosed}
                          value={hour.closeTime}
                          className="flex min-h-[3.15rem] w-full rounded-xl border border-input bg-background/95 px-4 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          onChange={(event) => setHoursForm((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, closeTime: event.target.value } : item)))}
                        />
                        <label className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200 lg:min-w-[8.5rem]">
                          Closed
                          <Switch checked={hour.isClosed} onCheckedChange={(checked) => setHoursForm((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, isClosed: checked } : item)))} />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mobile-button-row mt-5">
                <Button className="site-primary-button w-full sm:w-auto" disabled={saveHours.isPending} onClick={() => saveHours.mutate({ hours: hoursForm })}>
                  {saveHours.isPending ? "Saving hours..." : "Save posted hours"}
                </Button>
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => setHoursForm((dashboard.business.hours.length ? [...dashboard.business.hours] : defaultHours).sort((a, b) => a.dayOfWeek - b.dayOfWeek))}>
                  Reset to current hours
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-7">
            <div className="section-shell panel-roomy">
              <div className="flex items-center gap-3">
                <MessageSquareMore className="h-5 w-5 text-blue-600" />
                <h2 className="section-heading text-slate-900 dark:text-slate-100">Guest notices</h2>
              </div>
              <p className="subtle-lead mt-3">Use notices for real operational guidance, not placeholder messages.</p>
              <div className="mt-5 grid gap-4">
                <Input placeholder="Notice title" value={noticeForm.title} onChange={(event) => setNoticeForm((current) => ({ ...current, title: event.target.value }))} />
                <Textarea placeholder="Message shown to guests" value={noticeForm.message} onChange={(event) => setNoticeForm((current) => ({ ...current, message: event.target.value }))} />
                <select className="field-select" value={noticeForm.severity} onChange={(event) => setNoticeForm((current) => ({ ...current, severity: event.target.value as OwnerNoticeInput["severity"] }))}>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="urgent">Urgent</option>
                </select>
                <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-700">
                  Notice is active
                  <Switch checked={noticeForm.isActive} onCheckedChange={(checked) => setNoticeForm((current) => ({ ...current, isActive: checked }))} />
                </label>
                <Button className="w-full sm:w-auto" onClick={() => createNotice.mutate(noticeForm)}>Publish notice</Button>
              </div>
              <div className="mt-5 space-y-3">
                {dashboard.business.notices.map((notice) => (
                  <div key={notice.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{notice.title}</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notice.message}</div>
                      </div>
                      <span className="workspace-chip">{notice.severity}</span>
                    </div>
                  </div>
                ))}
                {!dashboard.business.notices.length ? <div className="empty-panel p-5">No guest notices are posted right now.</div> : null}
              </div>
            </div>

            <div className="section-shell panel-roomy">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h2 className="section-heading text-slate-900 dark:text-slate-100">Business subscription</h2>
              </div>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Current status: {dashboard.subscription.status}. This pass keeps billing light-touch but makes plan state and cancellation intent clearer to operators.
              </div>
              <div className="mt-5 grid gap-4">
                {dashboard.subscriptionPlans.map((plan) => {
                  const active = dashboard.subscription.plan === plan.plan;
                  return (
                    <div key={plan.plan} className={`rounded-2xl border px-5 py-5 ${active ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-slate-900" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/80"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{plan.name}</div>
                          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{plan.description}</div>
                        </div>
                        {active ? <div className="workspace-chip">Current plan</div> : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {plan.highlights.map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-200">{item}</span>)}
                      </div>
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Button disabled={subscriptionMutation.isPending} className="site-primary-button" onClick={() => subscriptionMutation.mutate({ plan: plan.plan, interval: "monthly", status: "active" })}>Choose monthly</Button>
                        <Button disabled={subscriptionMutation.isPending} variant="outline" onClick={() => subscriptionMutation.mutate({ plan: plan.plan, interval: "yearly", status: "active" })}>Choose yearly</Button>
                        {active ? <Button disabled={subscriptionMutation.isPending} variant="ghost" onClick={() => subscriptionMutation.mutate({ plan: plan.plan, interval: dashboard.subscription.interval, status: "cancelled" })}>Cancel plan</Button> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </RoleWorkspaceShell>
  );
}
