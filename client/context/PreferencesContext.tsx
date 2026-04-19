import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserPreferences } from "@shared/api";
import { useSession } from "@/context/SessionContext";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

type ThemeMode = "light" | "dark" | "system";

type PreferencesContextValue = UserPreferences & {
  theme: ThemeMode;
  compactMode: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleCompactMode: () => void;
  toggleEmailSummaries: () => void;
  toggleDesktopNotifications: () => void;
  toggleAiAssistant: () => void;
  toggleTravelTips: () => void;
};

type LocalPreferences = {
  theme: ThemeMode;
  compactMode: boolean;
};

const LOCAL_STORAGE_KEY = "smart-queue-local-preferences";
const GUEST_ACCOUNT_STORAGE_KEY = "smart-queue-guest-account-preferences";

const defaultLocalPreferences: LocalPreferences = {
  theme: "light",
  compactMode: false,
};

const defaultAccountPreferences: UserPreferences = {
  emailSummaries: true,
  desktopNotifications: true,
  aiAssistant: true,
  travelTips: true,
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function resolveTheme(theme: ThemeMode) {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function readStoredJson<T>(storageKey: string, defaults: T): T {
  if (typeof window === "undefined") return defaults;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return defaults;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const scope = getAccountScope(user);
  const [localPreferences, setLocalPreferences] = useState<LocalPreferences>(() => readStoredJson(LOCAL_STORAGE_KEY, defaultLocalPreferences));
  const [guestAccountPreferences, setGuestAccountPreferences] = useState<UserPreferences>(() => readStoredJson(GUEST_ACCOUNT_STORAGE_KEY, defaultAccountPreferences));

  const preferencesQuery = useQuery({
    queryKey: accountQueryKeys.userPreferences(scope.userId),
    queryFn: api.getUserPreferences,
    enabled: Boolean(user),
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: api.updateUserPreferences,
    onSuccess: (response) => {
      queryClient.setQueryData(accountQueryKeys.userPreferences(scope.userId), response);
    },
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localPreferences));
    }
    const activeTheme = resolveTheme(localPreferences.theme);
    document.documentElement.classList.toggle("dark", activeTheme === "dark");
    document.documentElement.dataset.compactMode = localPreferences.compactMode ? "true" : "false";
  }, [localPreferences]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GUEST_ACCOUNT_STORAGE_KEY, JSON.stringify(guestAccountPreferences));
    }
  }, [guestAccountPreferences]);

  useEffect(() => {
    if (localPreferences.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      document.documentElement.classList.toggle("dark", resolveTheme("system") === "dark");
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [localPreferences.theme]);

  const accountPreferences = user ? (preferencesQuery.data?.preferences ?? defaultAccountPreferences) : guestAccountPreferences;

  const updateAccountPreferences = (updater: (current: UserPreferences) => UserPreferences) => {
    const next = updater(accountPreferences);
    if (!user) {
      setGuestAccountPreferences(next);
      return;
    }

    queryClient.setQueryData(accountQueryKeys.userPreferences(scope.userId), { preferences: next });
    updatePreferencesMutation.mutate(next, {
      onError: () => {
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.userPreferences(scope.userId) });
      },
    });
  };

  const value = useMemo<PreferencesContextValue>(() => ({
    ...accountPreferences,
    ...localPreferences,
    setTheme: (theme) => setLocalPreferences((current) => ({ ...current, theme })),
    toggleCompactMode: () => setLocalPreferences((current) => ({ ...current, compactMode: !current.compactMode })),
    toggleEmailSummaries: () => updateAccountPreferences((current) => ({ ...current, emailSummaries: !current.emailSummaries })),
    toggleDesktopNotifications: () => updateAccountPreferences((current) => ({ ...current, desktopNotifications: !current.desktopNotifications })),
    toggleAiAssistant: () => updateAccountPreferences((current) => ({ ...current, aiAssistant: !current.aiAssistant })),
    toggleTravelTips: () => updateAccountPreferences((current) => ({ ...current, travelTips: !current.travelTips })),
  }), [accountPreferences, localPreferences, queryClient, scope.userId, user]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}
