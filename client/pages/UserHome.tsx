import { Link, useLocation } from "react-router-dom";
import { Bell, Compass, MessageSquareMore, Sparkles } from "lucide-react";
import UserHomeAssistant from "@/components/user/UserHomeAssistant";
import UserWorkspaceFrame from "@/components/user/UserWorkspaceFrame";
import { Button } from "@/components/ui/button";
import { demoGuestProfile, demoGuestUser, demoUserDashboard } from "@/demo/demoData";
import { useDemoMode } from "@/context/DemoModeContext";

export default function UserHome() {
  const location = useLocation();
  const { enabled: demoEnabled, currentPreset } = useDemoMode();
  const isDemoFigure = location.pathname === "/demo/figure-3" || (demoEnabled && currentPreset === "figure3_main_user");

  return (
      <UserWorkspaceFrame
        activePathOverride={isDemoFigure ? "/account" : undefined}
        badge={isDemoFigure ? `${demoGuestUser.name} demo` : undefined}
        title="Your Smart Queue home"
        subtitle="See what needs attention, choose the next route to open, and get home-level help before you head out."
        dashboardOverride={isDemoFigure ? demoUserDashboard : undefined}
        profileOverride={isDemoFigure ? demoGuestProfile : undefined}
        userOverride={isDemoFigure ? demoGuestUser : undefined}
    >
      {({ dashboard }) => (
        <>
          <section className="kpi-grid">
            {[
              ["Live queues", dashboard?.activeEntries.length ?? 0],
              ["Appointments", dashboard?.upcomingAppointments.length ?? 0],
              ["Saved places", dashboard?.savedPlaces.length ?? 0],
              ["Messages", dashboard?.conversations.length ?? 0],
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
                <h2 className="section-heading text-slate-900 dark:text-slate-100">What needs your attention today</h2>
                <p className="subtle-lead mt-2">This home page stays summary-first so the rest of the sidebar can focus on dedicated interfaces.</p>
              </div>
              <Button asChild className="site-primary-button">
                <Link to="/account/search">Open search</Link>
              </Button>
            </div>

            <div className="mt-6 content-with-rail xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.88fr)]">
              <div className="rounded-[1.5rem] bg-slate-50 p-5 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                  <Bell className="h-4 w-4" />
                  Recent updates
                </div>
                <div className="mt-4 space-y-3">
                  {(dashboard?.notifications ?? []).slice(0, 4).map((notification) => (
                    <div key={notification.id} className="rounded-[1.3rem] bg-white p-4 dark:bg-slate-950">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{notification.title}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notification.message}</div>
                    </div>
                  ))}
                  {!dashboard?.notifications?.length ? <div className="empty-panel p-5">You&apos;re all caught up for now.</div> : null}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[1.5rem] bg-slate-50 p-5 dark:bg-slate-900">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
                    <Compass className="h-4 w-4" />
                    Helpful next step
                  </div>
                  <div className="mt-4 rounded-[1.3rem] bg-white p-5 dark:bg-slate-950">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {dashboard?.recommendation?.title ?? "Browse nearby businesses"}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {dashboard?.recommendation?.message ??
                        "Use Search or Map to compare businesses, then move to Queues or Messages when you are ready."}
                    </div>
                    <div className="mt-4 grid gap-3">
                      <Button asChild className="site-primary-button">
                        <Link to={dashboard?.recommendation?.primaryActionHref ?? "/account/search"}>
                          {dashboard?.recommendation?.primaryActionLabel ?? "Browse businesses"}
                        </Link>
                      </Button>
                      {dashboard?.recommendation?.secondaryActionHref ? (
                        <Button asChild variant="outline">
                          <Link to={dashboard.recommendation?.secondaryActionHref ?? "/account/map"}>
                            {dashboard.recommendation?.secondaryActionLabel ?? "Open next step"}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <div className="info-card">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Messages</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboard?.conversations.length ?? 0}</div>
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Open the Messages route to browse businesses and continue active conversations.</div>
                  </div>
                  <div className="info-card">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      Route shortcuts
                    </div>
                    <div className="mt-3 grid gap-2">
                      <Link className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-blue-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800" to="/account/search">
                        Search businesses
                      </Link>
                      <Link className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-blue-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800" to="/account/profile">
                        Update profile
                      </Link>
                      <Link className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-blue-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800" to="/account/settings">
                        Open settings
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <UserHomeAssistant dashboard={dashboard} />

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="section-shell panel-roomy">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                <MessageSquareMore className="h-4 w-4" />
                Conversation activity
              </div>
              <div className="mt-4 space-y-3">
                {(dashboard?.conversations ?? []).slice(0, 3).map((conversation) => (
                  <div key={conversation.id} className="rounded-[1.3rem] bg-slate-50 p-4 dark:bg-slate-900">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{conversation.businessName}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{conversation.latestMessage ?? conversation.contextLabel ?? "Open the message thread for the latest update."}</div>
                  </div>
                ))}
                {!dashboard?.conversations?.length ? <div className="empty-panel">No active conversations yet. Open Messages when you need to ask a business a quick question.</div> : null}
              </div>
            </div>

            <div className="section-shell panel-roomy">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
                <Compass className="h-4 w-4" />
                Recent visits
              </div>
              <div className="mt-4 space-y-3">
                {(dashboard?.recentVisits ?? []).slice(0, 3).map((visit) => (
                  <div key={`${visit.id}-${visit.status}`} className="rounded-[1.3rem] bg-slate-50 p-4 dark:bg-slate-900">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{visit.businessName}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{visit.serviceName ?? "General service"} | {visit.status}</div>
                  </div>
                ))}
                {!dashboard?.recentVisits?.length ? <div className="empty-panel">Your recent visits will show up here once you start using queues or appointments.</div> : null}
              </div>
            </div>
          </section>
        </>
      )}
    </UserWorkspaceFrame>
  );
}
