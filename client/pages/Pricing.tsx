import { Check, Sparkles } from "lucide-react";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    interval: "Monthly or yearly",
    description: "A simple way for smaller businesses to stop letting long physical lines shape the guest experience.",
    highlights: ["Remote queueing", "Appointments", "Business profile listing"],
  },
  {
    name: "Growth",
    interval: "Monthly or yearly",
    description: "For businesses that want to reduce crowding, answer guest questions earlier, and manage daily flow more clearly.",
    highlights: ["Everything in Starter", "Guest messaging", "Service and counter management"],
  },
  {
    name: "Premium",
    interval: "Monthly or yearly",
    description: "For businesses that want the fullest Smart Queue presence, stronger visibility, and a more polished guest journey.",
    highlights: ["Everything in Growth", "Priority directory presence", "Advanced operations support"],
  },
];

export default function Pricing() {
  return (
    <PublicSiteChrome compactHeader>
      <main className="page-frame">
        <section className="hero-panel p-8 text-white sm:p-10 lg:p-12">
          <div className="workspace-chip border-white/10 bg-white/10 text-amber-200 dark:border-white/10 dark:bg-white/10 dark:text-amber-200">
            <Sparkles className="h-4 w-4" />
            For businesses
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
            Reduce long lines, stay visible, and let Smart Queue get guests moving before they arrive.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-blue-100 sm:text-lg">
            Monthly and yearly plans help businesses present complete information, manage appointments, and make remote queueing part of the guest experience.
          </p>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className="section-shell panel-roomy">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-500">{plan.interval}</div>
              <h2 className="mt-4 text-3xl text-slate-900 dark:text-slate-100">{plan.name}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{plan.description}</p>
              <div className="mt-6 space-y-3">
                {plan.highlights.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <Check className="mt-0.5 h-4 w-4 text-blue-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Button asChild className="site-primary-button mt-7 w-full">
                <a href="/register/business">Create business account</a>
              </Button>
            </article>
          ))}
        </section>
      </main>
    </PublicSiteChrome>
  );
}
