import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueueRealtimeEvent } from "@shared/api";
import { ArrowLeft, Pause, Play, RotateCw, XCircle } from "lucide-react";
import { AppLoadingState } from "@/components/AppLoadingState";
import { CachedDataNote } from "@/components/CachedDataNote";
import { InboxPanel } from "@/components/InboxPanel";
import { Button } from "@/components/ui/button";
import { demoQueueEntry } from "@/demo/demoData";
import { useDemoMode } from "@/context/DemoModeContext";
import { api } from "@/lib/api";
import { useQueueNotifications } from "@/hooks/useQueueNotifications";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { usePreferences } from "@/context/PreferencesContext";
import { useSession } from "@/context/SessionContext";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";

function getActionReasonCards(entry: NonNullable<ReturnType<typeof buildQueueEntryLike>>) {
  return [
    {
      key: "pause",
      label: "Pause",
      reason: entry.availableGuestActions.canPause.reason,
      emphasis: entry.availableGuestActions.canPause.allowed
        ? `Available now. This is a short hold only, and it can expire after ${entry.pauseLimitMinutes} minutes.`
        : null,
    },
    {
      key: "resume",
      label: "Resume",
      reason: entry.availableGuestActions.canResume.reason,
      emphasis: entry.pauseExpiresAt ? `Hold expires at ${new Date(entry.pauseExpiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` : null,
    },
    {
      key: "skip",
      label: "Skip",
      reason: entry.availableGuestActions.canSkip.reason,
      emphasis: `Used ${entry.skipsUsed} time${entry.skipsUsed === 1 ? "" : "s"} so far.`,
    },
    {
      key: "reschedule",
      label: "Rejoin later",
      reason: entry.availableGuestActions.canReschedule.reason,
      emphasis: `Used ${entry.reschedulesUsed} time${entry.reschedulesUsed === 1 ? "" : "s"} so far.`,
    },
    {
      key: "cancel",
      label: "Cancel",
      reason: entry.availableGuestActions.canCancel.reason,
      emphasis: entry.availableGuestActions.canCancel.allowed ? "Use this only if you are leaving this visit entirely." : null,
    },
  ];
}

function buildQueueEntryLike(value: unknown) {
  return value as
    | {
        availableGuestActions: {
          canPause: { allowed: boolean; reason: string | null };
          canResume: { allowed: boolean; reason: string | null };
          canSkip: { allowed: boolean; reason: string | null };
          canReschedule: { allowed: boolean; reason: string | null };
          canCancel: { allowed: boolean; reason: string | null };
        };
        pauseLimitMinutes: number;
        pauseExpiresAt: string | null;
        skipsUsed: number;
        reschedulesUsed: number;
      }
    | null;
}

