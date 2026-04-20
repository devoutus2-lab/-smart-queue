import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Route, Search, Sparkles, Star, TimerReset } from "lucide-react";
import UserWorkspaceFrame from "@/components/user/UserWorkspaceFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import { useAccountBusinessDirectory } from "@/hooks/useAccountBusinessDirectory";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

export default function UserSearch() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const scope = getAccountScope(user);
  const {
    geo,
    search,
    setSearch,
    category,
    setCategory,
    serviceId,
    setServiceId,
    openNow,
    setOpenNow,
    favoritesOnly,
    setFavoritesOnly,
    savedOnly,
    setSavedOnly,
    sort,
    setSort,
    businessesQuery,
    serviceOptions,
    categories,
    currentSearchParams,
  } = useAccountBusinessDirectory();
  const dashboardQuery = useQuery({ queryKey: accountQueryKeys.userDashboard(scope.userId), queryFn: api.getUserDashboard });
  const activeEntries = dashboardQuery.data?.activeEntries ?? [];
  const upcomingAppointments = dashboardQuery.data?.upcomingAppointments ?? [];

  async function toggleFavorite(id: number, isFavorite: boolean) {
    if (isFavorite) {
      await api.unfavoriteBusiness(id);
    } else {
      await api.favoriteBusiness(id);
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["account-businesses"] }),
      queryClient.invalidateQueries({ queryKey: ["businesses"] }),
      queryClient.invalidateQueries({ queryKey: ["account-business-markers"] }),
      queryClient.invalidateQueries({ queryKey: ["business-markers"] }),
      queryClient.invalidateQueries({ queryKey: ["user-dashboard"] }),
    ]);
  }

  return (
    <UserWorkspaceFrame
      title="Search businesses"
      subtitle="Use the signed-in directory to compare businesses, services, wait timing, and next steps."
    >
      <section className="space-y-7">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]">
          <div className="hero-panel p-5 sm:p-8">
            <div className="workspace-chip border-white/10 bg-white/10 text-amber-200 dark:border-white/10 dark:bg-white/10 dark:text-amber-200">
              <Search className="h-4 w-4" />
              Search inside your account
            </div>
            <h2 className="mt-4 max-w-2xl text-[1.65rem] leading-tight text-white sm:mt-5 sm:text-3xl">Compare businesses, timing, and services without losing your current visit flow.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:mt-4 sm:leading-7">
              Keep your discovery flow separate from Home. Search is where filtering, comparison, and favorite actions belong.
            </p>
            <div className="mobile-button-row mt-5 sm:mt-6">
              <Button asChild className="site-primary-button w-full sm:w-auto">
                <Link to={`/account/map${currentSearchParams.toString() ? `?${currentSearchParams.toString()}` : ""}`}>Open map view</Link>
              </Button>
              <Button asChild className="w-full border-white/20 bg-white/10 text-white hover:bg-white/15 sm:w-auto" variant="outline">
                <Link to="/account/messages">Open messages</Link>
              </Button>
            </div>
          </div>

          <div className="section-shell panel-roomy">
            <div className="workspace-chip">
              <Sparkles className="h-4 w-4" />
              Search snapshot
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 sm:gap-4">
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Matched businesses</div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{businessesQuery.data?.businesses.length ?? 0}</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Current results responding to your signed-in filters.</div>
              </div>
              <div className="info-card">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Location context</div>
                <div className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {geo.error ?? "Distance and timing comparisons stay grounded in your current location."}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-shell panel-roomy">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(19rem,0.95fr)]">
            <div className="rounded-[1.35rem] bg-slate-50 p-4 dark:bg-slate-900 sm:rounded-[1.6rem] sm:p-5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="min-h-[56px] rounded-[1.3rem] border-slate-200 bg-white pl-11 dark:border-slate-800 dark:bg-slate-950"
                  placeholder="Search businesses, places, or services..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="mt-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Filter by category</div>
                <div className="mobile-chip-row">
                  <button className={`mobile-pill-button ${category === "" ? "bg-blue-600 text-white" : "bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200"}`} onClick={() => setCategory("")}>All</button>
                  {categories.map((item) => (
                    <button key={item} className={`mobile-pill-button capitalize ${category === item ? "bg-blue-600 text-white" : "bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200"}`} onClick={() => setCategory(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5 dense-form-grid">
                <select className="field-select" value={serviceId} onChange={(event) => setServiceId(event.target.value ? Number(event.target.value) : "")}>
                  <option value="">All services</option>
                  {serviceOptions.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
                <select className="field-select" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                  <option value="recommended">Recommended first</option>
                  <option value="distance">Closest first</option>
                  <option value="rating">Highest rated</option>
                  <option value="wait">Shortest wait</option>
                </select>
              </div>
            </div>

            <div className="rounded-[1.35rem] bg-slate-50 p-4 dark:bg-slate-900 sm:rounded-[1.6rem] sm:p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Quick filters</div>
              <div className="mobile-chip-row mt-4">
                <button className={`mobile-pill-button ${openNow ? "bg-amber-500 text-white" : "bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200"}`} onClick={() => setOpenNow((value) => !value)}>Open now</button>
                <button className={`mobile-pill-button ${favoritesOnly ? "bg-amber-500 text-white" : "bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200"}`} onClick={() => setFavoritesOnly((value) => !value)}>Favorites</button>
                <button className={`mobile-pill-button ${savedOnly ? "bg-amber-500 text-white" : "bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200"}`} onClick={() => setSavedOnly((value) => !value)}>Saved places</button>
              </div>
              <div className="mt-5 rounded-[1.4rem] border border-blue-100 bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-800 dark:border-slate-800 dark:bg-slate-950 dark:text-blue-200">
                {geo.error ?? "Search stays location-aware so you can compare nearby options and wait timing with less guesswork."}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          {(businessesQuery.data?.businesses ?? []).map((business) => (
            <article key={business.id} className="section-shell panel-roomy">
              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-5">
                <img alt={business.name} className="h-[200px] w-full rounded-[1.3rem] object-cover sm:h-[240px] lg:h-full lg:min-h-[220px] lg:rounded-[1.5rem]" src={business.imageUrl} />
                <div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">{business.category}</div>
                      <h3 className="mt-2 text-xl text-slate-900 dark:text-slate-100 sm:text-2xl">{business.name}</h3>
                    </div>
                    <button className={`self-start rounded-full p-3 ${business.isFavorite ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300"}`} onClick={() => void toggleFavorite(business.id, business.isFavorite)}>
                      <Heart className={`h-4 w-4 ${business.isFavorite ? "fill-current" : ""}`} />
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:mt-4 sm:leading-7">{business.description}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3 sm:mt-5">
                    <div className="info-card">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Rating</div>
                      <div className="mt-2 inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><Star className="h-4 w-4 text-amber-500" />{business.trustSummary.averageRating.toFixed(1)}</div>
                    </div>
                    <div className="info-card">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Wait</div>
                      <div className="mt-2 inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><TimerReset className="h-4 w-4 text-blue-500" />About {business.estimatedWaitMinutes} min</div>
                    </div>
                    <div className="info-card">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Distance</div>
                      <div className="mt-2 inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><Route className="h-4 w-4 text-blue-500" />{business.distanceKm != null ? `${business.distanceKm} km away` : "Turn on location"}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${business.queueSettings.isQueueOpen ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>
                      {business.queueSettings.isQueueOpen ? "Queue open" : "Queue paused"}
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-slate-900 dark:text-blue-200">
                      {business.serviceHighlights.some((service) => service.supportsAppointments) ? "Appointments available" : "Walk-in only"}
                    </span>
                    {activeEntries.some((entry) => entry.businessId === business.id) ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">You already have a live queue here</span>
                    ) : null}
                    {upcomingAppointments.some((appointment) => appointment.businessId === business.id) ? (
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">You already have an upcoming booking here</span>
                    ) : null}
                  </div>
                  <div className="mobile-button-row mt-5">
                    <Button asChild className="site-primary-button w-full sm:w-auto">
                      <Link to={`/business/${business.id}`}>View business</Link>
                    </Button>
                    <Button asChild className="w-full sm:w-auto" variant="outline">
                      <Link to="/account/messages">Open messages</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {businessesQuery.isLoading ? <div className="empty-panel">Finding businesses that match your current search...</div> : null}
          {!businessesQuery.isLoading && !(businessesQuery.data?.businesses ?? []).length ? <div className="empty-panel">No businesses match those filters yet. Try broadening the search or removing one filter.</div> : null}
        </div>
      </section>
    </UserWorkspaceFrame>
  );
}
