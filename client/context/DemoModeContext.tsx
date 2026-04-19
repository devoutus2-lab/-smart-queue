import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type DemoPreset = "figure3_main_user" | "figure4_queue_tracking" | "figure5_owner_dashboard" | "figure6_full_flow";

type DemoModeContextValue = {
  enabled: boolean;
  currentPreset: DemoPreset;
  controlsHidden: boolean;
  panelOpen: boolean;
  enableDemo: (preset?: DemoPreset) => void;
  disableDemo: () => void;
  setPreset: (preset: DemoPreset) => void;
  setControlsHidden: (hidden: boolean) => void;
  setPanelOpen: (open: boolean) => void;
};

const STORAGE_KEY = "smart-queue-demo-mode";

const defaultState: Pick<DemoModeContextValue, "enabled" | "currentPreset" | "controlsHidden" | "panelOpen"> = {
  enabled: false,
  currentPreset: "figure3_main_user",
  controlsHidden: false,
  panelOpen: false,
};

type PersistedDemoModeState = Pick<DemoModeContextValue, "enabled" | "currentPreset">;

const DemoModeContext = createContext<DemoModeContextValue | undefined>(undefined);

export function getDemoPresetRoute(preset: DemoPreset) {
  switch (preset) {
    case "figure3_main_user":
      return "/demo/figure-3";
    case "figure4_queue_tracking":
      return "/demo/figure-4/401";
    case "figure5_owner_dashboard":
      return "/demo/figure-5";
    case "figure6_full_flow":
      return "/demo/figure-6";
    default:
      return "/demo/figure-3";
  }
}

export function getDemoPresetLabel(preset: DemoPreset) {
  switch (preset) {
    case "figure3_main_user":
      return "Figure 3";
    case "figure4_queue_tracking":
      return "Figure 4";
    case "figure5_owner_dashboard":
      return "Figure 5";
    case "figure6_full_flow":
      return "Figure 6";
    default:
      return "Demo";
  }
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(defaultState);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<PersistedDemoModeState>;
      setState((current) => ({
        ...current,
        enabled: parsed.enabled ?? current.enabled,
        currentPreset: parsed.currentPreset ?? current.currentPreset,
      }));
    } catch {
      setState(defaultState);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistedState: PersistedDemoModeState = {
      enabled: state.enabled,
      currentPreset: state.currentPreset,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }, [state.currentPreset, state.enabled]);

  const value = useMemo<DemoModeContextValue>(
    () => ({
      ...state,
      enableDemo: (preset = state.currentPreset) =>
        setState((current) => ({
          ...current,
          enabled: true,
          currentPreset: preset,
          controlsHidden: false,
          panelOpen: true,
        })),
      disableDemo: () =>
        setState((current) => ({
          ...current,
          enabled: false,
          controlsHidden: false,
          panelOpen: false,
        })),
      setPreset: (preset) =>
        setState((current) => ({
          ...current,
          currentPreset: preset,
        })),
      setControlsHidden: (hidden) =>
        setState((current) => ({
          ...current,
          controlsHidden: hidden,
          panelOpen: hidden ? false : current.panelOpen,
        })),
      setPanelOpen: (open) =>
        setState((current) => ({
          ...current,
          panelOpen: open,
          controlsHidden: open ? false : current.controlsHidden,
        })),
    }),
    [state],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) throw new Error("useDemoMode must be used within DemoModeProvider");
  return context;
}
