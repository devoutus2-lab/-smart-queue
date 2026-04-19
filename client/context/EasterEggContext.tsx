import { createContext, type ReactNode, useContext, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

type EasterEggTriggerSource = "main-logo" | "assistant-bubble" | "assistant-panel" | "assistant-name";

type ActiveEasterEgg = {
  source: EasterEggTriggerSource;
  previousPath: string;
};

type EasterEggContextValue = {
  activeGame: ActiveEasterEgg | null;
  triggerLogoTap: (
    source: Extract<EasterEggTriggerSource, "main-logo" | "assistant-bubble" | "assistant-panel">,
    clickCount?: number,
  ) => boolean;
  tryTriggerFromAssistantPrompt: (prompt: string) => boolean;
  closeGame: () => void;
};

const TRIPLE_TAP_WINDOW_MS = 1600;

const EasterEggContext = createContext<EasterEggContextValue | undefined>(undefined);

export function EasterEggProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [activeGame, setActiveGame] = useState<ActiveEasterEgg | null>(null);
  const tapStateRef = useRef<Record<string, { count: number; lastTap: number }>>({});

  const openGame = (source: EasterEggTriggerSource) => {
    setActiveGame({
      source,
      previousPath: `${location.pathname}${location.search}${location.hash}`,
    });
  };

  const triggerLogoTap: EasterEggContextValue["triggerLogoTap"] = (source, clickCount = 1) => {
    if (activeGame) {
      return true;
    }

    if (clickCount >= 3) {
      tapStateRef.current[source] = { count: 0, lastTap: 0 };
      openGame(source);
      return true;
    }

    const now = Date.now();
    const previous = tapStateRef.current[source];
    const count = previous && now - previous.lastTap <= TRIPLE_TAP_WINDOW_MS ? previous.count + 1 : 1;
    tapStateRef.current[source] = { count, lastTap: now };

    if (count >= 3) {
      tapStateRef.current[source] = { count: 0, lastTap: 0 };
      openGame(source);
      return true;
    }

    return false;
  };

  const tryTriggerFromAssistantPrompt = (prompt: string) => {
    if (!/\bxander\b/i.test(prompt)) {
      return false;
    }
    openGame("assistant-name");
    return true;
  };

  const value: EasterEggContextValue = {
    activeGame,
    triggerLogoTap,
    tryTriggerFromAssistantPrompt,
    closeGame: () => setActiveGame(null),
  };

  return <EasterEggContext.Provider value={value}>{children}</EasterEggContext.Provider>;
}

export function useEasterEgg() {
  const context = useContext(EasterEggContext);
  if (!context) throw new Error("useEasterEgg must be used within EasterEggProvider");
  return context;
}
