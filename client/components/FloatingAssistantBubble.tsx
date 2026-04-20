import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Send, Settings2, Shield, Wand2, X } from "lucide-react";
import type { AssistantActionProposal, AssistantThreadMessage, AssistantRequest } from "@shared/api";
import { ConversationRatingCard } from "@/components/ConversationRatingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEasterEgg } from "@/context/EasterEggContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useSession } from "@/context/SessionContext";
import { useAssistantThread } from "@/hooks/useAssistantThread";
import { getSupportRouteForRole } from "@/lib/navigation";
import assistantBubbleLogo from "@/assets/assistant-q-logo.jpg";

function getPageContext(pathname: string) {
  if (pathname.startsWith("/queue-preview/")) {
    const queueSegments = pathname.split("/");
    const entryId = Number(queueSegments[queueSegments.length - 1]);
    return {
      label: "Live queue card",
      path: pathname,
      queueEntryId: Number.isNaN(entryId) ? null : entryId,
      businessId: null,
      prompts: [
        "How long until my turn and what should I do next?",
        "Should I pause, let the next guest go first, or rejoin later?",
      ],
    };
  }

  if (pathname.startsWith("/business/")) {
    const businessSegments = pathname.split("/");
    const businessId = Number(businessSegments[businessSegments.length - 1]);
    return {
      label: "Business page",
      path: pathname,
      queueEntryId: null,
      businessId: Number.isNaN(businessId) ? null : businessId,
      prompts: [
        "Help me decide whether to join now or book for later.",
        "What can I do from this business page right now?",
      ],
    };
  }

  if (pathname.startsWith("/places/external/")) {
    return {
      label: "Place details",
      path: pathname,
      queueEntryId: null,
      businessId: null,
      prompts: [
        "What details can I use from this place page?",
        "How do I bring this business into Smart Queue?",
      ],
    };
  }

  if (pathname === "/account") {
    return {
      label: "Guest home",
      path: pathname,
      queueEntryId: null,
      businessId: null,
      prompts: [
        "Summarize what matters most on my home screen.",
        "What route should I open next from my account home?",
      ],
    };
  }

  if (pathname.startsWith("/account/search")) {
    return {
      label: "Account search",
      path: pathname,
      queueEntryId: null,
      businessId: null,
      prompts: [
        "Help me narrow this business search quickly.",
        "What filters should I change to find a better option?",
      ],
    };
  }

  if (pathname.startsWith("/account/map")) {
    return {
      label: "Account map",
      path: pathname,
      queueEntryId: null,
      businessId: null,
      prompts: [
        "How should I use the map and nearby view together?",
        "What should I compare before leaving for a business?",
      ],
    };
  }

  if (pathname.startsWith("/account/messages")) {
    return {
      label: "Business messages",
      path: pathname,
      queueEntryId: null,
      businessId: null,
      prompts: [
        "Help me phrase a quick question to a business.",
        "What should I ask before leaving for my visit?",
      ],
    };
  }

  if (pathname.startsWith("/account/queues")) {
    return {
      label: "Live queues",
      path: pathname,
      queueEntryId: null,
      businessId: null,
      prompts: [
        "Which live queue needs my attention first?",
        "Explain what to do if my ETA changes.",
      ],
    };
  }

  if (pathname.startsWith("/account/appointments")) {
    return {
      label: "Appointments",
      path: pathname,
      queueEntryId: null,
      businessId: null,
      prompts: [
        "What should I review before an appointment?",
        "Help me compare appointments with live queue options.",
      ],
    };
  }

  if (pathname.startsWith("/account/profile")) {
    return {
      label: "Profile",
      path: pathname,
      queueEntryId: null,
      businessId: null,
      prompts: [
        "What profile details matter most for visits?",
        "Help me improve my account details.",
      ],
    };
  }

  if (pathname.startsWith("/account/settings")) {
    return {
      label: "Account settings",
      path: pathname,
      queueEntryId: null,
      businessId: null,
      prompts: [
        "What settings should I review first?",
        "Explain these account preferences in simple words.",
      ],
    };
  }

  if (pathname.startsWith("/business-dashboard")) {
    return {
      label: "Business dashboard",
      path: pathname,
      queueEntryId: null,
      businessId: null,
      prompts: [
        "What should I focus on first in my dashboard?",
        "Help me explain a queue delay clearly to guests.",
      ],
    };
  }

  return {
    label: "Admin panel",
    path: pathname,
    queueEntryId: null,
    businessId: null,
    prompts: [
      "What should I review first in the admin panel?",
      "Explain claim requests and subscriptions in plain words.",
    ],
  };
}