export default function QueuePreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { desktopNotifications } = usePreferences();
  const scope = getAccountScope(user);
  const { entryId } = useParams();
  const currentEntryId = Number(entryId);
  const joinedRecently = new URLSearchParams(location.search).get("joined") === "1";
  const { enabled: demoEnabled, currentPreset } = useDemoMode();
  const isDemoFigure = location.pathname.startsWith("/demo/figure-4") || (demoEnabled && currentPreset === "figure4_queue_tracking");
  const [realtimeEvent, setRealtimeEvent] = useState<QueueRealtimeEvent | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string>("");
  const [syncMessage, setSyncMessage] = useState("");

  const queueQuery = useQuery({ queryKey: accountQueryKeys.myQueue(scope.userId), queryFn: api.getMyQueue, enabled: !isDemoFigure });
  const entry = isDemoFigure ? { ...demoQueueEntry, id: Number.isNaN(currentEntryId) ? demoQueueEntry.id : currentEntryId } : queueQuery.data?.entries.find((item) => item.id === currentEntryId);
  const handleQueueEvent = useCallback((event: QueueRealtimeEvent) => {
    if (event.entryId !== currentEntryId && event.businessId !== entry?.businessId) return;
    setRealtimeEvent(event);
    setSyncMessage(event.message);
  }, [currentEntryId, entry?.businessId]);
  useRealtimeInvalidation(handleQueueEvent);

  useQueueNotifications(
    entry
      ? {
          entryId: entry.id,
          timeRemaining: Math.max(entry.estimatedWaitMinutes, 0) * 60,
          businessName: entry.businessName,
          queuePosition: entry.position ? `#${entry.position}` : "pending",
          status: entry.status,
          desktopEnabled: desktopNotifications,
          realtimeEvent,
        }
      : null,
  );

  const actionMutation = useMutation({
    mutationFn: (action: "pause" | "resume" | "skip" | "reschedule" | "cancel") => api.queueAction(currentEntryId, action),
    onSuccess: async (response) => {
      setActionFeedback(response.result.message);
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.myQueue(scope.userId) });
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(scope.userId) });
    },
  });

  useEffect(() => {
    if (!isDemoFigure && queueQuery.isFetched && !entry) navigate("/account/queues");
  }, [entry, isDemoFigure, navigate, queueQuery.isFetched]);

  if (!entry) {
    return <AppLoadingState title="Loading your live queue card" message="Refreshing your queue status, current position, and next available actions." />;
  }

  const actionReasonCards = getActionReasonCards(buildQueueEntryLike(entry)!);

  return (
    <div className="min-h-screen bg-soft-gradient">
      <header className="workspace-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Button variant="ghost" onClick={() => navigate(isDemoFigure ? "/demo/figure-3" : "/account/queues")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isDemoFigure ? "Back to Figure 3" : "Back to account"}
          </Button>
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">Live queue status</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="rounded-[2.2rem] bg-white p-9 text-slate-900 shadow-luxury dark:bg-slate-950 dark:text-slate-100">
          {isDemoFigure ? (
            <div className="mb-8 rounded-[1.4rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              Figure 4 demo mode is using a stable queue card so you can capture the virtual queue and live tracking interface without waiting for real activity.
            </div>
          ) : null}
          {joinedRecently ? (
            <div className="mb-8 rounded-[1.4rem] border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
              Smart Queue is now holding your place. This live card is the best place to track timing, updates, and the next action.
            </div>
          ) : null}
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">{entry.queueNumber}</div>
            <h1 className="mt-3 text-4xl font-bold text-slate-900">{entry.businessName}</h1>
            <p className="mt-3 text-slate-600">
              Service lane: {entry.serviceName ?? "General"}
              {entry.counterName ? ` | Assigned counter: ${entry.counterName}` : ""}
            </p>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{entry.statusDescription}</p>
            {!isDemoFigure ? (
              <div className="mt-3">
                <CachedDataNote queryKey={accountQueryKeys.myQueue(scope.userId)} />
              </div>
            ) : null}
          </div>

          {actionFeedback ? (
            <div className="mt-8 rounded-[1.4rem] border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
              {actionFeedback}
            </div>
          ) : null}
          {syncMessage && !actionFeedback ? (
            <div className="mt-8 rounded-[1.4rem] border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
              {syncMessage}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl bg-blue-50 p-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Position</div>
              <div className="mt-3 text-4xl font-bold text-slate-900">{entry.position ?? "-"}</div>
            </div>
            <div className="rounded-3xl bg-amber-50 p-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">ETA</div>
              <div className="mt-3 text-4xl font-bold text-slate-900">{entry.estimatedWaitMinutes}m</div>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Status</div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{entry.statusLabel}</div>
            </div>
            <div className="rounded-3xl bg-purple-50 p-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-600">Skips / reschedules</div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{entry.skipsUsed} / {entry.reschedulesUsed}</div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={isDemoFigure || !entry.availableGuestActions.canPause.allowed || actionMutation.isPending} onClick={() => actionMutation.mutate("pause")}>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
            <Button variant="outline" disabled={isDemoFigure || !entry.availableGuestActions.canResume.allowed || actionMutation.isPending} onClick={() => actionMutation.mutate("resume")}>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
            <Button variant="outline" disabled={isDemoFigure || !entry.availableGuestActions.canSkip.allowed || actionMutation.isPending} onClick={() => actionMutation.mutate("skip")}>
              <RotateCw className="mr-2 h-4 w-4" />
              Let next guest go first
            </Button>
            <Button variant="outline" disabled={isDemoFigure || !entry.availableGuestActions.canReschedule.allowed || actionMutation.isPending} onClick={() => actionMutation.mutate("reschedule")}>
              <RotateCw className="mr-2 h-4 w-4" />
              Rejoin later
            </Button>
            <Button variant="destructive" disabled={isDemoFigure || !entry.availableGuestActions.canCancel.allowed || actionMutation.isPending} onClick={() => actionMutation.mutate("cancel")}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {entry.availableGuestActions.canPause.allowed
              ? "Pause is available right now if you need a short hold."
              : entry.availableGuestActions.canResume.allowed
                ? "Your hold is active. Resume before the pause limit ends."
                : entry.availableGuestActions.canReschedule.reason ?? "Queue actions will adjust as the business moves your visit forward."}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {actionReasonCards.map((item) => (
              <div key={item.key} className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{item.label}</div>
                <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">
                  {item.reason ?? "Available right now"}
                </div>
                {item.emphasis ? <div className="mt-2 text-slate-600 dark:text-slate-300">{item.emphasis}</div> : null}
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-7 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <p>Your hold can stay paused for up to {entry.pauseLimitMinutes} minutes.</p>
              <p>{entry.pauseExpiresAt ? `Current hold ends at ${new Date(entry.pauseExpiresAt).toLocaleTimeString()}.` : "Your place remains active while the business keeps the queue moving."}</p>
              <p>Assigned staff: {entry.staffName ?? "Not assigned yet"}.</p>
              <p>{desktopNotifications ? "Browser alerts follow actual queue updates and still send ETA reminders while you wait." : "Enable desktop notifications in Settings if you want queue alerts outside the app."}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-slate-900">Queue timeline</h2>
              <div className="mt-4 space-y-3">
                {entry.timeline.map((event) => (
                  <div key={event.id} className="rounded-2xl bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">{event.eventType}</div>
                    <div className="mt-1 font-semibold text-slate-900">{event.label}</div>
                    <div className="mt-1 text-sm text-slate-500">{new Date(event.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-7 xl:grid-cols-[1.02fr_0.98fr]">
            {isDemoFigure ? (
              <div className="section-shell panel-roomy">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                  Visit messaging preview
                </div>
                <div className="mt-4 rounded-[1.4rem] bg-slate-50 p-5 dark:bg-slate-900">
                  <div className="rounded-[1.2rem] bg-white p-4 text-sm shadow-sm dark:bg-slate-950">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">Downtown Bank & Trust</div>
                    <div className="mt-2 text-slate-600 dark:text-slate-300">We&apos;re moving steadily. You should be called shortly.</div>
                  </div>
                  <div className="mt-3 rounded-[1.2rem] bg-blue-600 p-4 text-sm text-white shadow-sm">
                    Thank you. I&apos;m nearby and heading in once the queue moves closer.
                  </div>
                </div>
              </div>
            ) : (
              <InboxPanel
                mode="user"
                title="Message the business"
                emptyLabel="Start a visit message here, then come back later if you need to review the archived conversation."
                businessId={entry.businessId}
                autoCreate
              />
            )}
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6 text-sm leading-7 text-blue-900 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-200">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Why these actions matter</div>
              <div className="mt-3">
                Pause holds your place briefly, skip moves you behind the next waiting guests, and rejoin later gives you a fresh estimate when your timing changes.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
