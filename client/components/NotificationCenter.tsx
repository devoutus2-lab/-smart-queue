import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Info, ShieldAlert, Trash2, TriangleAlert, X } from "lucide-react";
import type { NotificationItem } from "@shared/api";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/context/PreferencesContext";
import { useSession } from "@/context/SessionContext";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

type NotificationCenterProps = {
  scope: "user" | "owner";
  title: string;
  subtitle: string;
};

const severityStyles: Record<
  NotificationItem["severity"],
  { bar: string; icon: string; detailIcon: string; label: string }
> = {
  success: {
    bar: "border-green-500 bg-green-100 text-green-900 dark:border-green-700 dark:bg-green-950/70 dark:text-green-100",
    icon: "text-green-600 dark:text-green-300",
    detailIcon: "bg-green-500",
    label: "Success",
  },
  info: {
    bar: "border-blue-500 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-950/70 dark:text-blue-100",
    icon: "text-blue-600 dark:text-blue-300",
    detailIcon: "bg-blue-500",
    label: "Info",
  },
  warning: {
    bar: "border-yellow-500 bg-yellow-100 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/70 dark:text-yellow-100",
    icon: "text-yellow-600 dark:text-yellow-300",
    detailIcon: "bg-yellow-500",
    label: "Warning",
  },
  error: {
    bar: "border-red-500 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950/70 dark:text-red-100",
    icon: "text-red-600 dark:text-red-300",
    detailIcon: "bg-red-500",
    label: "Error",
  },
};

