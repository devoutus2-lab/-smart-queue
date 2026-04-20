import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, CheckCircle2, Search, ShieldCheck, Store } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { BusinessCategory, OwnerSignupBusinessSearchItem, SubscriptionInterval, SubscriptionPlan } from "@shared/api";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import HostedStorageNotice from "@/components/HostedStorageNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useSession } from "@/context/SessionContext";
import { api } from "@/lib/api";
import { getHomeRouteForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const businessCategories: Array<{ value: BusinessCategory; label: string }> = [
  { value: "restaurant", label: "Restaurant" },
  { value: "bank", label: "Bank" },
  { value: "hospital", label: "Hospital" },
  { value: "government", label: "Government" },
  { value: "salon", label: "Salon" },
  { value: "retail", label: "Retail" },
];

type BusinessMode = "existing" | "new";

export default function RegisterBusiness() {
  const navigate = useNavigate();
  const { registerOwner } = useSession();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<BusinessMode>("existing");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<OwnerSignupBusinessSearchItem | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<BusinessCategory>("restaurant");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>("growth");
  const [subscriptionInterval, setSubscriptionInterval] = useState<SubscriptionInterval>("monthly");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["owner-signup-options"],
    queryFn: api.getOwnerSignupOptions,
  });

  const searchQuery = useQuery({
    queryKey: ["owner-signup-search", searchTerm],
    queryFn: () => api.searchOwnerSignupBusinesses(searchTerm),
    enabled: searchTerm.trim().length >= 2,
  });

  const needsSubscriptionStep = useMemo(() => {
    if (mode === "new") return true;
    return selectedBusiness ? !selectedBusiness.hasActiveSubscription : false;
  }, [mode, selectedBusiness]);

  function validateCurrentStep() {
    if (step === 1) {
      if (!name.trim() || !email.trim() || !password.trim()) {
        return "Complete your owner login details first.";
      }
    }

    if (step === 2) {
      if (mode === "existing" && !selectedBusiness) {
        return "Choose an existing business/company to connect.";
      }

      if (mode === "new") {
        if (!businessName.trim() || !description.trim() || !address.trim() || !phone.trim() || !businessEmail.trim()) {
          return "Complete the new business/company details before continuing.";
        }
      }
    }

    if (step === 3 && needsSubscriptionStep && !subscriptionPlan) {
      return "Select a subscription plan before creating the account.";
    }

    return "";
  }

  function handleNext() {
    const nextError = validateCurrentStep();
    if (nextError) {
      setError(nextError);
      return;
    }

    setError("");
    if (step === 2 && !needsSubscriptionStep) {
      void handleSubmit();
      return;
    }

    setStep((current) => Math.min(current + 1, needsSubscriptionStep ? 3 : 2));
  }

  function handleBack() {
    setError("");
    setStep((current) => Math.max(current - 1, 1));
  }

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    const nextError = validateCurrentStep();
    if (nextError) {
      setError(nextError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result =
        mode === "existing"
          ? await registerOwner({
              name,
              email,
              password,
              target: {
                mode: "existing",
                businessId: selectedBusiness!.id,
                subscriptionPlan: needsSubscriptionStep ? subscriptionPlan : null,
                subscriptionInterval: needsSubscriptionStep ? subscriptionInterval : null,
              },
            })
          : await registerOwner({
              name,
              email,
              password,
              target: {
                mode: "new",
                businessName,
                category,
                description,
                address,
                phone,
                businessEmail,
                websiteUrl,
                subscriptionPlan,
                subscriptionInterval,
              },
            });

      navigate(result.user ? getHomeRouteForRole(result.user.role) : "/business-dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't create the business/company account yet.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicSiteChrome compactHeader>
      <main className="login-page-stage">
        <div className="login-rain-shell relative overflow-visible px-4 py-8 sm:px-5 sm:py-10 lg:px-8 lg:py-14">
          <div aria-hidden className="login-rain-bg pointer-events-none absolute inset-0" />
          <div className="relative z-10 mx-auto flex w-full max-w-[92rem] flex-col gap-8">
            <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
              <section className="auth-shell p-6 text-white sm:p-8 lg:p-12">
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-200">Create a business/company account</p>
                <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                  Bring your operations, services, and guest flow into one dashboard.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
                  Connect to an existing subscribed business or create a new business profile with its own plan, then move straight into the owner workspace.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    { title: "Owner login", body: "Create the business/company login that will enter the operating dashboard.", Icon: ShieldCheck },
                    { title: "Business connection", body: "Search for an existing business/company in Smart Queue or set up a new one.", Icon: Search },
                    { title: "Subscription setup", body: "Pick a plan only when the selected business still needs one.", Icon: CheckCircle2 },
                  ].map(({ title, body, Icon }, index) => (
                    <div key={title} className={cn("rounded-[1.5rem] border border-white/10 bg-white/10 p-5", step === index + 1 && "border-amber-200/60 bg-white/15")}>
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-amber-200" />
                        <div className="text-lg font-bold">{title}</div>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-blue-100">{body}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="section-shell p-6 text-slate-900 dark:text-slate-100 sm:p-8 lg:p-10">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-3xl">Business/company signup</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Step {step} of {needsSubscriptionStep ? 3 : 2}
                    </p>
                  </div>
                  <Link className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700" to="/register/user">
                    Create a user account instead
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <HostedStorageNotice />
              {step === 1 ? (
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Owner name</label>
                    <Input className="min-h-[52px] rounded-[1.1rem]" value={name} onChange={(event) => setName(event.target.value)} placeholder="Jordan Reyes" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Owner email</label>
                    <Input className="min-h-[52px] rounded-[1.1rem]" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@company.com" type="email" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</label>
                    <PasswordInput className="min-h-[52px] rounded-[1.1rem]" value={password} onChange={(event) => setPassword(event.target.value)} />
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("existing");
                        setSelectedBusiness(null);
                        setError("");
                      }}
                      className={cn(
                        "rounded-[1.4rem] border p-5 text-left transition",
                        mode === "existing" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-slate-900" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
                      )}
                    >
                      <Building2 className="h-5 w-5" />
                      <div className="mt-4 font-semibold">Connect to an existing business</div>
                      <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Search Smart Queue records and attach this owner login to an existing company/business.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("new");
                        setSelectedBusiness(null);
                        setError("");
                      }}
                      className={cn(
                        "rounded-[1.4rem] border p-5 text-left transition",
                        mode === "new" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-slate-900" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
                      )}
                    >
                      <Store className="h-5 w-5" />
                      <div className="mt-4 font-semibold">Create a new business/company</div>
                      <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Set up a fresh business profile, then choose the subscription plan for it.</div>
                    </button>
                  </div>

                  {mode === "existing" ? (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Search existing businesses</label>
                        <Input
                          className="min-h-[52px] rounded-[1.1rem]"
                          value={searchTerm}
                          onChange={(event) => {
                            setSearchTerm(event.target.value);
                            setSelectedBusiness(null);
                          }}
                          placeholder="Search by business name or address"
                        />
                      </div>
                      <div className="space-y-3">
                        {(searchQuery.data?.businesses ?? []).map((business) => {
                          const active = selectedBusiness?.id === business.id;
                          return (
                            <button
                              key={business.id}
                              type="button"
                              onClick={() => setSelectedBusiness(business)}
                              className={cn(
                                "w-full rounded-2xl border px-4 py-4 text-left transition",
                                active ? "border-blue-500 bg-blue-50 dark:bg-slate-900" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
                              )}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">{business.name}</div>
                                  <div className="text-sm text-slate-500 dark:text-slate-400">{business.address}</div>
                                </div>
                                <div className="text-right text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
                                  {business.hasActiveSubscription ? `${business.subscriptionPlan ?? "active"} plan` : "Needs subscription"}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        {searchTerm.trim().length >= 2 && !searchQuery.isLoading && !searchQuery.data?.businesses.length ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            No matching business was found. Switch to the new business option if you need to create one.
                          </div>
                        ) : null}
                      </div>
                      {selectedBusiness ? (
                        <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
                          {selectedBusiness.hasActiveSubscription
                            ? `This business already has a ${selectedBusiness.subscriptionPlan ?? "current"} plan, so you can skip subscription setup.`
                            : "This business still needs a subscription plan before the owner account can be created."}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid gap-5">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Business/company name</label>
                        <Input className="min-h-[52px] rounded-[1.1rem]" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="North Point Tech School" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Category</label>
                        <select className="field-select min-h-[52px] rounded-[1.1rem]" value={category} onChange={(event) => setCategory(event.target.value as BusinessCategory)}>
                          {businessCategories.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Description</label>
                        <textarea className="min-h-[120px] w-full rounded-[1.1rem] border border-input bg-background px-3 py-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the services and visit experience this business/company offers." />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Address</label>
                        <Input className="min-h-[52px] rounded-[1.1rem]" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="123 Main Street, City" />
                      </div>
                      <div className="grid gap-5 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Business phone</label>
                          <Input className="min-h-[52px] rounded-[1.1rem]" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+63 900 000 0000" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Business email</label>
                          <Input className="min-h-[52px] rounded-[1.1rem]" value={businessEmail} onChange={(event) => setBusinessEmail(event.target.value)} placeholder="hello@business.com" type="email" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Website (optional)</label>
                        <Input className="min-h-[52px] rounded-[1.1rem]" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://company.com" />
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-5">
                  <div className="rounded-[1.4rem] border border-blue-100 bg-blue-50/70 px-4 py-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
                    {mode === "existing"
                      ? "This business/company still needs a plan. Choose one to activate owner access."
                      : "Choose the plan that should start with this new business/company account."}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {(plansQuery.data?.plans ?? []).map((plan) => (
                      <button
                        key={plan.plan}
                        type="button"
                        onClick={() => setSubscriptionPlan(plan.plan)}
                        className={cn(
                          "rounded-[1.4rem] border p-5 text-left transition",
                          subscriptionPlan === plan.plan ? "border-blue-500 bg-blue-50 dark:bg-slate-900" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
                        )}
                      >
                        <BriefcaseBusiness className="h-5 w-5 text-blue-600" />
                        <div className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">{plan.name}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{plan.description}</div>
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {(["monthly", "yearly"] as const).map((interval) => (
                      <button
                        key={interval}
                        type="button"
                        onClick={() => setSubscriptionInterval(interval)}
                        className={cn(
                          "rounded-[1.2rem] border px-4 py-4 text-left font-semibold transition",
                          subscriptionInterval === interval ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-slate-900" : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200",
                        )}
                      >
                        {interval === "monthly" ? "Monthly billing" : "Yearly billing"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

                  {error ? <div className="rounded-[1.1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button type="button" variant="outline" onClick={step === 1 ? () => navigate("/register") : handleBack}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {step === 1 ? "Back to chooser" : "Back"}
                    </Button>

                    {step < (needsSubscriptionStep ? 3 : 2) ? (
                      <Button className="site-primary-button" type="button" disabled={submitting} onClick={handleNext}>
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button className="site-primary-button" disabled={submitting} type="submit">
                        {submitting ? "Creating business account..." : "Create business/company account"}
                      </Button>
                    )}
                  </div>
                </form>
              </section>
            </div>
          </div>
        </div>
      </main>
    </PublicSiteChrome>
  );
}
