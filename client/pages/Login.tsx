import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Clock3, LogIn, MessageSquareMore, Settings2, Sparkles } from "lucide-react";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import HostedStorageNotice from "@/components/HostedStorageNotice";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useSession } from "@/context/SessionContext";
import { getHomeRouteForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const COOKIE_CONSENT_KEY = "smartqueue_cookie_consent";

const loginHighlights = [
  {
    title: "Stay informed",
    body: "Keep live updates, repeated reminders, and messages in one calm place.",
    Icon: Clock3,
    accent: "Live updates",
    detail: "Check queue movement, booking reminders, and replies from businesses without chasing updates.",
  },
  {
    title: "Reach out early",
    body: "Ask a quick question before you decide when to leave.",
    Icon: MessageSquareMore,
    accent: "Quick questions",
    detail: "Send simple questions before traveling so you can avoid wasted trips and uncertain timing.",
  },
  {
    title: "Move with confidence",
    body: "Let Smart Queue hold your place while you finish other errands.",
    Icon: Sparkles,
    accent: "Remote queueing",
    detail: "Join remotely, keep your plans moving, and arrive when the visit actually fits your day.",
  },
];

type CookieConsent = {
  essential: true;
  analytics: boolean;
  personalization: boolean;
  updatedAt: string;
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState(0);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [cookieOptionsOpen, setCookieOptionsOpen] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [personalizationConsent, setPersonalizationConsent] = useState(true);

  const from = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existingConsent = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    setShowCookieBanner(!existingConsent);
  }, []);

  function saveCookieConsent(consent: CookieConsent) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
    }
    setShowCookieBanner(false);
    setCookieOptionsOpen(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter both your email and password to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await login({ email, password });
      navigate(from || (result.user ? getHomeRouteForRole(result.user.role) : "/"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't sign you in just yet.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleAcceptAllCookies() {
    setAnalyticsConsent(true);
    setPersonalizationConsent(true);
    saveCookieConsent({
      essential: true,
      analytics: true,
      personalization: true,
      updatedAt: new Date().toISOString(),
    });
  }

  function handleSaveCookiePreferences() {
    saveCookieConsent({
      essential: true,
      analytics: analyticsConsent,
      personalization: personalizationConsent,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <PublicSiteChrome compactHeader>
      <main className="login-page-stage">
        <div className="login-rain-shell relative overflow-visible px-4 py-8 sm:px-5 sm:py-10 lg:px-8 lg:py-14">
          <div aria-hidden className="login-rain-bg pointer-events-none absolute inset-0" />
          <div className="relative z-10 mx-auto flex w-full max-w-[92rem] flex-col gap-8">
            <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
              <section className="auth-shell p-6 text-white sm:p-8 lg:p-12">
                <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                  Step back into a calmer way to manage visits.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
                  Sign in to keep Smart Queue getting in line for you, helping businesses reduce long queues, and keeping every visit easier to plan.
                </p>

                <div className="login-feature-stack mt-10" aria-label="Smart Queue benefits">
                  {loginHighlights.map(({ title, body, Icon, accent, detail }, index) => (
                    <button
                      key={title}
                      type="button"
                      className={cn(
                        "login-feature-card",
                        activeHighlight === index && "is-active",
                        activeHighlight < index && "is-shifted",
                      )}
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
                    <LogIn className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-4xl">Sign in</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    We&apos;ll bring back your live queues, bookings, saved businesses, and messages right where you left them.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
                    <Input className="min-h-[52px] rounded-[1.1rem]" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</label>
                    <PasswordInput className="min-h-[52px] rounded-[1.1rem]" value={password} onChange={(event) => setPassword(event.target.value)} />
                  </div>
                  {error ? <div className="rounded-[1.1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                  <div className="flex justify-end">
                    <Link className="text-sm font-semibold text-blue-600 hover:text-blue-700" to="/forgot-password">
                      Forgot password?
                    </Link>
                  </div>
                  <Button className="site-primary-button min-h-[54px] w-full" disabled={submitting} type="submit">
                    {submitting ? "Signing you in..." : "Continue to your account"}
                  </Button>
                </form>

                <div className="mt-8 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  Creating a personal account instead?
                  <Link className="ml-2 inline-flex items-center font-semibold text-blue-600 hover:text-blue-700" to="/register">
                    Start here
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>

                <HostedStorageNotice className="mt-5" />

                <div className="mt-5 rounded-[1.4rem] border border-blue-100 bg-blue-50/70 p-5 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">Demo access</div>
                  <div className="mt-1">
                    Sample accounts are still available for testing. Use any seeded email below with the password `password123`.
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      ["Guest demo", "sara@qless.app"],
                      ["Business demo", "owner.bank@qless.app"],
                      ["Admin demo", "admin@qless.app"],
                    ].map(([label, value]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setEmail(value)}
                        className="rounded-full border border-blue-200 bg-white px-4 py-2 font-semibold text-blue-700 transition hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>

          </div>

          {showCookieBanner ? (
            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex justify-end sm:inset-x-5 sm:bottom-5 lg:inset-x-8 lg:bottom-8">
              <aside className="login-cookie-card pointer-events-auto" aria-live="polite">
                <div className="login-cookie-inner">
                  <span className="login-cookie-illustration" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" height="46" width="65" viewBox="0 0 65 46">
                      <path stroke="#000" fill="#EAB789" d="M49.157 15.69L44.58.655l-12.422 1.96L21.044.654l-8.499 2.615-6.538 5.23-4.576 9.153v11.114l4.576 8.5 7.846 5.23 10.46 1.96 7.845-2.614 9.153 2.615 11.768-2.615 7.846-7.846 1.96-5.884.655-7.191-7.846-1.308-6.537-3.922z" />
                      <path fill="#9C6750" d="M32.286 3.749c-6.94 3.65-11.69 11.053-11.69 19.591 0 8.137 4.313 15.242 10.724 19.052a20.513 20.513 0 01-8.723 1.937c-11.598 0-21-9.626-21-21.5 0-11.875 9.402-21.5 21-21.5 3.495 0 6.79.874 9.689 2.42z" clipRule="evenodd" fillRule="evenodd" />
                      <path fill="#634647" d="M64.472 20.305a.954.954 0 00-1.172-.824 4.508 4.508 0 01-3.958-.934.953.953 0 00-1.076-.11c-.46.252-.977.383-1.502.382a3.154 3.154 0 01-2.97-2.11.954.954 0 00-.833-.634 4.54 4.54 0 01-4.205-4.507c.002-.23.022-.46.06-.687a.952.952 0 00-.213-.767 3.497 3.497 0 01-.614-3.5.953.953 0 00-.382-1.138 3.522 3.522 0 01-1.5-3.992.951.951 0 00-.762-1.227A22.611 22.611 0 0032.3 2.16 22.41 22.41 0 0022.657.001a22.654 22.654 0 109.648 43.15 22.644 22.644 0 0032.167-22.847zM22.657 43.4a20.746 20.746 0 110-41.493c2.566-.004 5.11.473 7.501 1.407a22.64 22.64 0 00.003 38.682 20.6 20.6 0 01-7.504 1.404zm19.286 0a20.746 20.746 0 112.131-41.384 5.417 5.417 0 001.918 4.635 5.346 5.346 0 00-.133 1.182A5.441 5.441 0 0046.879 11a5.804 5.804 0 00-.028.568 6.456 6.456 0 005.38 6.345 5.053 5.053 0 006.378 2.472 6.412 6.412 0 004.05 1.12 20.768 20.768 0 01-20.716 21.897z" />
                      <path fill="#644647" d="M54.962 34.3a17.719 17.719 0 01-2.602 2.378.954.954 0 001.14 1.53 19.637 19.637 0 002.884-2.634.955.955 0 00-1.422-1.274z" />
                      <path strokeWidth="1.8" stroke="#644647" fill="#845556" d="M44.5 32.829c-.512 0-1.574.215-2 .5-.426.284-.342.263-.537.736a2.59 2.59 0 104.98.99c0-.686-.458-1.241-.943-1.726-.485-.486-.814-.5-1.5-.5zm-30.916-2.5c-.296 0-.912.134-1.159.311-.246.177-.197.164-.31.459a1.725 1.725 0 00-.086.932c.058.312.2.6.41.825.21.226.477.38.768.442.291.062.593.03.867-.092s.508-.329.673-.594a1.7 1.7 0 00.253-.896c0-.428-.266-.774-.547-1.076-.281-.302-.471-.31-.869-.311zm17.805-11.375c-.143-.492-.647-1.451-1.04-1.78-.392-.33-.348-.255-.857-.31a2.588 2.588 0 10.441 5.06c.66-.194 1.064-.788 1.395-1.39.33-.601.252-.92.06-1.58zm-22 2c-.143-.492-.647-1.451-1.04-1.78-.391-.33-.347-.255-.856-.31a2.589 2.589 0 10.44 5.06c.66-.194 1.064-.788 1.395-1.39.33-.601.252-.92.06-1.58zM38.112 7.329c-.395 0-1.216.179-1.545.415-.328.236-.263.218-.415.611-.151.393-.19.826-.114 1.243.078.417.268.8.548 1.1.28.301.636.506 1.024.59.388.082.79.04 1.155-.123.366-.163.678-.438.898-.792.22-.354.337-.77.337-1.195 0-.57-.354-1.031-.73-1.434-.374-.403-.628-.415-1.158-.415zm-19.123.703c.023-.296-.062-.92-.219-1.18-.157-.26-.148-.21-.432-.347a1.726 1.726 0 00-.922-.159 1.654 1.654 0 00-.856.344 1.471 1.471 0 00-.501.73c-.085.285-.077.589.023.872.1.282.287.532.538.718a1.7 1.7 0 00.873.323c.427.033.793-.204 1.116-.46.324-.256.347-.445.38-.841z" />
                      <path fill="#634647" d="M15.027 15.605a.954.954 0 00-1.553 1.108l1.332 1.863a.955.955 0 001.705-.77.955.955 0 00-.153-.34l-1.331-1.861z" />
                      <path fill="#644647" d="M43.31 23.21a.954.954 0 101.553-1.11l-1.266-1.772a.954.954 0 10-1.552 1.11l1.266 1.772z" />
                      <path fill="#634647" d="M19.672 35.374a.954.954 0 00-.954.953v2.363a.954.954 0 001.907 0v-2.362a.954.954 0 00-.953-.954z" />
                      <path fill="#644647" d="M33.129 29.18l-2.803 1.065a.953.953 0 00-.053 1.764.957.957 0 00.73.022l2.803-1.065a.953.953 0 00-.677-1.783v-.003zm24.373-3.628l-2.167.823a.956.956 0 00-.054 1.764.954.954 0 00.73.021l2.169-.823a.954.954 0 10-.678-1.784v-.001z" />
                    </svg>
                  </span>

                  <h5 className="login-cookie-title">Your privacy is important to us</h5>

                  <p className="login-cookie-copy">
                    We process your information to keep the login experience secure, measure improvements, and personalize helpful content. See our{" "}
                    <Link className="login-cookie-link" to="/pricing">
                      Privacy Policy
                    </Link>
                    .
                  </p>

                  {cookieOptionsOpen ? (
                    <div className="login-cookie-options">
                      <label className="login-cookie-option">
                        <div>
                          <div className="login-cookie-option-title">Essential cookies</div>
                          <div className="login-cookie-option-copy">Required for sign-in, session security, and accessibility.</div>
                        </div>
                        <Checkbox checked disabled />
                      </label>
                      <label className="login-cookie-option">
                        <div>
                          <div className="login-cookie-option-title">Analytics cookies</div>
                          <div className="login-cookie-option-copy">Help us understand performance and improve the page.</div>
                        </div>
                        <Checkbox checked={analyticsConsent} onCheckedChange={(checked) => setAnalyticsConsent(checked === true)} />
                      </label>
                      <label className="login-cookie-option">
                        <div>
                          <div className="login-cookie-option-title">Personalization cookies</div>
                          <div className="login-cookie-option-copy">Remember helpful preferences and tailor your experience.</div>
                        </div>
                        <Checkbox checked={personalizationConsent} onCheckedChange={(checked) => setPersonalizationConsent(checked === true)} />
                      </label>
                    </div>
                  ) : null}

                  <button
                    className="login-cookie-options-trigger"
                    type="button"
                    onClick={() => setCookieOptionsOpen((current) => !current)}
                  >
                    <Settings2 className="h-4 w-4" />
                    {cookieOptionsOpen ? "Hide options" : "More options"}
                  </button>

                  <button
                    className="login-cookie-accept"
                    type="button"
                    onClick={cookieOptionsOpen ? handleSaveCookiePreferences : handleAcceptAllCookies}
                  >
                    {cookieOptionsOpen ? "Save choices" : "Accept"}
                  </button>
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      </main>
    </PublicSiteChrome>
  );
}
