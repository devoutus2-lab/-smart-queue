import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Clock3, MessageSquareMore, ShieldCheck, UserPlus } from "lucide-react";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import { getHomeRouteForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const registerHighlights = [
  {
    title: "Remote access",
    body: "Let Smart Queue get in line for you or book ahead without standing around.",
    Icon: Clock3,
  },
  {
    title: "Direct contact",
    body: "Ask a business a quick question before you go.",
    Icon: MessageSquareMore,
  },
  {
    title: "Trusted choices",
    body: "Compare timing, service, and convenience together.",
    Icon: ShieldCheck,
  },
];

export default function RegisterUser() {
  const navigate = useNavigate();
  const { register } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [activeHighlight, setActiveHighlight] = useState(0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError("Fill in your name, email, and password to continue.");
      return;
    }
    if (password.length < 6) {
      setError("Use at least 6 characters for your password.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await register({ name, email, password });
      navigate(result.user ? getHomeRouteForRole(result.user.role) : "/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't create your account yet.");
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
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-200">Create your user account</p>
                <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                  Start with a smoother way to plan visits.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
                  Save favorite places, book ahead, join remotely, and use your waiting time for errands instead of physical lines.
                </p>

                <div className="login-feature-stack mt-10" aria-label="User account benefits">
                  {registerHighlights.map(({ title, body, Icon }, index) => (
                    <button
                      key={title}
                      type="button"
                      className={cn("login-feature-card", activeHighlight === index && "is-active", activeHighlight < index && "is-shifted")}
                      onMouseEnter={() => setActiveHighlight(index)}
                      onFocus={() => setActiveHighlight(index)}
                      onClick={() => setActiveHighlight(index)}
                      aria-pressed={activeHighlight === index}
                    >
                      <div className="login-feature-title">
                        <Icon className="h-6 w-6 text-cyan-200" />
                        <span>{title}</span>
                      </div>
                      <p className="login-feature-copy">{body}</p>
                      <p className="login-feature-detail">{body}</p>
                      <div className="login-feature-accent">Personal account</div>
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
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
                    <UserPlus className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-4xl">Create your user account</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Your personal account keeps upcoming visits, saved places, and business messages together in one welcoming space.
                  </p>
                </div>

                <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Full name</label>
                    <Input className="min-h-[52px] rounded-[1.1rem]" value={name} onChange={(event) => setName(event.target.value)} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
                    <Input className="min-h-[52px] rounded-[1.1rem]" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</label>
                    <Input className="min-h-[52px] rounded-[1.1rem]" value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
                  </div>
                  {error ? <div className="rounded-[1.1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                  <Button className="site-primary-button min-h-[54px] w-full" disabled={submitting} type="submit">
                    {submitting ? "Creating your account..." : "Create user account"}
                  </Button>
                </form>

                <div className="mt-8 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  Need a business/company account instead?
                  <Link className="ml-2 inline-flex items-center font-semibold text-blue-600 hover:text-blue-700" to="/register/business">
                    Switch account type
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </PublicSiteChrome>
  );
}
