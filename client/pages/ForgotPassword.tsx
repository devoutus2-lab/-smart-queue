import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, KeyRound, MailCheck } from "lucide-react";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetLinkPreview, setResetLinkPreview] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    setResetLinkPreview(null);
    try {
      const result = await api.forgotPassword({ email });
      setSuccess("If that email exists, a password reset link is ready.");
      setResetLinkPreview(result.resetLinkPreview ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't prepare a reset link yet.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicSiteChrome compactHeader>
      <main className="page-frame">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="auth-shell p-6 text-white sm:p-8 lg:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-200">Account recovery</p>
            <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">Reset access without losing your place.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
              We&apos;ll help you set a new password so your saved places, queues, messages, and visit history stay with your account.
            </p>
            <div className="mt-8 rounded-[1.7rem] border border-white/15 bg-white/10 p-5">
              <div className="flex items-center gap-3 text-amber-100">
                <MailCheck className="h-5 w-5" />
                <span className="font-semibold">Quick recovery</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-blue-100">
                Enter your account email and we&apos;ll generate a reset path. In this local build, the link is shown right on the page for testing.
              </p>
            </div>
          </section>

          <section className="section-shell p-6 text-slate-900 dark:text-slate-100 sm:p-8 lg:p-10">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                <KeyRound className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-4xl">Forgot password</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Enter the email you used when you created your account.
              </p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
                <Input className="min-h-[52px] rounded-[1.1rem]" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" />
              </div>
              {error ? <div className="rounded-[1.1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
              {success ? <div className="rounded-[1.1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
              <Button className="site-primary-button min-h-[54px] w-full" disabled={submitting} type="submit">
                {submitting ? "Preparing reset..." : "Send reset link"}
              </Button>
            </form>

            {resetLinkPreview ? (
              <div className="mt-5 rounded-[1.4rem] border border-blue-100 bg-blue-50/70 p-5 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Local preview link</div>
                <Link className="mt-2 inline-flex items-center font-semibold text-blue-600 hover:text-blue-700" to={resetLinkPreview}>
                  Open reset page
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            ) : null}

            <div className="mt-8 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              Remembered your password?
              <Link className="ml-2 inline-flex items-center font-semibold text-blue-600 hover:text-blue-700" to="/login">
                Back to sign in
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </main>
    </PublicSiteChrome>
  );
}
