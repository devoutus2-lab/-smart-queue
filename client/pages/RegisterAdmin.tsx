import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, ShieldAlert } from "lucide-react";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useSession } from "@/context/SessionContext";
import { getHomeRouteForRole } from "@/lib/navigation";

export default function RegisterAdmin() {
  const navigate = useNavigate();
  const { registerAdmin } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await registerAdmin({ name, email, password, adminSecret });
      navigate(result.user ? getHomeRouteForRole(result.user.role) : "/admin-panel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't create the admin account yet.");
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
              <section className="auth-shell p-6 text-white sm:p-8 lg:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-200">Platform admin access</p>
                <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">
                  Create a Smart Queue platform admin account.
                </h1>
                <p className="mt-5 text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
                  This route is reserved for Smart Queue platform administration only. Business/company creation stays separate from this access level.
                </p>
                <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
                  <div className="flex items-center gap-3 font-semibold text-amber-100">
                    <ShieldAlert className="h-5 w-5" />
                    Admin-only access
                  </div>
                  <p className="mt-3 text-sm leading-6 text-blue-100">
                    Enter the platform admin secret to unlock full Smart Queue management access.
                  </p>
                </div>
              </section>

              <section className="section-shell p-6 text-slate-900 dark:text-slate-100 sm:p-8 lg:p-10">
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900">
                    <LockKeyhole className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-4xl">Hidden admin signup</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Create the Smart Queue platform account that can manage businesses, subscriptions, owners, and the full application.
                  </p>
                </div>

                <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Admin name</label>
                    <Input className="min-h-[52px] rounded-[1.1rem]" value={name} onChange={(event) => setName(event.target.value)} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Admin email</label>
                    <Input className="min-h-[52px] rounded-[1.1rem]" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</label>
                    <PasswordInput className="min-h-[52px] rounded-[1.1rem]" value={password} onChange={(event) => setPassword(event.target.value)} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Admin secret</label>
                    <PasswordInput className="min-h-[52px] rounded-[1.1rem]" value={adminSecret} onChange={(event) => setAdminSecret(event.target.value)} />
                  </div>
                  {error ? <div className="rounded-[1.1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                  <Button className="site-primary-button min-h-[54px] w-full" disabled={submitting} type="submit">
                    {submitting ? "Creating admin account..." : "Create admin account"}
                  </Button>
                </form>

                <div className="mt-8 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  Need a public account instead?
                  <Link className="ml-2 inline-flex items-center font-semibold text-blue-600 hover:text-blue-700" to="/register">
                    Back to public signup
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