function getSeverityIcon(severity: NotificationItem["severity"]) {
  if (severity === "success") return Info;
  if (severity === "warning") return TriangleAlert;
  if (severity === "error") return ShieldAlert;
  return Info;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function permissionKey(scope: "user" | "owner") {
  return `qtech_notifications_permission_seen_${scope}`;
}

export default function NotificationCenter({ scope, title, subtitle }: NotificationCenterProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { desktopNotifications } = usePreferences();
  const accountScope = getAccountScope(user);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [permissionDismissed, setPermissionDismissed] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<number[]>([]);
  const hasAutoSelected = useRef(false);

  const notificationsQuery = useQuery({
    queryKey: accountQueryKeys.notifications(accountScope.role, accountScope.userId),
    queryFn: api.getNotifications,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = notifications.filter((item) => !item.isRead).length;

  useEffect(() => {
    if (!notifications.length) {
      setSelectedId(null);
      hasAutoSelected.current = false;
      return;
    }
    if (selectedId === null && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      setSelectedId(notifications[0].id);
      return;
    }
    if (selectedId != null && !notifications.some((item) => item.id === selectedId)) {
      setSelectedId(notifications[0].id);
    }
  }, [notifications, selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPermissionDismissed(window.localStorage.getItem(permissionKey(scope)) === "true");
  }, [scope]);

  const selectedNotification = useMemo(
    () => (selectedId == null ? null : notifications.find((item) => item.id === selectedId) ?? notifications[0] ?? null),
    [notifications, selectedId],
  );

  const markReadMutation = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.notifications(accountScope.role, accountScope.userId) });
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(accountScope.userId) });
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.ownerDashboard(accountScope.ownerBusinessId) });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.notifications(accountScope.role, accountScope.userId) });
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(accountScope.userId) });
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.ownerDashboard(accountScope.ownerBusinessId) });
    },
  });
  const deleteOneMutation = useMutation({
    mutationFn: api.deleteNotification,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.notifications(accountScope.role, accountScope.userId) });
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(accountScope.userId) });
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.ownerDashboard(accountScope.ownerBusinessId) });
    },
  });
  const deleteManyMutation = useMutation({
    mutationFn: api.deleteNotifications,
    onSuccess: async () => {
      setSelectedForDelete([]);
      setSelectionMode(false);
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.notifications(accountScope.role, accountScope.userId) });
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(accountScope.userId) });
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.ownerDashboard(accountScope.ownerBusinessId) });
    },
  });

  const shouldShowPermissionCard =
    desktopNotifications &&
    !permissionDismissed &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "default";

  const handlePermissionDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(permissionKey(scope), "true");
    }
    setPermissionDismissed(true);
  };

  const handlePermissionAllow = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      await Notification.requestPermission();
    } catch {}
    handlePermissionDismiss();
  };

  const toggleDeleteSelection = (id: number) => {
    setSelectedForDelete((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_20rem]">
      <div className="section-shell panel-roomy">
        <div className="toolbar-row">
          <div>
            <h2 className="section-heading text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="subtle-lead mt-2">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="workspace-chip">{unreadCount} unread</div>
            <Button disabled={!unreadCount || markAllMutation.isPending} variant="outline" onClick={() => markAllMutation.mutate()}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectionMode((current) => !current);
                setSelectedForDelete([]);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {selectionMode ? "Cancel delete" : "Choose delete"}
            </Button>
            {selectionMode ? (
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={!selectedForDelete.length || deleteManyMutation.isPending}
                onClick={() => deleteManyMutation.mutate(selectedForDelete)}
              >
                Delete selected
              </Button>
            ) : null}
          </div>
        </div>

        {shouldShowPermissionCard ? (
          <div className="mt-6 flex justify-center rounded-[1.8rem] border border-slate-200/80 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex w-full max-w-[18rem] flex-col items-center gap-3 rounded-[1.25rem] bg-slate-100 px-7 py-6 text-center shadow-sm dark:bg-slate-900">
              <Bell className="h-12 w-12 text-blue-600 dark:text-blue-300" />
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Enable notifications</div>
              <div className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                Stay updated on queues, messages, appointment changes, and important system events.
              </div>
              <div className="flex w-full flex-col gap-2 pt-2">
                <button
                  className="h-9 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-700"
                  onClick={handlePermissionAllow}
                  type="button"
                >
                  Allow notifications
                </button>
                <button
                  className="h-9 rounded-full text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:hover:bg-slate-800"
                  onClick={handlePermissionDismiss}
                  type="button"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-2">
          {notifications.map((notification) => {
            const Icon = getSeverityIcon(notification.severity);
            const styles = severityStyles[notification.severity];
            const isSelected = selectedNotification?.id === notification.id;
            return (
              <button
                key={notification.id}
                className={`flex w-full items-center rounded-lg border-l-4 p-3 text-left transition duration-300 hover:scale-[1.01] ${styles.bar} ${
                  isSelected ? "ring-2 ring-blue-300 dark:ring-blue-800" : ""
                } ${notification.isRead ? "opacity-75" : ""}`}
                onClick={() => {
                  if (selectionMode) {
                    toggleDeleteSelection(notification.id);
                    return;
                  }
                  setSelectedId(notification.id);
                  if (notification.actionHref) navigate(notification.actionHref);
                }}
                type="button"
              >
                {selectionMode ? (
                  <span
                    className={`mr-3 inline-flex h-5 w-5 items-center justify-center rounded border text-[11px] font-bold ${
                      selectedForDelete.includes(notification.id)
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-current/30 bg-white/50 text-current dark:bg-slate-950/40"
                    }`}
                  >
                    {selectedForDelete.includes(notification.id) ? "x" : ""}
                  </span>
                ) : null}
                <Icon className={`mr-2 h-5 w-5 flex-shrink-0 ${styles.icon}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {styles.label} {notification.category ? `- ${notification.category}` : ""} - {notification.title}
                  </p>
                  <p className="mt-1 text-xs opacity-80">{notification.message}</p>
                </div>
                {!notification.isRead ? <span className="ml-3 h-2.5 w-2.5 rounded-full bg-current opacity-60" /> : null}
              </button>
            );
          })}
          {!notifications.length ? <div className="empty-panel">You&apos;re all caught up. New queue, message, and system updates will appear here.</div> : null}
        </div>
      </div>

      <aside className="section-shell panel-roomy xl:sticky xl:top-28">
        {selectedNotification ? (
          <>
            <div className="flex items-center gap-4">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white ${severityStyles[selectedNotification.severity].detailIcon}`}>
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-500 dark:text-slate-400">{selectedNotification.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(selectedNotification.createdAt)}</div>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 transition hover:bg-red-500 hover:text-white"
                onClick={() => setSelectedId(null)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedNotification.message}</div>

            <div className="mt-6 space-y-2">
              {selectedNotification.actionHref ? (
                <Button className="w-full" variant="outline" onClick={() => navigate(selectedNotification.actionHref!)}>
                  {selectedNotification.actionLabel ?? "Open related screen"}
                </Button>
              ) : null}
              <Button
                className="w-full"
                disabled={selectedNotification.isRead || markReadMutation.isPending}
                onClick={() => markReadMutation.mutate(selectedNotification.id)}
              >
                Mark as read
              </Button>
              <Button
                className="w-full bg-red-600 text-white hover:bg-red-700"
                disabled={deleteOneMutation.isPending}
                onClick={() => deleteOneMutation.mutate(selectedNotification.id, { onSuccess: () => setSelectedId(null) })}
              >
                Quick delete
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setSelectedId(null)}
              >
                Close detail
              </Button>
            </div>
          </>
        ) : (
          <div className="empty-panel p-5">Select a notification to see the full detail card.</div>
        )}
      </aside>
    </section>
  );
}
