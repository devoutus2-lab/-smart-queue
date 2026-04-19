import { Link } from "react-router-dom";
import { Search, TimerReset } from "lucide-react";
import { InboxPanel } from "@/components/InboxPanel";
import UserWorkspaceFrame from "@/components/user/UserWorkspaceFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccountBusinessDirectory } from "@/hooks/useAccountBusinessDirectory";

export default function UserMessages() {
  const { search, setSearch, businessesQuery } = useAccountBusinessDirectory();

  return (
    <UserWorkspaceFrame
      title="Business messages"
      subtitle="Search for a business first, then continue visit-related conversations in a dedicated messaging route."
    >
      <section className="space-y-7">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]">
          <div className="hero-panel p-7 sm:p-8">
            <h2 className="max-w-2xl text-3xl leading-tight text-white">Start a business conversation from one calmer messaging hub.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100">
              Search for a place, open its profile, and keep visit-related messages in one route so questions do not get lost between screens.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="site-primary-button">
                <Link to="/account/search">Browse businesses</Link>
              </Button>
              <Button asChild className="border-white/20 bg-white/10 text-white hover:bg-white/15" variant="outline">
                <Link to="/account/map">Use map view</Link>
              </Button>
            </div>
          </div>

          <div className="section-shell panel-roomy">
            <div className="workspace-chip">
              <TimerReset className="h-4 w-4" />
              Messaging snapshot
            </div>
            <div className="mt-5 grid gap-4">
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Message-ready places</div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{(businessesQuery.data?.businesses ?? []).slice(0, 6).length}</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Open a business page to keep the conversation focused on one visit.</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">What belongs here</div>
                <div className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">Timing questions, visit requirements, and quick clarifications before you leave.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-shell panel-roomy">
          <div className="toolbar-row">
            <div>
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Find a business to message</h2>
              <p className="subtle-lead mt-2">This route owns message discovery and conversation history, separate from Search and Home.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-4 h-4 w-4 text-slate-400" />
              <Input
                className="min-h-[56px] rounded-[1.3rem] border-slate-200 bg-white pl-11 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Search businesses to message..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(businessesQuery.data?.businesses ?? []).slice(0, 6).map((business) => (
                <div key={business.id} className="info-card">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{business.name}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{business.description}</div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <TimerReset className="h-4 w-4 text-blue-500" />
                    About {business.estimatedWaitMinutes} min right now
                  </div>
                  <Button asChild className="site-primary-button mt-4 w-full">
                    <Link to={`/business/${business.id}`}>Open business chat</Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <InboxPanel
          mode="user"
          title="Business messages"
          emptyLabel="Start a conversation from a business page whenever you want a quick answer before leaving, then revisit older visits from the archive."
        />
      </section>
    </UserWorkspaceFrame>
  );
}
