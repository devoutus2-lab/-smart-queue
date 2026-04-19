import { Link } from "react-router-dom";
import { MapPin, Search, Sparkles } from "lucide-react";
import { BusinessMap } from "@/components/BusinessMap";
import UserWorkspaceFrame from "@/components/user/UserWorkspaceFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccountBusinessDirectory } from "@/hooks/useAccountBusinessDirectory";

export default function UserMap() {
  const { search, setSearch, sort, setSort, markersQuery, geo, currentSearchParams } = useAccountBusinessDirectory({ includeMarkers: true });

  return (
    <UserWorkspaceFrame
      title="Map view"
      subtitle="Search businesses, compare nearby places, and keep both the full map view and nearby snapshot in one route."
    >
      <section className="space-y-7">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]">
          <div className="hero-panel p-7 sm:p-8">
            <div className="workspace-chip border-white/10 bg-white/10 text-amber-200 dark:border-white/10 dark:bg-white/10 dark:text-amber-200">
              <MapPin className="h-4 w-4" />
              In-app map view
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl leading-tight text-white">Search, compare, and move through the map without leaving your dashboard.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100">
              Nearby places, wait signals, and direction context live together here so you can decide where to go next with less friction.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="site-primary-button">
                <Link to={`/account/search${currentSearchParams.toString() ? `?${currentSearchParams.toString()}` : ""}`}>Back to search</Link>
              </Button>
              <Button asChild className="border-white/20 bg-white/10 text-white hover:bg-white/15" variant="outline">
                <Link to="/account/messages">Open messages</Link>
              </Button>
            </div>
          </div>

          <div className="section-shell panel-roomy">
            <div className="workspace-chip">
              <Sparkles className="h-4 w-4" />
              Map snapshot
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Visible places</div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{markersQuery.data?.markers.length ?? 0}</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Places currently visible in your map results.</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Location context</div>
                <div className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {geo.error ?? "Nearby view lives here now, so the map route owns all place-and-direction context."}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-shell panel-roomy">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
            <div className="relative">
              <Search className="absolute left-4 top-4 h-4 w-4 text-slate-400" />
              <Input
                className="min-h-[56px] rounded-[1.3rem] border-slate-200 bg-white pl-11 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Search a place to show on the map..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select className="field-select" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              <option value="recommended">Recommended first</option>
              <option value="distance">Closest first</option>
              <option value="rating">Highest rated</option>
              <option value="wait">Shortest wait</option>
            </select>
          </div>
        </div>

        <BusinessMap markers={markersQuery.data?.markers ?? []} userLocation={geo} />

        <BusinessMap markers={markersQuery.data?.markers ?? []} userLocation={geo} variant="compact" />
      </section>
    </UserWorkspaceFrame>
  );
}