function shouldShowQuickHelp(pathname: string) {
  return (
    pathname.startsWith("/account") ||
    pathname.startsWith("/business-dashboard") ||
    pathname.startsWith("/admin-panel") ||
    pathname.startsWith("/queue-preview/") ||
    pathname.startsWith("/business/") ||
    pathname.startsWith("/places/external/")
  );
}

function getRoleTitle(role: "user" | "owner" | "admin") {
  if (role === "owner") return "Business dashboard help";
  if (role === "admin") return "Admin panel help";
  return "Guest account help";
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderMessageBubble(message: AssistantThreadMessage) {
  const isUser = message.role === "user";
  return (
    <div key={message.id} className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(message.createdAt)}</div>
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-tr-md bg-[linear-gradient(135deg,#2457d6,#4c73ef,#d1a447)] px-3 py-2 text-right text-sm text-white"
            : `max-w-[88%] rounded-2xl rounded-tl-md border px-3 py-2 text-sm leading-6 ${
                message.kind === "support_referral"
                  ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              }`
        }
      >
        {message.body}
      </div>
    </div>
  );
}

export function FloatingAssistantBubble() {
  const { user } = useSession();
  const { aiAssistant } = usePreferences();
  const { triggerLogoTap, tryTriggerFromAssistantPrompt } = useEasterEgg();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [panelMetaOpen, setPanelMetaOpen] = useState(false);
  const [panelSize, setPanelSize] = useState({ width: 432, height: 560 });
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const resizeStateRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const threadViewportRef = useRef<HTMLDivElement | null>(null);

  const context = useMemo(() => getPageContext(location.pathname), [location.pathname]);
  const { thread, askAssistant, executeAssistantAction, submitAssistantFeedback } = useAssistantThread(user);
  const latestResponse = executeAssistantAction.data ?? askAssistant.data ?? null;
  const actionProposal = askAssistant.data?.status === "needs_confirmation" ? askAssistant.data.actionProposal : null;
  const latestThreadMessage = latestResponse?.thread?.messages?.[latestResponse.thread.messages.length - 1] ?? null;
  const latestRateableMessage = [...(thread?.messages ?? [])].reverse().find((message) => message.role === "assistant" && message.canRate) ?? null;

  useEffect(() => {
    setPrompt("");
  }, [user?.id, user?.role]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      const current = resizeStateRef.current;
      if (!current) return;
      const nextWidth = Math.min(Math.max(current.startWidth + (current.startX - event.clientX), 360), 720);
      const nextHeight = Math.min(Math.max(current.startHeight + (current.startY - event.clientY), 420), 820);
      setPanelSize({ width: nextWidth, height: nextHeight });
    }

    function handlePointerUp() {
      resizeStateRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    if (!open || !threadViewportRef.current) return;
    threadViewportRef.current.scrollTop = threadViewportRef.current.scrollHeight;
  }, [open, thread?.messages.length, askAssistant.isPending, executeAssistantAction.isPending]);

  if (!user || !aiAssistant || !shouldShowQuickHelp(location.pathname)) {
    return null;
  }

  const submitPrompt = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    if (tryTriggerFromAssistantPrompt(clean)) {
      setPrompt("");
      return;
    }
    setPrompt("");
    askAssistant.mutate({
      prompt: clean,
      businessId: context.businessId ?? (user.role === "owner" ? user.businessId : null),
      queueEntryId: context.queueEntryId,
      conversationId: null,
      appointmentId: null,
      pageContext: {
        label: context.label,
        path: context.path,
      },
    } satisfies AssistantRequest);
  };

  return (
    <>
      {open ? (
        <div
          className="fixed left-3 right-3 z-50 flex flex-col overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_24px_70px_-28px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950 sm:left-auto sm:right-6 sm:rounded-[1.5rem]"
          style={
            isMobileViewport
              ? {
                  bottom: "calc(5rem + env(safe-area-inset-bottom))",
                  height: "min(72vh, 40rem)",
                }
              : {
                  bottom: "6rem",
                  width: `min(${panelSize.width}px, calc(100vw - 3rem))`,
                  height: `min(${panelSize.height}px, calc(100vh - 7rem))`,
                }
          }
        >
          <div className="relative flex items-center justify-between border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,255,0.96))] px-4 py-3 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.95))]">
            <div className="flex items-center gap-3">
              <img
                alt="Smart Queue Assistant"
                className="h-10 w-10 rounded-2xl object-cover shadow-sm ring-1 ring-blue-100 dark:ring-slate-800"
                src={assistantBubbleLogo}
                onClick={(event) => {
                  const opened = triggerLogoTap("assistant-panel", event.detail);
                  if (opened) {
                    event.preventDefault();
                    event.stopPropagation();
                  }
                }}
              />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Q Assistant</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{getRoleTitle(user.role)}</div>
              </div>
            </div>
            <div className="relative flex items-center gap-1">
              <button
                className="group peer rounded-full p-2 text-slate-500 transition hover:bg-slate-100 focus:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-900 dark:focus:bg-slate-800"
                onClick={() => setPanelMetaOpen((current) => !current)}
                type="button"
              >
                <Settings2 className="h-5 w-5 transition-transform group-hover:rotate-90 group-focus:rotate-90" />
              </button>
              <button
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
              <div
                className={`absolute right-0 top-full mt-2 w-56 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg transition ${
                  panelMetaOpen ? "visible opacity-100" : "invisible opacity-0"
                }`}
              >
                <div>Focused on: {context.label}</div>
                <div className="mt-1 text-slate-300">Thread is isolated to this signed-in account.</div>
              </div>
            </div>
          </div>

          <div
            ref={threadViewportRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,rgba(247,249,255,0.92),rgba(255,255,255,0.98))] px-3 py-3 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.96))] sm:px-4 sm:py-4"
          >
            {!thread?.messages.length ? (
              <>
                <div className="flex flex-col items-start gap-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(new Date().toISOString())}</div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    Ask about queues, appointments, businesses, messages, timing, settings, dashboards, and what to do next.
                  </div>
                </div>

                <div className="flex flex-col items-start gap-1">
                  <div className="flex max-w-[88%] items-start gap-2 rounded-2xl rounded-tl-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Technical problems, broken screens, and account issues should go straight to Smart Queue support or technical support.</span>
                  </div>
                </div>
              </>
            ) : null}

            {thread?.messages.map(renderMessageBubble)}

            {askAssistant.isPending ? (
              <div className="flex flex-col items-start gap-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(new Date().toISOString())}</div>
                <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-md bg-slate-100 px-3 py-3 dark:bg-slate-900">
                  <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <div className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                  <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>
              </div>
            ) : null}

            {latestResponse?.status === "refused" && latestResponse.refusalReason ? (
              <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{latestResponse.refusalReason}</div>
              </div>
            ) : null}

            {actionProposal ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  <Wand2 className="h-4 w-4" />
                  Action ready for confirmation
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{actionProposal.confirmationMessage}</div>
                <div className="mobile-button-row mt-3">
                  <Button
                    className="site-primary-button w-full sm:w-auto"
                    disabled={executeAssistantAction.isPending}
                    onClick={() => executeAssistantAction.mutate(actionProposal as AssistantActionProposal)}
                  >
                    {executeAssistantAction.isPending ? "Working..." : "Confirm action"}
                  </Button>
                  <Button className="w-full sm:w-auto" variant="outline" onClick={() => askAssistant.reset()}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {executeAssistantAction.data?.actionResult ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <CheckCircle2 className={`h-4 w-4 ${executeAssistantAction.data.actionResult.success ? "text-emerald-600" : "text-red-500"}`} />
                  {executeAssistantAction.data.actionResult.success ? "Action completed" : "Action could not be completed"}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {executeAssistantAction.data.actionResult.message}
                </div>
              </div>
            ) : null}

            {latestResponse?.nextSteps?.length ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Helpful suggestions</div>
                <div className="mt-3 space-y-2">
                  {latestResponse.nextSteps.map((step) => (
                    <div key={step} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {latestThreadMessage?.kind === "support_referral" ? (
              <Button asChild className="site-primary-button w-full sm:w-auto">
                <Link to={getSupportRouteForRole(user.role)}>Open support chat</Link>
              </Button>
            ) : null}

            {!askAssistant.isPending && latestRateableMessage ? (
              <ConversationRatingCard
                description="Rate how helpful this answer felt so the assistant keeps sounding clear, friendly, and useful."
                submitLabel="Rate assistant"
                onSubmit={async (rating) => {
                  await submitAssistantFeedback.mutateAsync({
                    threadId: latestRateableMessage.threadId,
                    assistantMessageId: latestRateableMessage.id,
                    rating,
                    comment: "",
                  });
                }}
              />
            ) : null}
          </div>

          <div className="shrink-0 border-t border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(247,249,255,0.95))] px-4 py-3 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.97),rgba(2,6,23,0.98))]">
            <div className="mobile-chip-row mb-3">
              {context.prompts.map((item) => (
                <button
                  key={item}
                  className="mobile-pill-button min-h-10 border border-blue-100 bg-blue-50 px-3 py-1.5 text-left text-xs font-semibold text-blue-700 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  onClick={() => setPrompt(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="relative">
              <Input
                className="h-11 rounded-b-[1rem] rounded-t-[0.9rem] border-slate-200 bg-slate-100 pr-12 text-sm focus-visible:ring-blue-500/40 dark:border-slate-800 dark:bg-slate-900"
                placeholder="Ask about this screen or what to do next"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitPrompt(prompt);
                  }
                }}
              />
              <button
                className="absolute inset-y-0 right-1 my-auto rounded-full p-2 text-blue-600 transition hover:bg-slate-200 dark:hover:bg-slate-800"
                disabled={!prompt.trim() || askAssistant.isPending}
                onClick={() => submitPrompt(prompt)}
                type="button"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!isMobileViewport ? (
            <button
              aria-label="Resize assistant"
              className="absolute bottom-1 left-1 h-5 w-5 cursor-nwse-resize rounded-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-200"
              onMouseDown={(event) => {
                resizeStateRef.current = {
                  startX: event.clientX,
                  startY: event.clientY,
                  startWidth: panelSize.width,
                  startHeight: panelSize.height,
                };
                document.body.style.userSelect = "none";
                document.body.style.cursor = "nwse-resize";
              }}
              type="button"
            >
              <svg viewBox="0 0 20 20" className="h-full w-full" fill="currentColor" aria-hidden="true">
                <path d="M6 14h2v2H6zm4-4h2v2h-2zm4-4h2v2h-2zm-4 8h2v2h-2zm4-4h2v2h-2z" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-950 shadow-2xl transition hover:scale-[1.03] sm:bottom-6 sm:right-6"
        onClick={(event) => {
          const opened = triggerLogoTap("assistant-bubble", event.detail);
          if (opened) {
            return;
          }
          setOpen((current) => !current);
        }}
        type="button"
      >
        <img alt="Open Smart Queue Assistant" className="h-full w-full object-cover" src={assistantBubbleLogo} />
      </button>
    </>
  );
}
