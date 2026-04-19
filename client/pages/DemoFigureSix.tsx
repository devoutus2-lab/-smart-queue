import { Link } from "react-router-dom";
import { ArrowRight, Building2, CalendarClock, Clock3, Layers3, MessageSquareMore, Sparkles } from "lucide-react";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import { demoBusinessDetail, demoGuestNotifications, demoOwnerDashboard, demoQueueEntry, demoUserDashboard } from "@/demo/demoData";

export default function DemoFigureSix() {
  return (
    <PublicSiteChrome compactHeader>
      <main className="page-frame">
        <section className="section-shell panel-roomy">
          <div className="workspace-chip">
            <Layers3 className="h-4 w-4" />
            Figure 6
          </div>
          <h1 className="mt-5 section-heading text-slate-900 dark:text-slate-100">Full App Flow</h1>
          <p className="subtle-lead mt-3">
            A single presentation layout showing the guest journey from discovery to queue tracking and business-side management.
          </p>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="section-shell panel-roomy">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
              <Sparkles className="h-4 w-4" />
              1. Browse and choose
            </div>
            <div className="mt-4 rounded-[1.5rem] bg-slate-50 p-5 dark:bg-slate-900">
              <img alt={demoBusinessDetail.name} className="h-52 w-full rounded-[1.3rem] object-cover" src={demoBusinessDetail.imageUrl} />
              <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">{demoBusinessDetail.name}</div>
              <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {demoBusinessDetail.description}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {demoBusinessDetail.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-slate-950 dark:text-blue-200">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </article>

          <article className="section-shell panel-roomy">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
              <Clock3 className="h-4 w-4" />
              2. Join remotely and track
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.3rem] bg-blue-50 p-4 text-center dark:bg-slate-900">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Queue no.</div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{demoQueueEntry.queueNumber}</div>
              </div>
              <div className="rounded-[1.3rem] bg-amber-50 p-4 text-center dark:bg-slate-900">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">Position</div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{demoQueueEntry.position}</div>
              </div>
              <div className="rounded-[1.3rem] bg-slate-50 p-4 text-center dark:bg-slate-900">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">ETA</div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{demoQueueEntry.estimatedWaitMinutes}m</div>
              </div>
            </div>
            <div className="mt-4 rounded-[1.4rem] border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-200">
              Smart Queue keeps the guest updated while they continue errands, then helps them return at the right time.
            </div>
          </article>

          <article className="section-shell panel-roomy">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
              <CalendarClock className="h-4 w-4" />
              3. Guest account overview
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="stat-shell p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Live queues</div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{demoUserDashboard.activeEntries.length}</div>
              </div>
              <div className="stat-shell p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Appointments</div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{demoUserDashboard.upcomingAppointments.length}</div>
              </div>
              <div className="stat-shell p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Saved places</div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{demoUserDashboard.savedPlaces.length}</div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {demoGuestNotifications.map((notification) => (
                <div key={notification.id} className="rounded-[1.2rem] bg-slate-50 p-4 text-sm dark:bg-slate-900">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{notification.title}</div>
                  <div className="mt-1 text-slate-600 dark:text-slate-300">{notification.message}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="section-shell panel-roomy">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
              <Building2 className="h-4 w-4" />
              4. Business owner dashboard
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              {[
                ["Active guests", demoOwnerDashboard.activeCount],
                ["Waiting", demoOwnerDashboard.waitingCount],
                ["Called", demoOwnerDashboard.calledCount],
                ["Appointments", demoOwnerDashboard.todayAppointments],
              ].map(([label, value]) => (
                <div key={String(label)} className="stat-shell p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{label}</div>
                  <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[1.4rem] bg-slate-50 p-5 dark:bg-slate-900">
              {demoOwnerDashboard.queueEntries.slice(0, 2).map((entry) => (
                <div key={entry.id} className="mb-3 rounded-[1.2rem] bg-white p-4 last:mb-0 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{entry.userName}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{entry.serviceName} | {entry.queueNumber}</div>
                    </div>
                    <div className="workspace-chip">{entry.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="section-shell panel-roomy">
          <div className="flex flex-wrap gap-3">
            <Link className="site-primary-button inline-flex items-center rounded-xl px-5 py-3 text-sm font-semibold text-white" to="/demo/figure-3">
              Open Figure 3
            </Link>
            <Link className="inline-flex items-center rounded-xl border px-5 py-3 text-sm font-semibold" to="/demo/figure-4/401">
              Open Figure 4
            </Link>
            <Link className="inline-flex items-center rounded-xl border px-5 py-3 text-sm font-semibold" to="/demo/figure-5">
              Open Figure 5
            </Link>
            <Link className="inline-flex items-center rounded-xl border px-5 py-3 text-sm font-semibold" to="/demo/figure-6">
              Stay on Figure 6
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="mt-5 rounded-[1.4rem] border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-blue-900 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-200">
            <MessageSquareMore className="mr-2 inline h-4 w-4" />
            This layout is designed for screenshot capture in reports and presentations, with stable sample data and no dependency on live queue activity.
          </div>
        </section>
      </main>
    </PublicSiteChrome>
  );
}
