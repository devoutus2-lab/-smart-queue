import { Skeleton } from "@/components/ui/skeleton";

type AppLoadingStateProps = {
  title?: string;
  message?: string;
  compact?: boolean;
  showSkeleton?: boolean;
};

export function AppLoadingState({
  title = "Loading your workspace",
  message = "We’re refreshing the latest queues, messages, and settings for you.",
  compact = false,
  showSkeleton = true,
}: AppLoadingStateProps) {
  return (
    <div className={`flex min-h-screen items-center justify-center bg-soft-gradient px-4 ${compact ? "py-10" : "py-16"}`}>
      <div className="w-full max-w-3xl rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-luxury dark:border-slate-800 dark:bg-slate-950/90 sm:p-8">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="app-loading-container" aria-hidden="true">
            <div className="app-loading-ground" />
            <div className="app-loading-skeleton">
              <div className="app-loading-head">
                <span className="app-loading-eye left" />
                <span className="app-loading-eye right" />
                <span className="app-loading-mouth" />
              </div>
              <div className="app-loading-body" />
              <div className="app-loading-arm left" />
              <div className="app-loading-arm right" />
              <div className="app-loading-leg left" />
              <div className="app-loading-leg right" />
            </div>
          </div>

          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-300">
            Loading
          </div>
          <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="mt-3 max-w-lg text-sm leading-7 text-slate-600 dark:text-slate-300">{message}</p>

          {showSkeleton ? (
            <div className="mt-6 grid w-full gap-3">
              <Skeleton className="h-4 w-40 justify-self-center rounded-full" />
              <Skeleton className="h-20 w-full rounded-[1.4rem]" />
              <div className="grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-20 rounded-[1.2rem]" />
                <Skeleton className="h-20 rounded-[1.2rem]" />
                <Skeleton className="h-20 rounded-[1.2rem]" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function InlineLoadingState({
  title = "Loading",
  message = "Fetching the latest details for this view.",
}: AppLoadingStateProps) {
  return <AppLoadingState compact title={title} message={message} />;
}
