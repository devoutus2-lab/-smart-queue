import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Clock3, Heart, MapPin, MessageSquareMore, Phone, Star, TimerReset } from "lucide-react";
import { InlineLoadingState } from "@/components/AppLoadingState";
import { CachedDataNote } from "@/components/CachedDataNote";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import { BusinessFeedbackComposer } from "@/components/BusinessFeedbackComposer";
import { BusinessMap } from "@/components/BusinessMap";
import { InboxPanel } from "@/components/InboxPanel";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";

export default function BusinessProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const businessId = Number(id);
  const { user } = useSession();
  const scope = getAccountScope(user);
  const isMember = user?.role === "user";
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  useRealtimeInvalidation();

  const businessQuery = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => api.getBusiness(businessId),
    enabled: !Number.isNaN(businessId),
  });
  const queueQuery = useQuery({
    queryKey: accountQueryKeys.myQueue(scope.userId),
    queryFn: api.getMyQueue,
    enabled: isMember,
  });
  const visitHistoryQuery = useQuery({
    queryKey: accountQueryKeys.visitHistory(scope.userId),
    queryFn: api.getVisitHistory,
    enabled: isMember,
  });
  const appointmentsQuery = useQuery({
    queryKey: accountQueryKeys.myAppointments(scope.userId),
    queryFn: api.getAppointments,
    enabled: isMember,
  });

  const joinQueueMutation = useMutation({
    mutationFn: (serviceId: number) => api.joinQueue(businessId, serviceId),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.myQueue(scope.userId) }),
        queryClient.invalidateQueries({ queryKey: ["business", businessId] }),
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(scope.userId) }),
      ]);
      navigate(`/queue-preview/${response.entryId}?joined=1`);
    },
  });

  const business = businessQuery.data?.business;
  const selectedService = business?.services.find((service) => service.id === (selectedServiceId ?? business?.services[0]?.id));
  const currentServiceId = selectedServiceId ?? business?.services[0]?.id ?? null;
  const activeEntryForService = queueQuery.data?.entries?.find((entry) => entry.businessId === businessId && entry.serviceId === currentServiceId);
  const queueJoinBlockedReason =
    !business?.queueSettings.isQueueOpen
      ? "Remote joins are paused right now."
      : !currentServiceId
        ? "Choose a service first."
        : !selectedService?.isActive
          ? "This service is currently inactive."
          : selectedService.isAtCapacity
            ? "This service lane is full right now."
            : activeEntryForService
              ? "You already have a live queue card for this service."
              : null;
  const isQueueJoinAvailable = Boolean(!queueJoinBlockedReason);
  const hasBookingOption = Boolean(business?.services.some((service) => service.supportsAppointments));
  const activeAppointment = appointmentsQuery.data?.appointments?.find(
    (appointment) => appointment.businessId === businessId && ["pending", "approved"].includes(appointment.status),
  );
  const queueStatusLabel = queueJoinBlockedReason ?? "Joining available";
  const hoursStatusLabel = business?.isOpenNow ? "Open during posted hours" : "Currently outside posted hours";
  const reviewableVisit = (visitHistoryQuery.data?.visits ?? []).find((visit) => visit.businessId === businessId && visit.canReview);

  const hoursLabel = useMemo(() => {
    if (!business) return [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return business.hours.map((hour) => `${dayNames[hour.dayOfWeek]}: ${hour.isClosed ? "Closed" : `${hour.openTime} - ${hour.closeTime}`}`);
  }, [business]);

  async function toggleFavorite() {
    if (!isMember || !business) return navigate("/login");
    if (business.isFavorite) {
      await api.unfavoriteBusiness(business.id);
    } else {
      await api.favoriteBusiness(business.id);
    }
    await queryClient.invalidateQueries({ queryKey: ["business", businessId] });
    await queryClient.invalidateQueries({ queryKey: ["businesses"] });
  }

  async function toggleSavedPlace() {
    if (!isMember || !business) return navigate("/login");
    if (business.isSaved) {
      await api.removeSavedPlace(business.id);
    } else {
      await api.savePlace(business.id, "Pinned from business profile");
    }
    await queryClient.invalidateQueries({ queryKey: ["business", businessId] });
    await queryClient.invalidateQueries({ queryKey: ["user-dashboard"] });
  }

  if (businessQuery.isLoading) {
    return (
      <PublicSiteChrome compactHeader>
        <InlineLoadingState title="Loading business page" message="Gathering services, queue details, hours, and feedback for this business." />
      </PublicSiteChrome>
    );
  }

  if (!business) {
    return (
      <PublicSiteChrome compactHeader>
        <main className="page-frame">
          <div className="empty-panel mx-auto max-w-3xl text-center">We couldn&apos;t find that business. Try returning to the directory and choosing another place.</div>
        </main>
      </PublicSiteChrome>
    );
  }

  return (
    <PublicSiteChrome compactHeader>
      <main className="page-frame">
        <div className="mb-6 flex flex-col gap-3">
          <Button className="w-full sm:w-auto sm:self-start" variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to directory
          </Button>
          <div className="toolbar-row">
            <div>
              <div className="workspace-chip">
                <MapPin className="h-4 w-4" />
                Business profile
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.35em] text-amber-500">{business.category}</p>
              <h1 className="mt-2 text-3xl text-slate-900 dark:text-slate-100 sm:text-4xl">{business.name}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-300">{business.description}</p>
              <div className="mt-4">
                <CachedDataNote queryKey={["business", businessId]} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 self-start">
              <button className={`flex h-12 w-12 items-center justify-center rounded-full break-normal ${business.isFavorite ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300"}`} onClick={toggleFavorite}>
                <Heart className={`h-5 w-5 ${business.isFavorite ? "fill-current" : ""}`} />
              </button>
              <button className={`min-w-[88px] rounded-full px-4 py-3 text-sm font-semibold whitespace-nowrap break-normal ${business.isSaved ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300"}`} onClick={toggleSavedPlace}>
                {business.isSaved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>

        <section className="section-shell panel-roomy">
          <div className="detail-hero-grid">
            <img alt={business.name} className="h-[260px] w-full rounded-[2rem] object-cover shadow-luxury-lg sm:h-[360px]" src={business.imageUrl} />
            <div className="space-y-5">
              <div className="compact-info-grid">
                <div className="info-card">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Rating</div>
                  <div className="mt-2 inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    <Star className="h-4 w-4 text-amber-500" />
                    {business.trustSummary.averageRating.toFixed(1)} ({business.trustSummary.totalReviews} reviews)
                  </div>
                </div>
                <div className="info-card">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Queue timing</div>
                  <div className="mt-2 inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    <Clock3 className="h-4 w-4 text-blue-500" />
                    About {selectedService?.estimatedWaitMinutes ?? business.estimatedWaitMinutes} min
                  </div>
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{queueStatusLabel}</div>
                </div>
                <div className="info-card">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Location</div>
                  <div className="mt-2 inline-flex items-start gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    {business.address}
                  </div>
                </div>
              </div>

              <div className="action-panel">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Join or schedule</div>
                    <div className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">Choose your next step</div>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{hoursStatusLabel}</div>
                  </div>
                  <span className={`rounded-full px-4 py-2 text-sm font-semibold ${business.queueSettings.isQueueOpen ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500 dark:bg-slate-950 dark:text-slate-300"}`}>
                    {queueStatusLabel}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Button className="site-primary-button w-full" disabled={joinQueueMutation.isPending || !!activeEntryForService || !isQueueJoinAvailable || !isMember} onClick={() => (isMember ? joinQueueMutation.mutate(currentServiceId!) : navigate("/login"))}>
                    {activeEntryForService ? "Smart Queue is already holding your place for this service" : joinQueueMutation.isPending ? "Joining now..." : "Let Smart Queue get in line for you"}
                  </Button>
                  <Button className="w-full" variant="outline" disabled={!hasBookingOption} onClick={() => (isMember ? navigate(`/schedule-queue?business=${business.id}`) : navigate("/login"))}>
                    {hasBookingOption ? "Book a future visit" : "Appointments unavailable"}
                  </Button>
                </div>
                {!hasBookingOption ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">This business currently offers walk-in queueing only for the listed services.</div>
                ) : null}
                {activeAppointment ? (
                  <Link className="block rounded-[1.3rem] border border-purple-100 bg-purple-50 p-4 text-sm font-semibold text-purple-700 dark:border-slate-800 dark:bg-slate-900 dark:text-purple-300" to="/account/appointments">
                    You already have an upcoming booking here. Review it in Appointments.
                  </Link>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {business.tags.map((tag) => <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-slate-900 dark:text-blue-200">{tag}</span>)}
              </div>
            </div>
          </div>
        </section>

        <div className="content-with-rail mt-8">
          <div className="space-y-7">
            <section className="section-shell panel-roomy">
              <div className="toolbar-row">
                <div>
                  <h2 className="section-heading text-slate-900 dark:text-slate-100">Services and queue details</h2>
                  <p className="mt-2 subtle-lead">Choose a service first so the queue estimate and available visit options stay aligned.</p>
                </div>
                <div className="rounded-[1.3rem] border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  {hoursStatusLabel}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {business.services.map((service) => (
                  <button key={service.id} className={`w-full rounded-[1.4rem] border p-4 text-left transition ${currentServiceId === service.id ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-slate-900" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60"}`} onClick={() => setSelectedServiceId(service.id)}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{service.name}</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{service.description}</div>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300 sm:text-right">
                        <div>{service.estimatedWaitMinutes} min estimate</div>
                        <div>{service.supportsAppointments ? "Appointments available" : "Walk-in only"}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {activeEntryForService ? (
                <Link className="mt-5 block rounded-[1.3rem] border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-300" to={`/queue-preview/${activeEntryForService.id}`}>
                  You already have a live queue card here. Open it now.
                </Link>
              ) : null}
              {queueJoinBlockedReason ? (
                <div className="mt-5 rounded-[1.3rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  {queueJoinBlockedReason} You can still book ahead or send a message for clarification.
                </div>
              ) : null}
            </section>

            {business.notices.length ? (
              <section className="section-shell panel-roomy">
                <h2 className="text-2xl text-slate-900 dark:text-slate-100">Before you arrive</h2>
                <div className="mt-4 space-y-3">
                  {business.notices.map((notice) => (
                    <div key={notice.id} className="rounded-[1.3rem] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                      <div className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">{notice.severity}</div>
                      <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{notice.title}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notice.message}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="section-shell panel-roomy">
              <div className="flex items-center gap-2">
                <TimerReset className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl text-slate-900 dark:text-slate-100">Best time to go</h2>
              </div>
              <div className="mt-4 space-y-3">
                {business.bestTimeWindows.map((window) => (
                  <div key={window.label} className="flex flex-col gap-1 rounded-[1.2rem] bg-slate-50 px-4 py-3 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{window.label}</span>
                    <span className="text-sm text-slate-600 dark:text-slate-300">{window.averageWaitMinutes} min average wait</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[1.3rem] border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-200">
                {business.recommendedDepartureMinutes != null
                  ? `A good time to leave is in about ${business.recommendedDepartureMinutes} minutes to line up with the current estimate.`
                  : "Enable location to get a live departure suggestion based on travel time and the current queue."}
              </div>
            </section>

            <section className="section-shell panel-roomy">
              <h2 className="text-xl text-slate-900 dark:text-slate-100">Location, hours, and contact</h2>
              <div className="mt-5 space-y-6">
                <BusinessMap
                  markers={[
                    {
                      id: business.id,
                      slug: business.slug,
                      name: business.name,
                      category: business.category,
                      latitude: business.latitude,
                      longitude: business.longitude,
                      isOpenNow: business.isOpenNow,
                      estimatedWaitMinutes: business.estimatedWaitMinutes,
                    },
                  ]}
                />

                <div className="compact-info-grid">
                  <div className="info-card xl:col-span-2">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">Operating hours</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      {hoursLabel.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  </div>
                  <div className="info-card">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">Contact information</div>
                    {business.phone ? (
                      <div className="pt-4">
                        <a className="inline-flex items-center gap-2 font-semibold text-blue-600" href={`tel:${business.phone}`}>
                          <Phone className="h-4 w-4" />
                          {business.phone}
                        </a>
                      </div>
                    ) : null}
                    {business.email ? <div className="pt-3 text-sm text-slate-600 dark:text-slate-300">{business.email}</div> : null}
                    {business.websiteUrl ? (
                      <a className="mt-3 inline-block font-semibold text-blue-600" href={business.websiteUrl} rel="noreferrer" target="_blank">
                        Visit website
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="section-shell panel-roomy">
              <div className="toolbar-row">
                <div>
                  <h2 className="text-2xl text-slate-900 dark:text-slate-100">Guest feedback</h2>
                  <p className="subtle-lead mt-2">Short, clear reviews help guests compare timing, courtesy, and how smooth the visit felt.</p>
                </div>
                <div className="rounded-[1.4rem] border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-800 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-200">
                  Rated {business.trustSummary.averageRating.toFixed(1)} out of 5 from {business.trustSummary.totalReviews} reviews
                </div>
              </div>

              <div className="mt-5 rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,255,0.94))] p-5 shadow-sm dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92))]">
                {reviewableVisit ? (
                  <BusinessFeedbackComposer businessId={business.id} visitId={reviewableVisit.id} />
                ) : (
                  <div className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Complete a visit with this business to leave a rating and written feedback here.
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-4">
                {business.trustSummary.recentFeedback.map((feedback) => (
                  <div key={feedback.id} className="rounded-[1.5rem] border border-slate-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,255,0.94))] p-5 shadow-sm dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92))]">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{feedback.userName}</div>
                        <div className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{feedback.visitLabel}</div>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }, (_, index) => (
                          <Star key={`${feedback.id}-${index}`} className={`h-4 w-4 ${index < feedback.rating ? "fill-current" : "text-slate-300 dark:text-slate-700"}`} />
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{feedback.comment}</div>
                    {feedback.ownerReply ? (
                      <div className="mt-4 rounded-[1.2rem] border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-700 dark:border-slate-800 dark:bg-slate-950 dark:text-blue-300">
                        <div className="font-semibold">Business reply</div>
                        <div className="mt-1">{feedback.ownerReply}</div>
                      </div>
                    ) : null}
                  </div>
                ))}
                {!business.trustSummary.recentFeedback.length ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                    No guest reviews yet. The first completed visit review will appear here.
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="space-y-7 sticky-rail">
            <div className="flex flex-wrap gap-3">
              <button
                aria-label={isMember ? "Open chat" : "Sign in to chat"}
                className={`inline-flex h-12 w-12 items-center justify-center rounded-full border shadow-sm transition ${
                  isChatOpen
                    ? "border-blue-500 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600 dark:text-white"
                    : "border-slate-200 bg-white text-blue-600 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:bg-slate-900"
                }`}
                onClick={() => {
                  if (!isMember) {
                    navigate("/login");
                    return;
                  }
                  const nextOpen = !isChatOpen;
                  setIsChatOpen(nextOpen);
                  if (nextOpen) {
                    window.setTimeout(() => {
                      document.getElementById("business-message-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 0);
                  }
                }}
                title={isMember ? (isChatOpen ? "Hide chat" : "Open chat") : "Sign in to chat"}
                type="button"
              >
                <MessageSquareMore className="h-5 w-5" />
              </button>
              {business.phone ? (
                <a
                  aria-label={`Call ${business.name}`}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:bg-slate-900"
                  href={`tel:${business.phone}`}
                  title={`Call ${business.name}`}
                >
                  <Phone className="h-5 w-5" />
                </a>
              ) : null}
              {hasBookingOption ? (
                <button
                  aria-label={isMember ? "Book a future visit" : "Sign in to book"}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:bg-slate-900"
                  onClick={() => navigate(isMember ? `/schedule-queue?business=${business.id}` : "/login")}
                  title={isMember ? "Book a future visit" : "Sign in to book"}
                  type="button"
                >
                  <CalendarClock className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            {isMember && isChatOpen ? (
              <section id="business-message-panel">
                <InboxPanel
                  mode="user"
                  title="Message this business"
                  emptyLabel="Start a message here and check back later for replies or archived visit notes."
                  businessId={business.id}
                  businessName={business.name}
                  autoCreate
                />
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </PublicSiteChrome>
  );
}
