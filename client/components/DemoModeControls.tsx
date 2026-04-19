import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Camera, EyeOff, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getHomeRouteForRole } from "@/lib/navigation";
import { getDemoPresetRoute, useDemoMode } from "@/context/DemoModeContext";
import { useSession } from "@/context/SessionContext";

const presetItems = [
  {
    preset: "figure3_main_user" as const,
    title: "Figure 3",
    description: "Main guest home screen with active visits and saved places.",
  },
  {
    preset: "figure4_queue_tracking" as const,
    title: "Figure 4",
    description: "Virtual queue card with real-time style wait tracking.",
  },
  {
    preset: "figure5_owner_dashboard" as const,
    title: "Figure 5",
    description: "Business owner queue management dashboard.",
  },
  {
    preset: "figure6_full_flow" as const,
    title: "Figure 6",
    description: "Full app flow collage for the complete journey.",
  },
];

export function DemoModeControls() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSession();
  const { enabled, currentPreset, controlsHidden, panelOpen, enableDemo, disableDemo, setPreset, setControlsHidden, setPanelOpen } = useDemoMode();
  const exitRoute = user ? getHomeRouteForRole(user.role) : "/login";

  useEffect(() => {
    if (!enabled && location.pathname.startsWith("/demo/")) {
      navigate(user ? getHomeRouteForRole(user.role) : "/login", { replace: true });
    }
  }, [enabled, location.pathname, navigate, user]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (event.shiftKey && key === "d") {
        event.preventDefault();
        setControlsHidden(false);
        setPanelOpen(true);
        return;
      }

      if (event.shiftKey && key === "x") {
        event.preventDefault();
        disableDemo();
        navigate(exitRoute, { replace: true });
        return;
      }

      if (key === "escape") {
        if (controlsHidden) {
          setControlsHidden(false);
          setPanelOpen(true);
          return;
        }

        if (panelOpen) {
          setPanelOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controlsHidden, disableDemo, enabled, exitRoute, navigate, panelOpen, setControlsHidden, setPanelOpen]);

  const openPreset = (preset: (typeof presetItems)[number]["preset"]) => {
    enableDemo(preset);
    setPreset(preset);
    navigate(getDemoPresetRoute(preset));
  };

  if (!enabled) {
    return null;
  }

  return (
    <>
      {panelOpen && !controlsHidden ? (
        <div className="fixed left-4 top-40 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">
                <Sparkles className="h-4 w-4" />
                Guided figures
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">Presentation demo controls</div>
              <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Switch to a ready-made figure screen, then hide the controls for a cleaner screenshot.
              </div>
            </div>
            <button
              className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300"
              onClick={() => setPanelOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {presetItems.map((item) => (
              <button
                key={item.preset}
                className={`w-full rounded-[1.35rem] border px-4 py-4 text-left transition ${
                  currentPreset === item.preset
                    ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-slate-900"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/70"
                }`}
                onClick={() => openPreset(item.preset)}
                type="button"
              >
                <div className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</div>
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setControlsHidden(true)}>
              <EyeOff className="mr-2 h-4 w-4" />
              Hide controls for screenshot
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                disableDemo();
                navigate(exitRoute);
              }}
            >
              <Camera className="mr-2 h-4 w-4" />
              Exit demo mode
            </Button>
          </div>
          <div className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Press `Shift + D` to restore controls, or `Shift + X` to exit demo mode.
          </div>
        </div>
      ) : null}
    </>
  );
}
