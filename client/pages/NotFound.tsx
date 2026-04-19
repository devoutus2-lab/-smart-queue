import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import PublicSiteChrome from "@/components/PublicSiteChrome";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <PublicSiteChrome compactHeader>
      <main className="page-frame">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-white/70 bg-white/90 px-8 py-16 text-center shadow-luxury dark:border-slate-800 dark:bg-slate-950/85">
          <div className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-500">Page not found</div>
          <h1 className="mt-5 text-4xl text-slate-900 dark:text-slate-100 sm:text-5xl">That page isn&apos;t available right now.</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
            The page you opened may have moved, expired, or never existed. You can head back to the homepage and keep exploring from there.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="site-primary-button">
              <Link to="/">Return home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/login">Open sign in</Link>
            </Button>
          </div>
        </section>
      </main>
    </PublicSiteChrome>
  );
};

export default NotFound;
