import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Clock3,
  Compass,
  Filter,
  Heart,
  LayoutDashboard,
  MapPin,
  MessageSquareMore,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  TimerReset,
  UserCircle2,
} from "lucide-react";
import type { BusinessCategory } from "@shared/api";
import { CachedDataNote } from "@/components/CachedDataNote";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import { BusinessMap } from "@/components/BusinessMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOffline } from "@/context/OfflineContext";
import { useSession } from "@/context/SessionContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { api } from "@/lib/api";

const categories: BusinessCategory[] = ["restaurant", "bank", "hospital", "government", "salon", "retail"];

export default function Index() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOnline } = useOffline();
  const { user } = useSession();
  const geo = useGeolocation();
  useRealtimeInvalidation();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<BusinessCategory | "">("");
  const [serviceId, setServiceId] = useState<number | "">("");
  const [openNow, setOpenNow] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState<"recommended" | "distance" | "rating" | "wait">("recommended");
  const greetingLabel = useMemo(() => {
    if (user?.role !== "user") return "Welcoming visits, clearer timing";
    const hour = new Date().getHours();
    const period = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
    return `${period}, ${user.name}!`;
  }, [user]);

  const query = useMemo(
    () => ({
      q: search || undefined,
      category: category || undefined,
      serviceId: serviceId || undefined,
      openNow: openNow || undefined,
      favoritesOnly: favoritesOnly || undefined,
      savedOnly: savedOnly || undefined,
      sort,
      lat: geo.latitude,
      lng: geo.longitude,
    }),
    [category, favoritesOnly, geo.latitude, geo.longitude, openNow, savedOnly, search, serviceId, sort],
  );

  const businessesQuery = useQuery({
    queryKey: ["businesses", query],
    queryFn: () => api.getBusinesses(query),
  });
  const markersQuery = useQuery({
    queryKey: ["business-markers", query],
    queryFn: () => api.getBusinessMarkers(query),
  });
  const externalQuery = useQuery({
    queryKey: ["external-businesses", search, geo.latitude, geo.longitude],
    queryFn: () => api.searchExternalBusinesses({ q: search.trim(), lat: geo.latitude, lng: geo.longitude }),
    enabled: isOnline && search.trim().length >= 2,
  });

  const businesses = businessesQuery.data?.businesses ?? [];
  const externalBusinesses = externalQuery.data?.results ?? [];
  const highlightedBusiness = businesses[0] ?? null;
  const secondaryBusinesses = businesses.slice(1, 4);
  const serviceOptions = useMemo(() => {
    const allServices = businesses.flatMap((business) =>
      business.serviceHighlights.map((service) => ({ id: service.id, name: service.name })),
    );
    return allServices.filter((service, index, list) => list.findIndex((item) => item.id === service.id) === index);
  }, [businesses]);

  async function toggleFavorite(id: number, isFavorite: boolean) {
    if (!user) {
      navigate("/login");
      return;
    }
    if (isFavorite) {
      await api.unfavoriteBusiness(id);
    } else {
      await api.favoriteBusiness(id);
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["businesses"] }),
      queryClient.invalidateQueries({ queryKey: ["business-markers"] }),
      queryClient.invalidateQueries({ queryKey: ["user-dashboard"] }),
    ]);
  }

  const quickNavItems = [
    { label: "User Dashboard", to: "/account", icon: LayoutDashboard, detail: "Your workspace" },
    { label: "Home/Explore", to: "/", icon: Compass, detail: "Browse businesses" },
    { label: "Search", to: "/account/search", icon: Search, detail: "Find faster" },
    { label: "Live Queue", to: "/account/queues", icon: Clock3, detail: "Track active turns" },
    { label: "Map view", to: "/account/map", icon: MapPin, detail: "Nearby places" },
    { label: "Chat", to: "/account/messages", icon: MessageSquareMore, detail: "Business messages" },
    { label: "Profile", to: "/account/profile", icon: UserCircle2, detail: "Account details" },
    { label: "Settings", to: "/account/settings", icon: Settings2, detail: "Preferences" },
  ];

  return (
    <PublicSiteChrome>
      <main>
        <section className="page-frame homepage-frame">
          <div className="homepage-stage">
            <aside className="homepage-side-panel">
              <div className="homepage-side-nav-wrap">
                <nav className="homepage-side-nav" aria-label="Quick navigation">
                  {quickNavItems.map(({ label, to, icon: Icon, detail }) => (
                    <Link
                      key={label}
                      className="homepage-side-nav-item"
                      to={to}
                      aria-current={to === "/" ? "page" : undefined}
                    >
                      <span className="homepage-side-nav-icon">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="homepage-side-nav-tooltip">
                        <span className="homepage-side-nav-title">{label}</span>
                        <span className="homepage-side-nav-detail">{detail}</span>
                      </span>
                    </Link>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="homepage-main">
              <div className="hero-glass-stack hero-glass-stack-top" aria-label="How Smart Queue works">
                {[
                  {
                    title: "1. Browse with context",
                    body: "See services, timing, ratings, and availability before you commit.",
                    Icon: Search,
                    rotation: -12,
                  },
                  {
                    title: "2. Let Smart Queue hold your place",
                    body: "Join remotely, book a future visit, or let the app keep your line while you finish other errands.",
                    Icon: Sparkles,
                    rotation: 0,
                  },
                  {
                    title: "3. Arrive at the right moment",
                    body: "Use live updates, repeated reminders, and departure guidance so the visit takes less of your day.",
                    Icon: Clock3,
                    rotation: 12,
                  },
                ].map(({ title, body, Icon, rotation }) => (
                  <article
                    key={title}
                    className="hero-glass-card"
                    data-text={title}
                    style={{ ["--hero-card-rotation" as string]: rotation }}
                  >
                    <div className="hero-glass-icon-wrap">
                      <Icon className="hero-glass-icon" />
                    </div>
                    <p className="hero-glass-body">{body}</p>
                  </article>
                ))}
              </div>

              <div className="page-intro-grid">
                <div className="page-intro-copy">
                  <div className="hero-panel p-7 sm:p-10 lg:p-12 xl:p-14">
                    <div className="workspace-chip border-white/10 bg-white/10 text-amber-200 dark:border-white/10 dark:bg-white/10 dark:text-amber-200">
                      <ShieldCheck className="h-4 w-4" />
                      {greetingLabel}
                    </div>
                    <h1 className="mt-6 max-w-3xl text-4xl leading-[1.02] text-white sm:text-5xl lg:text-6xl">
                      The app gets in line for you, helps you book ahead, and helps you find the place before you leave.
                    </h1>
                    <p className="mt-6 max-w-2xl text-base leading-8 text-blue-100 sm:text-lg">
                      Smart Queue helps you use waiting time for errands instead of physical lines. Find businesses, check complete place details, join remotely, book ahead, and arrive when it makes more sense.
                    </p>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                      <Button asChild className="site-primary-button w-full sm:w-auto">
                        <a href="#explore">Explore businesses</a>
                      </Button>
                      {!user ? (
                        <Button
                          asChild
                          className="w-full border-white/20 bg-white/10 text-white hover:bg-white/15 sm:w-auto"
                          variant="outline"
                        >
                          <Link to="/register">Create an account</Link>
                        </Button>
                      ) : null}
                      <Button
                        asChild
                        className="w-full border-white/20 bg-white/10 text-white hover:bg-white/15 sm:w-auto"
                        variant="outline"
                      >
                        <Link to="/pricing">Business plans</Link>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="filter-surface sticky-rail" id="explore">
                  <div className="filter-surface-inner">
                    <div className="workspace-chip">
                      <Sparkles className="h-4 w-4" />
                      Start here
                    </div>
                    <h2 className="mt-5 section-heading text-slate-900 dark:text-slate-100">
                      Find and join queues with less guesswork.
                    </h2>
                    <p className="mt-3 subtle-lead">
                      Search by business, service, or category, then refine by what matters most today.
                    </p>

                    <div className="mt-7 space-y-5">
                      <div className="relative">
                        <Search className="absolute left-4 top-4 h-4 w-4 text-slate-400" />
                        <Input
                          className="min-h-[56px] rounded-[1.3rem] border-slate-200 bg-white pl-11 dark:border-slate-800 dark:bg-slate-950"
                          placeholder="Search businesses, places, or services..."
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                      </div>

                      <div>
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                          Filter by category
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${category === "" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
                            onClick={() => setCategory("")}
                          >
                            All
                          </button>
                          {categories.map((item) => (
                            <button
                              key={item}
                              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${category === item ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
                              onClick={() => setCategory(item)}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="dense-form-grid">
                        <select
                          className="field-select"
                          value={serviceId}
                          onChange={(event) => setServiceId(event.target.value ? Number(event.target.value) : "")}
                        >
                          <option value="">All services</option>
                          {serviceOptions.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name}
                            </option>
                          ))}
                        </select>

                        <select
                          className="field-select"
                          value={sort}
                          onChange={(event) => setSort(event.target.value as typeof sort)}
                        >
                          <option value="recommended">Recommended first</option>
                          <option value="distance">Closest first</option>
                          <option value="rating">Highest rated</option>
                          <option value="wait">Shortest wait</option>
                        </select>
                      </div>

                      <div>
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                          Quick filters
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${openNow ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
                            onClick={() => setOpenNow((value) => !value)}
                          >
                            Open now
                          </button>
                          <button
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${favoritesOnly ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
                            onClick={() => setFavoritesOnly((value) => !value)}
                          >
                            Favorites
                          </button>
                          <button
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${savedOnly ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
                            onClick={() => setSavedOnly((value) => !value)}
                          >
                            Saved places
                          </button>
                        </div>
                      </div>

                      <div className="rounded-[1.4rem] border border-blue-100 bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-800 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-200">
                        {geo.error ??
                          "Location is on. We can compare travel time, nearby options, exact business locations, and wait estimates together."}
                      </div>
                      <CachedDataNote queryKey={["businesses", query]} />
                      {!isOnline && search.trim().length >= 2 ? (
                        <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                          External discovery needs an internet connection. Your Smart Queue business data can still load from cache.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-frame pt-0">
          <div className="grid gap-8 xl:grid-cols-[1.18fr_0.82fr] xl:items-start">
            <div className="section-shell panel-roomy">
              {highlightedBusiness ? (
                <>
                  <div className="workspace-chip">
                    <Sparkles className="h-4 w-4" />
                    Recommended next stop
                  </div>
                  <div className="mt-6 grid gap-8 md:grid-cols-[1.02fr_0.98fr]">
                    <div>
                      <h2 className="section-heading text-slate-900 dark:text-slate-100">{highlightedBusiness.name}</h2>
                      <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{highlightedBusiness.description}</p>
                      <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 text-amber-500" /> {highlightedBusiness.trustSummary.averageRating.toFixed(1)}</span>
                        <span className="inline-flex items-center gap-1"><TimerReset className="h-4 w-4 text-blue-500" /> About {highlightedBusiness.estimatedWaitMinutes} min</span>
                        <span className="inline-flex items-center gap-1"><Route className="h-4 w-4 text-blue-500" /> {highlightedBusiness.distanceKm != null ? `${highlightedBusiness.distanceKm} km away` : "Turn on location for distance"}</span>
                      </div>
                      <div className="mt-5 rounded-[1.4rem] border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-800 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-200">
                        {highlightedBusiness.distanceKm != null
                          ? `If travel takes around ${Math.max(5, Math.round(highlightedBusiness.distanceKm * 4))} minutes, this is a strong leave-now choice for the current wait.`
                          : "Turn on location to match travel time with the current queue estimate."}
                      </div>
                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <Button asChild className="site-primary-button">
                          <Link to={`/business/${highlightedBusiness.id}`}>View this business</Link>
                        </Button>
                        {!user ? (
                          <Button asChild variant="outline">
                            <Link to="/register">Create an account</Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[1.7rem] bg-slate-50 p-5 dark:bg-slate-900">
                      <img alt={highlightedBusiness.name} className="h-56 w-full rounded-[1.4rem] object-cover" src={highlightedBusiness.imageUrl} />
                      <div className="mt-5 space-y-3">
                        {highlightedBusiness.serviceHighlights.slice(0, 3).map((service) => (
                          <div key={service.id} className="rounded-[1.2rem] bg-white px-4 py-3 text-sm dark:bg-slate-950">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{service.name}</div>
                            <div className="mt-1 text-slate-600 dark:text-slate-300">About {service.estimatedWaitMinutes} min right now</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-panel">
                  Results will appear here as soon as we find businesses that match your filters.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div id="map-view">
                <BusinessMap markers={markersQuery.data?.markers ?? []} userLocation={geo} variant="compact" />
              </div>
            </div>
          </div>
        </section>

        {secondaryBusinesses.length ? (
          <section className="page-frame pt-0">
            <div className="grid gap-6 lg:grid-cols-3">
              {secondaryBusinesses.map((business) => (
                <article key={business.id} className="stat-shell p-6">
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-500">{business.category}</div>
                  <div className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Available on Smart Queue</div>
                  <h3 className="mt-3 text-2xl text-slate-900 dark:text-slate-100">{business.name}</h3>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <span>{business.estimatedWaitMinutes} min wait</span>
                    <span>{business.queueSettings.isQueueOpen ? "Joining available" : "Joins paused"}</span>
                  </div>
                  <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{business.description}</p>
                  <Link className="mt-5 inline-flex items-center gap-2 font-semibold text-blue-600" to={`/business/${business.id}`}>
                    View details
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="page-frame pt-0">
          <div className="toolbar-row mb-6">
            <div className="result-count-shell">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                <Filter className="h-4 w-4" />
                Search results
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{businesses.length} businesses found</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Browse the list below, then open any business to compare queue timing, services, and visit options.
              </div>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {businesses.length ? "Results are ordered using your current filters and sort selection." : "Try a broader search or remove one filter."}
            </div>
          </div>
          <div className="grid gap-6">
            {businesses.map((business) => (
              <article key={business.id} className="section-shell panel-roomy">
                <div className="grid gap-6 sm:grid-cols-[240px_1fr] xl:grid-cols-[280px_1fr]">
                  <img alt={business.name} className="h-full min-h-[220px] w-full rounded-[1.6rem] object-cover xl:min-h-[260px]" src={business.imageUrl} />
                  <div className="flex flex-col">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">{business.category}</div>
                        <div className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Available on Smart Queue</div>
                        <h3 className="mt-2 text-2xl text-slate-900 dark:text-slate-100 sm:text-3xl">{business.name}</h3>
                      </div>
                      <button className={`self-start rounded-full p-3 ${business.isFavorite ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300"}`} onClick={() => toggleFavorite(business.id, business.isFavorite)}>
                        <Heart className={`h-4 w-4 ${business.isFavorite ? "fill-current" : ""}`} />
                      </button>
                    </div>

                    <p className="mt-4 line-clamp-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{business.description}</p>

                    <div className="compact-info-grid mt-5">
                      <div className="info-card">
                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Rating</div>
                        <div className="mt-2 inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                          <Star className="h-4 w-4 text-amber-500" />
                          {business.trustSummary.averageRating.toFixed(1)} ({business.trustSummary.totalReviews})
                        </div>
                      </div>
                      <div className="info-card">
                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Wait estimate</div>
                        <div className="mt-2 inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                          <Clock3 className="h-4 w-4 text-blue-500" />
                          About {business.estimatedWaitMinutes} min
                        </div>
                      </div>
                      <div className="info-card">
                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Location</div>
                        <div className="mt-2 inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                          <MapPin className="h-4 w-4 text-blue-500" />
                          {business.distanceKm != null ? `${business.distanceKm} km away` : business.address}
                        </div>
                        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          {business.queueSettings.isQueueOpen ? "Joining available" : "Joins paused"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {business.serviceHighlights.map((service) => (
                        <span key={service.id} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-slate-900 dark:text-blue-200">
                          {service.name}: {service.estimatedWaitMinutes} min
                        </span>
                      ))}
                    </div>

                    {business.trustSummary.recentFeedback[0] ? (
                      <div className="mt-5 rounded-[1.4rem] border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">Recent feedback</div>
                        <div className="mt-1">"{business.trustSummary.recentFeedback[0].comment}"</div>
                      </div>
                    ) : null}

                    <div className="mt-6 flex flex-col gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {business.isSaved ? "Saved to your shortlist." : "Open the business page to let Smart Queue hold your place or compare this stop later."}
                      </div>
                      <Link className="inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 sm:w-auto" to={`/business/${business.id}`}>
                        View details
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {businessesQuery.isLoading ? <div className="empty-panel">Finding the best nearby matches for you...</div> : null}
            {!businessesQuery.isLoading && businesses.length === 0 ? <div className="empty-panel">No businesses match those filters yet. Try a broader search or remove one filter.</div> : null}
          </div>
        </section>

        {isOnline && search.trim().length >= 2 ? (
          <section className="page-frame pt-0">
            <div className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              <MapPin className="h-4 w-4" />
              Found Beyond Smart Queue
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {externalBusinesses.map((business) => (
                <article key={business.externalProvider?.placeId} className="section-shell panel-roomy">
                  <div className="workspace-chip">
                    <MapPin className="h-4 w-4" />
                    {business.linkedBusinessId ? "Available on Smart Queue" : "Found on the map"}
                  </div>
                  <h3 className="mt-4 text-2xl text-slate-900 dark:text-slate-100">{business.name}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{business.address}</p>
                  <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                    {business.linkedBusinessId
                      ? "This place already supports remote queueing and appointments in Smart Queue."
                      : "This place is visible for directions and contact info now, and can be brought into Smart Queue for remote queueing later."}
                  </div>
                  <Button asChild className="site-primary-button mt-6 w-full">
                    <Link to={business.linkedBusinessId ? `/business/${business.linkedBusinessId}` : `/places/external/${business.externalProvider?.provider}/${business.externalProvider?.placeId}`}>
                      {business.linkedBusinessId ? "Open Smart Queue page" : "View place details"}
                    </Link>
                  </Button>
                </article>
              ))}
              {externalQuery.isLoading ? <div className="empty-panel lg:col-span-3">Searching outside the Smart Queue directory too...</div> : null}
              {!externalQuery.isLoading && externalBusinesses.length === 0 ? (
                <div className="empty-panel lg:col-span-3">No extra map results were found for that search yet.</div>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </PublicSiteChrome>
  );
}
