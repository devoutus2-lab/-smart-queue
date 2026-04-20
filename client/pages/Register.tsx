import { useState } from "react";
import { ArrowRight, BriefcaseBusiness, Check, ShieldCheck, UserRoundPlus } from "lucide-react";
import { Link } from "react-router-dom";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import HostedStorageNotice from "@/components/HostedStorageNotice";
import { cn } from "@/lib/utils";

const accountChoices = [
  {
    title: "Create user account",
    body: "For regular users who want to join queues, book ahead, save businesses, and manage their visits.",
    to: "/register/user",
    Icon: UserRoundPlus,
    accent: "For everyday guests",
    detail: "Create a personal account for queue tracking, bookings, messages, and saved places.",
  },
  {
    title: "Create business/company account",
    body: "For business owners or company teams who want to manage services, queues, appointments, messages, and operations.",
    to: "/register/business",
    Icon: BriefcaseBusiness,
    accent: "For owners and operators",
    detail: "Create or connect a business profile, choose a plan when needed, and open the owner dashboard.",
  },
];

export default function Register() {
  const [activeChoice, setActiveChoice] = useState(0);

  return (
    <PublicSiteChrome compactHeader>
      <main className="login-page-stage">
        <div className="login-rain-shell relative overflow-visible px-4 py-8 sm:px-5 sm:py-10 lg:px-8 lg:py-14">
          <div aria-hidden className="login-rain-bg pointer-events-none absolute inset-0" />
          <div className="relative z-10 mx-auto flex w-full max-w-[92rem] flex-col gap-8">
            <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
              <section className="auth-shell p-6 text-white sm:p-8 lg:p-12">
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-200">Choose account type</p>
                <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                  Start in the workspace that fits how you use Smart Queue.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
                  Personal accounts are for joining queues and planning visits. Business/company accounts are for managing operations and services.
                </p>

                <div className="login-feature-stack mt-10" aria-label="Account options">
                  {accountChoices.map(({ title, body, Icon, accent, detail }, index) => (
                    <button
                      key={title}
                      type="button"
                      className={cn("login-feature-card", activeChoice === index && "is-active", activeChoice < index && "is-shifted")}
                      onMouseEnter={() => setActiveChoice(index)}
                      onFocus={() => setActiveChoice(index)}
                      onClick={() => setActiveChoice(index)}
                      aria-pressed={activeChoice === index}
                    >
                      <div className="login-feature-title">
                        <Icon className="h-6 w-6 text-cyan-200" />
                        <span>{title}</span>
                      </div>
                      <p className="login-feature-copy">{body}</p>
                      <p className="login-feature-detail">{detail}</p>
                      <div className="login-feature-accent">{accent}</div>
                      <div className="login-feature-bar" aria-hidden="true">
                        <div className="login-feature-bar-empty" />
                        <div className="login-feature-bar-filled" />
                      </div>
                      <span className="login-feature-check" aria-hidden="true">
                        <Check className="h-4 w-4" />
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="section-shell p-6 text-slate-900 dark:text-slate-100 sm:p-8 lg:p-10">
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-4xl">Create an account</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Pick the account type you want to create, then continue through the matching setup flow.
                  </p>
                </div>

                <div className="mt-8 grid gap-5">
                  {accountChoices.map(({ title, body, to, Icon, accent }) => (
                    <Link
                      key={title}
                      to={to}
                      className="group rounded-[1.6rem] border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">{accent}</div>
                          <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</div>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-slate-900 dark:text-blue-300">
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{body}</p>
                      <div className="mt-5 inline-flex items-center font-semibold text-blue-600 group-hover:text-blue-700">
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-8 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  Already have an account?
                  <Link className="ml-2 inline-flex items-center font-semibold text-blue-600 hover:text-blue-700" to="/login">
                    Sign in
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>

                <HostedStorageNotice className="mt-5" />
              </section>
            </div>
          </div>
        </div>
      </main>
    </PublicSiteChrome>
  );
}
