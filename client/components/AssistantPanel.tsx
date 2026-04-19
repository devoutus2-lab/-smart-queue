import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import { useAssistantThread } from "@/hooks/useAssistantThread";
import { getSupportRouteForRole } from "@/lib/navigation";

type AssistantPanelProps = {
  mode: "user" | "owner";
  title: string;
  description: string;
  placeholder: string;
  businessId?: number | null;
  conversationId?: number | null;
  queueEntryId?: number | null;
  appointmentId?: number | null;
  suggestedPrompts?: string[];
};

export function AssistantPanel({
  mode,
  title,
  description,
  placeholder,
  businessId,
  conversationId,
  queueEntryId,
  appointmentId,
  suggestedPrompts = [],
}: AssistantPanelProps) {
  const { user } = useSession();
  const [prompt, setPrompt] = useState("");
  const { thread, askAssistant } = useAssistantThread(user);
  const latestThreadMessage = askAssistant.data?.thread?.messages?.[askAssistant.data.thread.messages.length - 1] ?? null;

  useEffect(() => {
    setPrompt("");
  }, [user?.id, user?.role]);

  return (
    <div className="section-shell p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-500">
            <Sparkles className="h-4 w-4" />
            Guided help
          </div>
          <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
      </div>

      {suggestedPrompts.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {suggestedPrompts.map((item) => (
            <button
              key={item}
              className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              onClick={() => setPrompt(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <Input
          className="min-h-[52px] flex-1"
          placeholder={placeholder}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && prompt.trim()) {
              event.preventDefault();
              askAssistant.mutate({
                prompt,
                businessId: businessId ?? null,
                conversationId: conversationId ?? null,
                queueEntryId: queueEntryId ?? null,
                appointmentId: appointmentId ?? null,
              });
              setPrompt("");
            }
          }}
        />
        <Button
          className="site-primary-button min-w-[160px]"
          disabled={!prompt.trim() || askAssistant.isPending}
          onClick={() => {
            askAssistant.mutate({
              prompt,
              businessId: businessId ?? null,
              conversationId: conversationId ?? null,
              queueEntryId: queueEntryId ?? null,
              appointmentId: appointmentId ?? null,
            });
            setPrompt("");
          }}
        >
          {askAssistant.isPending ? "Thinking..." : "Get help"}
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        {(thread?.messages.slice(-6) ?? []).map((message) => (
          <div
            key={message.id}
            className={`rounded-[1.5rem] border p-5 ${
              message.role === "user"
                ? "border-blue-200 bg-blue-600 text-white"
                : message.kind === "support_referral"
                  ? "border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20"
                  : "border-blue-100 bg-blue-50/80 dark:border-slate-800 dark:bg-slate-900/80"
            }`}
          >
            <div className={`text-xs font-semibold uppercase tracking-[0.24em] ${message.role === "user" ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
              {message.role === "user" ? "You" : "Assistant"}
            </div>
            <div className={`mt-2 text-sm leading-7 ${message.role === "user" ? "text-white" : "text-slate-700 dark:text-slate-200"}`}>{message.body}</div>
          </div>
        ))}

        {askAssistant.data?.suggestedReply ? (
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <Lightbulb className="h-4 w-4" />
              Suggested reply
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{askAssistant.data.suggestedReply}</div>
          </div>
        ) : null}

        {askAssistant.data?.nextSteps?.length ? (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Helpful next steps</div>
            <div className="mt-3 grid gap-2">
              {askAssistant.data.nextSteps.map((step) => (
                <div key={step} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  {step}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {mode === "user" ? (
        <div className="mt-5 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Technical problems and account issues should be sent directly to Smart Queue support or technical support.
        </div>
      ) : null}

      {latestThreadMessage?.kind === "support_referral" ? (
        <Button asChild className="site-primary-button mt-5">
          <Link to={getSupportRouteForRole(user?.role ?? "user")}>Open support chat</Link>
        </Button>
      ) : null}
    </div>
  );
}
