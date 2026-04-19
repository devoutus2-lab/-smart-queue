import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Compass, Presentation } from "lucide-react";
import smartQueueLogo from "@/assets/smart-queue-logo.jpg";
import { Button } from "@/components/ui/button";
import { getDemoPresetRoute, useDemoMode } from "@/context/DemoModeContext";
import { useEasterEgg } from "@/context/EasterEggContext";
import { useSession } from "@/context/SessionContext";
import { getHomeRouteForRole, getRoleWorkspaceLabel } from "@/lib/navigation";

type PublicSiteChromeProps = {
  children: ReactNode;
  compactHeader?: boolean;
};

const navItems = [
  { label: "Explore", href: "/#explore" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "For teams", href: "/#for-teams" },
  { label: "Pricing", href: "/pricing" },
];

const socialLinks = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 fill-current">
        <path d="M13.5 21v-8.2h2.8l.4-3.2h-3.2V7.55c0-.93.26-1.56 1.6-1.56H16.8V3.12c-.3-.04-1.34-.12-2.55-.12-2.52 0-4.25 1.54-4.25 4.37v2.24H7.2v3.2H10V21h3.5Z" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://x.com/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 fill-current">
        <path d="M18.9 2H22l-6.77 7.74L23 22h-6.1l-4.78-6.25L6.65 22H3.53l7.23-8.27L1 2h6.25l4.32 5.71L18.9 2Zm-1.07 18h1.69L6.32 3.9H4.5L17.83 20Z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 fill-current">
        <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5Zm8.95 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 6.45A5.55 5.55 0 1 1 6.45 12 5.56 5.56 0 0 1 12 6.45Zm0 1.8A3.75 3.75 0 1 0 15.75 12 3.75 3.75 0 0 0 12 8.25Z" />
      </svg>
    ),
  },
];

export default function PublicSiteChrome({
  children,
  compactHeader = false,
}: PublicSiteChromeProps) {
  const navigate = useNavigate();
  const { user, logout } = useSession();
  const { enabled, currentPreset, controlsHidden, enableDemo, setPanelOpen } = useDemoMode();
  const { triggerLogoTap } = useEasterEgg();
  const workspacePath = user ? getHomeRouteForRole(user.role) : "/account";
  const workspaceLabel = user ? (user.role === "user" ? user.name : getRoleWorkspaceLabel(user.role)) : "Guest account";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="flex items-center gap-6">
            <Link className="site-brand" to="/">
              <span className="site-brand-mark">
                <img
                  alt="Smart Queue logo"
                  className="site-brand-mark-image"
                  src={smartQueueLogo}
                  onClick={(event) => {
                    const opened = triggerLogoTap("main-logo", event.detail);
                    if (opened) {
                      event.preventDefault();
                    }
                  }}
                />
              </span>
              <span className="min-w-0">
                <span className="site-brand-name">Smart Queue</span>
                <span className="site-brand-tag">No Line, Just Time</span>
              </span>
            </Link>

            {!compactHeader ? (
              <nav className="site-nav">
                {navItems.map((item) => (
                  item.href.startsWith("/") && !item.href.includes("#") ? (
                    <Link key={item.label} className="site-nav-link" to={item.href}>
                      {item.label}
                    </Link>
                  ) : (
                    <a key={item.label} className="site-nav-link" href={item.href}>
                      {item.label}
                    </a>
                  )
                ))}
              </nav>
            ) : null}
          </div>

          <div className="site-header-actions">
            {!controlsHidden ? (
              <Button
                className="w-full sm:w-auto"
                variant={enabled ? "default" : "outline"}
                onClick={() => {
                  enableDemo(currentPreset);
                  setPanelOpen(true);
                  if (!window.location.pathname.startsWith("/demo/")) {
                    navigate(getDemoPresetRoute(currentPreset));
                  }
                }}
              >
                <Presentation className="mr-2 h-4 w-4" />
                Demo Mode
              </Button>
            ) : null}
            {user ? (
              <>
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => navigate(workspacePath)}>
                  {workspaceLabel}
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  variant="ghost"
                  onClick={async () => {
                    await logout();
                    navigate("/login");
                  }}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button className="w-full sm:w-auto" variant="ghost" onClick={() => navigate("/login")}>
                  Sign in
                </Button>
                <Button asChild className="site-primary-button w-full sm:w-auto">
                  <a href="/#explore">
                    <Compass className="h-4 w-4" />
                    Explore businesses
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {children}

      <footer className="site-footer">
        <div className="site-footer-grid">
          <div>
            <div className="site-footer-title">Smart Queue</div>
            <p className="site-footer-copy">
              A calmer way to browse businesses, join remotely, book ahead, and stay informed before you leave.
            </p>
          </div>
          <div>
            <div className="site-footer-heading">Browse</div>
            <div className="site-footer-links">
              <a href="/#explore">Explore businesses</a>
              <a href="/#how-it-works">How it works</a>
              <a href="/#for-teams">For teams</a>
              <Link to="/pricing">Pricing</Link>
            </div>
          </div>
          <div>
            <div className="site-footer-heading">Access</div>
            <div className="site-footer-links">
              <Link to="/login">Guest account</Link>
            </div>
          </div>
          <div>
            <div className="site-footer-heading">Next step</div>
            <Link className="site-footer-cta" to="/register">
              Create an account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div>
            <div className="site-footer-heading">Social</div>
            <aside className="login-quick-card site-footer-social" aria-label="Social media shortcuts">
              <ul>
                {socialLinks.map(({ label, href, icon }) => (
                  <li key={label} className="login-quick-item iso-pro">
                    <a className="login-quick-link" href={href} target="_blank" rel="noreferrer" aria-label={label}>
                      <span />
                      <span />
                      <span />
                      <div className="login-quick-text">{label}</div>
                      <div className="login-quick-icon">{icon}</div>
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </footer>
    </div>
  );
}
