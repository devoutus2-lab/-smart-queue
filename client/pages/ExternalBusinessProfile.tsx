import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, ExternalLink, MapPin, Phone, ShieldCheck, Sparkles, Star } from "lucide-react";
import { InlineLoadingState } from "@/components/AppLoadingState";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import { BusinessMap } from "@/components/BusinessMap";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import { api } from "@/lib/api";

export default function ExternalBusinessProfile() {
  const navigate = useNavigate();
  const { provider = "google_places", placeId = "" } = useParams();
  const { user } = useSession();

  const externalQuery = useQuery({
    queryKey: ["external-business", provider, placeId],
    queryFn: () => api.getExternalBusiness(provider, placeId),
    enabled: Boolean(provider && placeId),
  });

  const business = externalQuery.data?.business;

  const importMutation = useMutation({
    mutationFn: () =>
      api.importAdminBusiness({
        provider,
        placeId,
        name: business!.name,
        category: business!.category,
        description:
          business!.description ||
          `${business!.name} was imported from Google Places so it can start offering remote queueing and appointments in Smart Queue.`,
        address: business!.address,
        phone: business!.phone ?? "",
        email: business!.email ?? "",
        websiteUrl: business!.websiteUrl ?? "",
        latitude: business!.latitude,
        longitude: business!.longitude,
        imageUrl: business!.imageUrl,
        rating: business!.rating,
        reviewsCount: business!.reviewsCount,
        tags: business!.tags,
      }),
    onSuccess: (result) => navigate(`/business/${result.id}`),
  });

  const claimMutation = useMutation({
    mutationFn: () =>
      api.createBusinessClaim({
        provider,
        placeId,
        businessName: business!.name,
        category: business!.category,
        address: business!.address,
        phone: business!.phone ?? "",
        email: business!.email ?? "",
        websiteUrl: business!.websiteUrl ?? "",
        latitude: business!.latitude,
        longitude: business!.longitude,
        imageUrl: business!.imageUrl,
      }),
  });

  const nextStepPanel = useMemo(() => {
    if (!business) return null;
    if (business.linkedBusinessId) {
      return (
        <div className="rounded-[1.4rem] border border-green-200 bg-green-50 p-5 text-sm leading-6 text-green-800 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-200">
          This place is already available on Smart Queue with remote queueing and appointment support.
        </div>
      );
    }
    return (
      <div className="rounded-[1.4rem] border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-800 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-200">
        We found this business on the map. Guests can view the location and contact details now, and owners or admins can bring it into Smart Queue to unlock queueing and booking.
      </div>
    );
  }, [business]);

  if (externalQuery.isLoading || !business) {
    return (
      <PublicSiteChrome compactHeader>
        <InlineLoadingState title="Loading map business" message="Finding the latest location, contact details, and Smart Queue availability for this place." />
      </PublicSiteChrome>
    );
  }

  return (
    <PublicSiteChrome compactHeader>
      <main className="page-frame">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button className="w-full sm:w-auto" variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to results
          </Button>
          <div className="workspace-chip">
            <MapPin className="h-4 w-4" />
            {business.linkedBusinessId ? "Available on Smart Queue" : "Found on the map"}
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-7">
            <img alt={business.name} className="h-[260px] w-full rounded-[2rem] object-cover shadow-luxury-lg sm:h-[360px]" src={business.imageUrl} />

            <section className="section-shell panel-roomy">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-500">{business.category}</p>
              <h1 className="mt-3 text-3xl text-slate-900 dark:text-slate-100 sm:text-4xl">{business.name}</h1>
              <p className="mt-5 text-base leading-8 text-slate-600 dark:text-slate-300">{business.description}</p>

              <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> {business.rating.toFixed(1)} ({business.reviewsCount} reviews)</span>
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-500" /> {business.address}</span>
                {business.phone ? <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-blue-500" /> {business.phone}</span> : null}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {business.tags.map((tag) => <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-slate-900 dark:text-blue-200">{tag}</span>)}
              </div>
            </section>

            <section className="section-shell panel-roomy">
              <h2 className="text-2xl text-slate-900 dark:text-slate-100">Location</h2>
              <div className="mt-4">
                <BusinessMap markers={[{ id: business.linkedBusinessId ?? 0, slug: business.slug, name: business.name, category: business.category, latitude: business.latitude, longitude: business.longitude, isOpenNow: business.isOpenNow, estimatedWaitMinutes: business.estimatedWaitMinutes }]} />
              </div>
            </section>
          </div>

          <div className="space-y-7">
            <section className="section-shell panel-roomy">
              <h2 className="text-2xl text-slate-900 dark:text-slate-100">What you can do here</h2>
              <div className="mt-4 space-y-4">
                {nextStepPanel}

                {business.linkedBusinessId ? (
                  <Button asChild className="site-primary-button w-full">
                    <Link to={`/business/${business.linkedBusinessId}`}>Open the Smart Queue business page</Link>
                  </Button>
                ) : null}

                {business.websiteUrl ? (
                  <Button asChild className="w-full" variant="outline">
                    <a href={business.websiteUrl} rel="noreferrer" target="_blank">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Visit website
                    </a>
                  </Button>
                ) : null}

                {!business.linkedBusinessId && user?.role === "admin" ? (
                  <Button className="site-primary-button w-full" disabled={importMutation.isPending} onClick={() => importMutation.mutate()}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {importMutation.isPending ? "Importing..." : "Import this business into Smart Queue"}
                  </Button>
                ) : null}

                {!business.linkedBusinessId && user?.role === "owner" ? (
                  <Button className="site-primary-button w-full" disabled={claimMutation.isPending} onClick={() => claimMutation.mutate()}>
                    <Building2 className="mr-2 h-4 w-4" />
                    {claimMutation.isPending ? "Sending request..." : "Bring this business to Smart Queue"}
                  </Button>
                ) : null}

                {!business.linkedBusinessId && !user ? (
                  <Button asChild className="site-primary-button w-full">
                    <Link to="/login?role=owner">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Sign in as a business owner
                    </Link>
                  </Button>
                ) : null}

                {claimMutation.isSuccess ? (
                  <div className="rounded-[1.3rem] border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-200">
                    Your request has been sent for admin review.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="section-shell panel-roomy">
              <h2 className="text-xl text-slate-900 dark:text-slate-100">Capability status</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
                  Remote queueing: {business.capabilities.supportsRemoteQueue ? "Available on Smart Queue" : "Not active until this business joins Smart Queue"}
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
                  Appointments: {business.capabilities.supportsAppointments ? "Available on Smart Queue" : "Not active until this business joins Smart Queue"}
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
                  Verified info shown now: location, contact details, category, and public web presence.
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </PublicSiteChrome>
  );
}
