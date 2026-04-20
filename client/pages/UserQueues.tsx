import { Link } from "react-router-dom";
import UserWorkspaceFrame from "@/components/user/UserWorkspaceFrame";
import { Button } from "@/components/ui/button";

function getQueuePriority(status: string) {
  switch (status) {
    case "called":
      return 0;
    case "in_service":
      return 1;
    case "waiting":
      return 2;
    case "delayed":
      return 3;
    case "paused":
      return 4;
    default:
      return 5;
  }
}

export default function UserQueues() {
  return (
    <UserWorkspaceFrame
      title="Live queues"
      subtitle="Track your active places, check ETA and position, and jump into the live queue card when you need more detail."
    >
      {({ dashboard }) => (
        <section className="space-y-7">
          <div className="section-shell panel-roomy">
            <div className="toolbar-row">
              <div>
                <h2 className="section-heading text-slate-900 dark:text-slate-100">Your active queues</h2>
                <p className="subtle-lead mt-2">This route is only for queue tracking, so it stays focused on timing, status, and next action.</p>
              </div>
              <Button asChild className="site-primary-button w-full sm:w-auto">
                <Link to="/account/search">Find another business</Link>
              </Button>
            </div>
          </div>

          <section className="section-shell panel-roomy">
            <div className="space-y-4">
              {(dashboard?.activeEntries ?? [])
                .slice()
                .sort((left, right) => getQueuePriority(left.status) - getQueuePriority(right.status))
                .map((entry) => (
                <Link key={entry.id} className="block rounded-[1.35rem] border border-blue-100 bg-blue-50/70 p-4 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900/70 sm:rounded-[1.6rem] sm:p-6" to={`/queue-preview/${entry.id}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">{entry.queueNumber}</div>
                      <h3 className="mt-2 text-xl text-slate-900 dark:text-slate-100 sm:text-2xl">{entry.businessName}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {entry.serviceName ?? "General service"} | Position {entry.position ?? "pending"} | {entry.estimatedWaitMinutes} min ETA
                      </p>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{entry.statusDescription}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        Skips {entry.skipsUsed} | Rejoins {entry.reschedulesUsed}
                        {entry.pauseExpiresAt ? ` | Hold ends ${new Date(entry.pauseExpiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
                      </p>
                    </div>
                    <div className="self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                      {entry.statusLabel}
                    </div>
                  </div>
                </Link>
              ))}
              {!dashboard?.activeEntries?.length ? <div className="empty-panel p-10 text-center">You don&apos;t have any live queues right now.</div> : null}
            </div>
          </section>
        </section>
      )}
    </UserWorkspaceFrame>
  );
}
