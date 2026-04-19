import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing its token.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your password confirmation does not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword({ token, password });
      setSuccess(true);
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't reset your password yet.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicSiteChrome compactHeader>
      <main className="page-frame">
        <div className="mx-auto max-w-3xl">
          <section className="section-shell p-6 text-slate-900 dark:text-slate-100 sm:p-8 lg:p-10">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                <LockKeyhole className="h-7 w-7" />
              </div>
              <h1 className="mt-5 text-4xl">Set a new password</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Choose a new password for your Smart Queue account, then head back to sign in.
              </p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">New password</label>
                <Input className="min-h-[52px] rounded-[1.1rem]" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Confirm new password</label>
                <Input className="min-h-[52px] rounded-[1.1rem]" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </div>
              {error ? <div className="rounded-[1.1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
              {success ? <div className="rounded-[1.1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Password updated. Redirecting you to sign in...</div> : null}
              <Button className="site-primary-button min-h-[54px] w-full" disabled={submitting || success} type="submit">
                {submitting ? "Resetting password..." : "Reset password"}
              </Button>
            </form>

            <div className="mt-8 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              Need a fresh reset link?
              <Link className="ml-2 inline-flex items-center font-semibold text-blue-600 hover:text-blue-700" to="/forgot-password">
                Request another one
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </main>
    </PublicSiteChrome>
  );
}
