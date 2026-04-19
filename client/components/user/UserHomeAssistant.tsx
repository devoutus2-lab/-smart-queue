import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Send, Sparkles, Wand2 } from "lucide-react";
import { ConversationRatingCard } from "@/components/ConversationRatingCard";
import type { UserDashboard } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import { useAssistantThread } from "@/hooks/useAssistantThread";
import { getSupportRouteForRole } from "@/lib/navigation";

type UserHomeAssistantProps = {
  dashboard?: UserDashboard;
};

const starterPrompts = [
  "Summarize what I should focus on first in my account today.",
  "Based on my current account, what should I do before leaving home?",
  "Which route should I open next: search, map, queues, or messages?",
];

export default function UserHomeAssistant({ dashboard }: UserHomeAssistantProps) {
  const { user } = useSession();
  const [prompt, setPrompt] = useState("");
  const { thread, askAssistant, submitAssistantFeedback } = useAssistantThread(user);

  const summaryLine = useMemo(() => {
    const activeQueues = dashboard?.activeEntries.length ?? 0;
    const appointments = dashboard?.upcomingAppointments.length ?? 0;
    const savedPlaces = dashboard?.savedPlaces.length ?? 0;
    return `You currently have ${activeQueues} live queue${activeQueues === 1 ? "" : "s"}, ${appointments} appointment${appointments === 1 ? "" : "s"}, and ${savedPlaces} saved place${savedPlaces === 1 ? "" : "s"}.`;
  }, [dashboard]);

  useEffect(() => {
    setPrompt("");
  }, [user?.id, user?.role]);

  const submitPrompt = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setPrompt("");
    askAssistant.mutate({
      prompt: clean,
      businessId: null,
      queueEntryId: dashboard?.activeEntries[0]?.id ?? null,
      conversationId: null,
      appointmentId: dashboard?.upcomingAppointments[0]?.id ?? null,
      pageContext: {
        label: "Guest home assistant",
        path: "/account",
      },
    });
  };

  const latestResponse = askAssistant.data;
  const recentMessages = thread?.messages.slice(-6) ?? [];
  const latestThreadMessage = latestResponse?.thread?.messages?.[latestResponse.thread.messages.length - 1] ?? null;
  const latestRateableMessage = [...(thread?.messages ?? [])].reverse().find((message) => message.role === "assistant" && message.canRate) ?? null;

  return (
    <section className="section-shell panel-roomy">
      <div className="toolbar-row">
        <div>
          <div className="workspace-chip">
            <Wand2 className="h-4 w-4" />
            Home assistant
          </div>
          <h2 className="mt-4 section-heading text-slate-900 dark:text-slate-100">A.I. guidance for what to do next</h2>
          <p className="subtle-lead mt-2">
            This assistant is focused on your signed-in home: priorities, next steps, and which part of the app you should open next.
          </p>
        </div>
        <div className="rounded-[1.3rem] border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-200">
          {summaryLine}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.82fr)]">
        <div className="rounded-[1.6rem] bg-slate-50 p-5 dark:bg-slate-900">
          <div className="flex flex-col items-start gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Suggested prompts</div>
            <div className="flex flex-wrap gap-2">
              {starterPrompts.map((starter) => (
                <button
                  key={starter}
                  className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                  onClick={() => submitPrompt(starter)}
                  type="button"
                >
                  <Sparkles className="mr-2 inline h-4 w-4" />
                  Ask this
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            {!recentMessages.length ? (
              <div className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Ask for a quick account summary, the best next route to open, or help deciding whether to search, map, queue, or message first.
              </div>
            ) : (
              <div className="space-y-4">
                {recentMessages.map((message) => (
                  <div key={message.id} className={message.role === "user" ? "text-right" : ""}>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      {message.role === "user" ? "You" : message.kind === "support_referral" ? "Support guidance" : "Assistant"}
                    </div>
                    <div
                      className={`mt-2 rounded-[1.2rem] px-4 py-3 text-sm leading-7 ${
                        message.role === "user"
                          ? "ml-auto max-w-[85%] bg-[linear-gradient(135deg,#2457d6,#4c73ef,#d1a447)] text-white"
                          : message.kind === "support_referral"
                            ? "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                            : "bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      }`}
                    >
                      {message.body}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {askAssistant.isPending ? (
              <div className="mt-5 rounded-[1.4rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                Thinking through your dashboard, queues, appointments, and the right next route...
              </div>
            ) : null}

            {latestResponse?.status === "answered" ? (
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Home-focused guidance ready
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Input
                className="min-h-[52px] flex-1"
                placeholder="Ask what you should do next in your account..."
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitPrompt(prompt);
                  }
                }}
              />
              <Button className="site-primary-button min-w-[140px]" onClick={() => submitPrompt(prompt)}>
                <Send className="mr-2 h-4 w-4" />
                Ask assistant
              </Button>
            </div>

            {!askAssistant.isPending && recentMessages.length ? (
              <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Technical problems, broken screens, account access issues, and other system issues should be sent to Smart Queue support or technical support.
              </div>
            ) : null}

            {!askAssistant.isPending && latestRateableMessage ? (
              <div className="mt-4">
                <ConversationRatingCard
                  description="Rate this solved assistant answer so Smart Queue can keep improving the help guests and owners receive."
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
              </div>
            ) : null}

            {latestThreadMessage?.kind === "support_referral" ? (
              <Button asChild className="site-primary-button mt-4">
                <Link to={getSupportRouteForRole(user?.role ?? "user")}>Open support chat</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="info-card">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Quick route shortcuts</div>
            <div className="mt-4 grid gap-3">
              <Link className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-blue-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800" to="/account/queues">
                Open live queues
              </Link>
              <Link className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-blue-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800" to="/account/search">
                Search businesses
              </Link>
              <Link className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-blue-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800" to="/account/map">
                Open map view
              </Link>
              <Link className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-blue-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800" to="/account/messages">
                Open messages
              </Link>
            </div>
          </div>

          <div className="info-card">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">How this differs</div>
            <div className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              The floating assistant is still your general helper across the app. This home assistant is only for dashboard-level guidance and next-step planning.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
