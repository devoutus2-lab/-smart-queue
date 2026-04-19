import { useQueryClient } from "@tanstack/react-query";

export function CachedDataNote({ queryKey }: { queryKey: readonly unknown[] }) {
  const queryClient = useQueryClient();
  const state = queryClient.getQueryState(queryKey);

  if (!state?.dataUpdatedAt) {
    return null;
  }

  return (
    <div className="text-xs text-slate-500 dark:text-slate-400">
      Last updated {new Date(state.dataUpdatedAt).toLocaleString()}
    </div>
  );
}
