import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, LogOut, Menu, Presentation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDemoPresetRoute, useDemoMode } from "@/context/DemoModeContext";

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  badgeCount?: number;
};

type RoleWorkspaceShellProps = {
  badge: string;
  title: string;
  subtitle?: string;
  navItems: NavItem[];
  activePath: string;
  homeLabel?: string;
  homeTo?: string;
  onSignOut: () => Promise<void>;
  aside: ReactNode;
  children: ReactNode;
};

export default function RoleWorkspaceShell({
  badge,
  title,
  subtitle,
  navItems,
  activePath,
  homeLabel,
  homeTo,
  onSignOut,
  aside,
  children,
}: RoleWorkspaceShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { enabled, currentPreset, controlsHidden, enableDemo, setPanelOpen } = useDemoMode();
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem("qtech_workspace_sidebar_hidden");
    setSidebarHidden(storedValue === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("qtech_workspace_sidebar_hidden", String(sidebarHidden));
  }, [sidebarHidden]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const navContent = (
    <nav className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
      {navItems.map(({ label, to, icon: Icon, badgeCount }) => {
        const isActive = activePath === to;
        return (
          <Link
            key={to}
            className={`flex min-h-[3.25rem] items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              isActive
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
            to={to}
          >
            <Icon aria-hidden="true" className="h-4 w-4 flex-shrink-0" />
            <span className="min-w-0 flex-1">{label}</span>
            {badgeCount && badgeCount > 0 ? (
              <span
                className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700 dark:bg-slate-800 dark:text-blue-200"
                }`}
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const asideContent = (
    <>
      {aside}
      {navContent}
    </>
  );

  return (
    <div className="min-h-screen bg-soft-gradient">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-500">{badge}</p>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
            <Button
              className="w-full sm:w-auto lg:hidden"
              variant="outline"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="mr-2 h-4 w-4" />
              Menu
            </Button>
            {!controlsHidden ? (
              <Button
                className="w-full sm:w-auto"
                variant={enabled ? "default" : "outline"}
                onClick={() => {
                  enableDemo(currentPreset);
                  setPanelOpen(true);
                  if (!location.pathname.startsWith("/demo/")) {
                    navigate(getDemoPresetRoute(currentPreset));
                  }
                }}
              >
                <Presentation className="mr-2 h-4 w-4" />
                Demo Mode
              </Button>
            ) : null}
            {homeLabel && homeTo ? (
              <Button asChild className="w-full sm:w-auto" variant="outline">
                <Link to={homeTo}>{homeLabel}</Link>
              </Button>
            ) : null}
            <Button className="w-full sm:w-auto" variant="ghost" onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-50 bg-slate-950/45 transition duration-200 lg:hidden ${mobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
        <button
          aria-label="Close navigation menu"
          className="absolute inset-0 cursor-default"
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
      </div>

      <aside
        aria-hidden={!mobileMenuOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(88vw,22rem)] flex-col overflow-y-auto border-r border-white/60 bg-white/96 px-4 pb-6 pt-4 shadow-2xl backdrop-blur-xl transition-transform duration-200 dark:border-slate-800 dark:bg-slate-950/96 lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">{badge}</p>
            <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{title}</p>
          </div>
          <button
            aria-label="Close navigation menu"
            className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setMobileMenuOpen(false)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1">{asideContent}</div>
      </aside>

      <main className={`dashboard-frame relative ${sidebarHidden ? "" : "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]"}`}>
        {!sidebarHidden ? (
          <aside className="glass-panel compact-target relative hidden rounded-[2.1rem] border border-white/60 p-6 shadow-luxury dark:border-slate-800 lg:sticky lg:top-24 lg:block lg:self-start xl:p-8">
            <button
              aria-label="Hide sidebar"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => setSidebarHidden(true)}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {asideContent}
          </aside>
        ) : null}

        <section className={`min-w-0 space-y-8 xl:space-y-10 ${sidebarHidden ? "lg:col-span-full" : ""}`}>
          {sidebarHidden ? (
            <button
              aria-label="Show sidebar"
              className="hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800 lg:inline-flex"
              onClick={() => setSidebarHidden(false)}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
          {children}
        </section>
      </main>
    </div>
  );
}
