import { useEffect, useRef, useState } from "react";
import {
  Clock3,
  Heart,
  RefreshCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEasterEgg } from "@/context/EasterEggContext";

type QueueDashStatus = "intro" | "playing" | "finishing" | "won" | "lost";
type ObstacleKind = "stanchion" | "closed" | "ticket" | "cone";

type ObstacleSpec = {
  kind: ObstacleKind;
  label: string;
  coaching: string;
  width: number;
  height: number;
  hitbox: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
};

type RunnerObstacle = {
  id: number;
  spec: ObstacleSpec;
  x: number;
  cleared: boolean;
};

type RenderState = {
  status: QueueDashStatus;
  timeLeftMs: number;
  distance: number;
  lives: number;
  resolvedObstacles: number;
  runnerY: number;
  runnerTilt: number;
  finishProgress: number;
  obstacles: RunnerObstacle[];
  feedback: string;
};

function formatSeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000));
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatObstacleHint(label: string, coaching: string) {
  const normalizedCoaching = coaching.replace(/^It is\s+/i, "").replace(/\.\s*$/, "");
  return `${label}. ${normalizedCoaching}.`;
}

const TRIGGER_LABELS = {
  "main-logo": "Priority override accepted from the Smart Queue brand mark.",
  "assistant-bubble": "Priority override accepted from the assistant bubble.",
  "assistant-panel": "Priority override accepted from the assistant panel.",
  "assistant-name": "Priority override accepted. Xander recognized your request.",
} satisfies Record<string, string>;

const AUDIO_PATHS = {
  background: "/queue-sprint-background.mp3",
  startFinish: "/queue-sprint-start-finish.mp3",
  gameOver: "/queue-sprint-game-over.mp3",
} as const;

const GAME_DURATION_MS = 120000;
const TARGET_DISTANCE = 13200;
const DISTANCE_SPEED = 110;
const RUN_SPEED = 248;
const FINISH_SPEED = 0.75;
const WORLD_WIDTH = 980;
const CAPY_X = 148;
const CAPY_VISUAL_WIDTH = 152;
const CAPY_VISUAL_HEIGHT = 116;
const CAPY_HITBOX = { left: 52, right: 96, top: 80, bottom: 20 };
const OBSTACLE_EDGE_FORGIVENESS = 4;
const JUMP_VELOCITY = 1020;
const JUMP_HANG_MS = 135;
const RISE_GRAVITY = 2200;
const FALL_GRAVITY = 3050;
const HANG_GRAVITY = 880;
const MAX_LIVES = 3;
const JUMP_BUFFER_MS = 140;
const COYOTE_MS = 95;
const FEEDBACK_HOLD_MS = 1150;
const MIN_SPAWN_GAP = 420;
const MAX_SPAWN_GAP = 560;
const MIN_SPAWN_DISTANCE = 260;
const MAX_SPAWN_DISTANCE = 360;
const AVERAGE_SPAWN_DISTANCE = (MIN_SPAWN_DISTANCE + MAX_SPAWN_DISTANCE) / 2;
const TOTAL_OBSTACLES = Math.ceil(TARGET_DISTANCE / AVERAGE_SPAWN_DISTANCE);
const FRONT_DESK_FINAL_SHIFT = 280;
const FLOOR_HEIGHT = 96;
const WIN_CONFETTI_COLORS = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

const OBSTACLES: ObstacleSpec[] = [
  {
    kind: "stanchion",
    label: "Rush-hour cloud",
    coaching: "A surge of incoming guests is building overhead. Jump as the rain cloud reaches Capy to clear the rush cleanly.",
    width: 82,
    height: 90,
    hitbox: { left: 18, right: 64, top: 74, bottom: 8 },
  },
  {
    kind: "closed",
    label: "Closed lane sign",
    coaching: "A service lane has been shut down. Take off a touch early so Capy clears the closed sign cleanly.",
    width: 84,
    height: 100,
    hitbox: { left: 20, right: 64, top: 90, bottom: 4 },
  },
  {
    kind: "ticket",
    label: "Wait-time hourglass",
    coaching: "The wait time is stretching out. Use a short hop just before the hourglass reaches Capy.",
    width: 84,
    height: 52,
    hitbox: { left: 22, right: 62, top: 42, bottom: 4 },
  },
  {
    kind: "cone",
    label: "Queue flare-up",
    coaching: "Tension in the line is flaring up. Jump a beat early so Capy clears the flame burst on the way up.",
    width: 60,
    height: 62,
    hitbox: { left: 16, right: 44, top: 52, bottom: 4 },
  },
];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createObstacle(id: number, previousX: number | null): RunnerObstacle {
  const spec = OBSTACLES[id % OBSTACLES.length];
  const gap = randomBetween(MIN_SPAWN_GAP, MAX_SPAWN_GAP);
  const startX = previousX === null ? WORLD_WIDTH + 120 : Math.max(WORLD_WIDTH + 120, previousX + gap);
  return { id, spec, x: startX, cleared: false };
}

function defaultRenderState(): RenderState {
  return {
    status: "intro",
    timeLeftMs: GAME_DURATION_MS,
    distance: 0,
    lives: MAX_LIVES,
    resolvedObstacles: 0,
    runnerY: 0,
    runnerTilt: 0,
    finishProgress: 0,
    obstacles: [],
    feedback: "Capy is lined up in the premium lane. Jump just before each obstacle reaches the runner.",
  };
}

export function QueueDashOverlay() {
  const { activeGame, closeGame } = useEasterEgg();
  const [renderState, setRenderState] = useState<RenderState>(() => defaultRenderState());
  const [muted, setMuted] = useState(false);

  const isOpen = Boolean(activeGame);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const stateRef = useRef<RenderState>(defaultRenderState());
  const runnerRef = useRef({
    y: 0,
    velocityY: 0,
    grounded: true,
    jumpBufferMs: 0,
    jumpHangMs: 0,
    coyoteMs: COYOTE_MS,
  });
  const spawnRef = useRef({
    nextDistance: 260,
    obstacleId: 0,
    lastSpawnX: null as number | null,
  });
  const statusRef = useRef<QueueDashStatus>("intro");
  const feedbackRef = useRef(stateRef.current.feedback);
  const feedbackUntilRef = useRef(0);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const startFinishAudioRef = useRef<HTMLAudioElement | null>(null);
  const gameOverAudioRef = useRef<HTMLAudioElement | null>(null);
  const finishCuePlayedRef = useRef(false);
  const winCelebratedRef = useRef(false);
  const confettiFrameRef = useRef<number | null>(null);
  const confettiLoaderRef = useRef<Promise<typeof import("canvas-confetti")> | null>(null);

  const pauseAudio = (audio: HTMLAudioElement | null, reset = false) => {
    if (!audio) return;
    audio.pause();
    if (reset) audio.currentTime = 0;
  };

  const ensureAudio = () => {
    if (backgroundAudioRef.current && startFinishAudioRef.current && gameOverAudioRef.current) return;

    backgroundAudioRef.current = new Audio(AUDIO_PATHS.background);
    startFinishAudioRef.current = new Audio(AUDIO_PATHS.startFinish);
    gameOverAudioRef.current = new Audio(AUDIO_PATHS.gameOver);

    [backgroundAudioRef.current, startFinishAudioRef.current, gameOverAudioRef.current].forEach((audio) => {
      audio.preload = "none";
      audio.muted = muted;
    });
  };

  const stopAllAudio = (reset = true) => {
    pauseAudio(backgroundAudioRef.current, reset);
    pauseAudio(startFinishAudioRef.current, reset);
    pauseAudio(gameOverAudioRef.current, reset);
  };

  const stopConfetti = () => {
    if (confettiFrameRef.current !== null) {
      window.cancelAnimationFrame(confettiFrameRef.current);
      confettiFrameRef.current = null;
    }
  };

  const loadConfetti = () => {
    if (!confettiLoaderRef.current) {
      confettiLoaderRef.current = import("canvas-confetti");
    }
    return confettiLoaderRef.current;
  };

  const launchWinConfetti = async () => {
    stopConfetti();
    const { default: confetti } = await loadConfetti();
    if (statusRef.current !== "won") return;

    const end = Date.now() + 3_000;

    const frame = () => {
      if (Date.now() > end || statusRef.current !== "won") {
        confettiFrameRef.current = null;
        return;
      }

      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        startVelocity: 60,
        origin: { x: 0, y: 0.5 },
        colors: WIN_CONFETTI_COLORS,
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        startVelocity: 60,
        origin: { x: 1, y: 0.5 },
        colors: WIN_CONFETTI_COLORS,
      });

      confettiFrameRef.current = window.requestAnimationFrame(frame);
    };

    frame();
  };

  const playAudio = (
    audio: HTMLAudioElement | null,
    options: { loop?: boolean; volume?: number; reset?: boolean } = {},
  ) => {
    if (!audio || muted) return;
    const { loop = false, volume = 1, reset = true } = options;
    audio.loop = loop;
    audio.volume = volume;
    if (reset) audio.currentTime = 0;
    const promise = audio.play();
    if (promise) promise.catch(() => undefined);
  };

  const syncRender = (patch: Partial<RenderState>) => {
    const nextState = { ...stateRef.current, ...patch };
    stateRef.current = nextState;
    feedbackRef.current = nextState.feedback;
    setRenderState(nextState);
  };

  const resetRunState = () => {
    const next = defaultRenderState();
    stateRef.current = next;
    feedbackRef.current = next.feedback;
    setRenderState(next);
    runnerRef.current = {
      y: 0,
      velocityY: 0,
      grounded: true,
      jumpBufferMs: 0,
      jumpHangMs: 0,
      coyoteMs: COYOTE_MS,
    };
    spawnRef.current = {
      nextDistance: 260,
      obstacleId: 0,
      lastSpawnX: null,
    };
    finishCuePlayedRef.current = false;
    winCelebratedRef.current = false;
    stopConfetti();
    lastTickRef.current = null;
    statusRef.current = "intro";
    feedbackUntilRef.current = 0;
  };

  const holdFeedback = (message: string, untilMs: number) => {
    feedbackRef.current = message;
    feedbackUntilRef.current = untilMs;
    return message;
  };

  const transitionTo = (nextStatus: QueueDashStatus, feedback: string) => {
    statusRef.current = nextStatus;
    syncRender({ status: nextStatus, feedback });
  };

  const handleClose = () => {
    stopAllAudio(true);
    closeGame();
    window.requestAnimationFrame(() => {
      window.location.reload();
    });
  };

  const beginRun = () => {
    resetRunState();
    ensureAudio();
    transitionTo("playing", "Queue Sprint is live. Jump late, stay smooth, and keep the lane clean all the way to the desk.");
    feedbackUntilRef.current = nowMs() + FEEDBACK_HOLD_MS;
    stopAllAudio(true);
    playAudio(startFinishAudioRef.current, { volume: 0.42 });
    playAudio(backgroundAudioRef.current, { loop: true, volume: 0.18 });
  };

  const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  const queueJump = () => {
    if (statusRef.current !== "playing") return;
    runnerRef.current.jumpBufferMs = JUMP_BUFFER_MS;
  };

  useEffect(() => {
    if (!isOpen) {
      stopAllAudio(true);
      stopConfetti();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    resetRunState();

    return () => {
      document.body.style.overflow = previousOverflow;
      stopAllAudio(true);
      stopConfetti();
    };
  }, [activeGame?.previousPath, activeGame?.source, isOpen]);

  useEffect(() => {
    [backgroundAudioRef.current, startFinishAudioRef.current, gameOverAudioRef.current].forEach((audio) => {
      if (!audio) return;
      audio.muted = muted;
    });
  }, [muted]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && statusRef.current !== "won" && statusRef.current !== "lost") {
        handleClose();
        return;
      }

      if (statusRef.current === "intro" && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        beginRun();
        return;
      }

      if (event.key === " " || event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        event.preventDefault();
        queueJump();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || renderState.status !== "won" || winCelebratedRef.current) return;
    winCelebratedRef.current = true;
    launchWinConfetti();
  }, [isOpen, renderState.status]);

  useEffect(() => {
    if (statusRef.current !== "playing" && statusRef.current !== "finishing") {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTickRef.current = null;
      return;
    }

    const tick = (timestamp: number) => {
      const currentStatus = statusRef.current;
      if (currentStatus !== "playing" && currentStatus !== "finishing") return;

      if (lastTickRef.current === null) {
        lastTickRef.current = timestamp;
      }

      const deltaMs = Math.min(timestamp - lastTickRef.current, 32);
      lastTickRef.current = timestamp;
      const deltaSeconds = deltaMs / 1000;

      const current = stateRef.current;
      const runner = runnerRef.current;

      let nextTimeLeftMs = current.timeLeftMs;
      let nextDistance = current.distance;
      let nextLives = current.lives;
      let nextResolvedObstacles = current.resolvedObstacles;
      let nextFinishProgress = current.finishProgress;
      let nextFeedback = feedbackRef.current;
      let nextStatus: QueueDashStatus = currentStatus;

      runner.jumpBufferMs = Math.max(0, runner.jumpBufferMs - deltaMs);
      runner.jumpHangMs = Math.max(0, runner.jumpHangMs - deltaMs);
      runner.coyoteMs = runner.grounded ? COYOTE_MS : Math.max(0, runner.coyoteMs - deltaMs);

      if (currentStatus === "playing") {
        nextTimeLeftMs = Math.max(0, current.timeLeftMs - deltaMs);
        nextDistance = Math.min(TARGET_DISTANCE, current.distance + DISTANCE_SPEED * deltaSeconds);
      } else {
        nextFinishProgress = Math.min(1, current.finishProgress + FINISH_SPEED * deltaSeconds);
      }

      if (runner.jumpBufferMs > 0 && (runner.grounded || runner.coyoteMs > 0)) {
        runner.velocityY = JUMP_VELOCITY;
        runner.y = Math.max(runner.y, 2);
        runner.grounded = false;
        runner.coyoteMs = 0;
        runner.jumpBufferMs = 0;
        runner.jumpHangMs = JUMP_HANG_MS;
        nextFeedback = holdFeedback(
          "Nice takeoff. Keep that rhythm and clear the next obstacle on the way up.",
          timestamp + FEEDBACK_HOLD_MS,
        );
      }

      const gravity =
        runner.velocityY > 0
          ? runner.jumpHangMs > 0
            ? HANG_GRAVITY
            : RISE_GRAVITY
          : FALL_GRAVITY;
      runner.velocityY -= gravity * deltaSeconds;
      runner.y = Math.max(0, runner.y + runner.velocityY * deltaSeconds);

      if (runner.y <= 0) {
        runner.y = 0;
        runner.velocityY = 0;
        runner.grounded = true;
        runner.coyoteMs = COYOTE_MS;
      } else {
        runner.grounded = false;
      }

      let nextObstacles = current.obstacles;

      if (currentStatus === "playing" && nextTimeLeftMs > 0 && spawnRef.current.obstacleId < TOTAL_OBSTACLES) {
        if (nextDistance >= spawnRef.current.nextDistance) {
          spawnRef.current.obstacleId += 1;
          const nextObstacle = createObstacle(spawnRef.current.obstacleId, spawnRef.current.lastSpawnX);
          spawnRef.current.lastSpawnX = nextObstacle.x;
          nextObstacles = [...nextObstacles, nextObstacle];
          spawnRef.current.nextDistance += randomBetween(MIN_SPAWN_DISTANCE, MAX_SPAWN_DISTANCE);
        }
      }

      nextObstacles = nextObstacles
        .map((obstacle) => ({
          ...obstacle,
          x: obstacle.x - (currentStatus === "finishing" ? RUN_SPEED * 1.45 : RUN_SPEED) * deltaSeconds,
        }))
        .filter((obstacle) => obstacle.x + obstacle.spec.width > -80);

      if (currentStatus === "playing") {
        const airborneShift = runner.y > 18 ? 6 : 0;
        const capyLeft = CAPY_X + CAPY_HITBOX.left + airborneShift;
        const capyRight = CAPY_X + CAPY_HITBOX.right + airborneShift;
        const capyBottom = runner.y + CAPY_HITBOX.bottom;
        const capyTop = runner.y + CAPY_HITBOX.top;

        nextObstacles = nextObstacles.flatMap((obstacle) => {
          const hit = obstacle.spec.hitbox;
          const obstacleLeft = obstacle.x + hit.left + OBSTACLE_EDGE_FORGIVENESS;
          const obstacleRight = obstacle.x + hit.right - OBSTACLE_EDGE_FORGIVENESS;
          const obstacleBottom = hit.bottom + 2;
          const obstacleTop = hit.top - 2;

          const colliding =
            !obstacle.cleared &&
            obstacleLeft < capyRight &&
            obstacleRight > capyLeft &&
            obstacleBottom < capyTop &&
            obstacleTop > capyBottom;

          if (colliding) {
            const remainingLives = nextLives - 1;
            nextLives = remainingLives;
            nextResolvedObstacles += 1;
            nextFeedback = holdFeedback(
              runner.y < 34
                ? `${obstacle.spec.label} clipped the lane. Jump a touch earlier on the next pass.`
                : `${obstacle.spec.label} caught Capy on the way down. Jump earlier and finish the arc above it.`,
              timestamp + FEEDBACK_HOLD_MS,
            );
            return remainingLives <= 0 ? [obstacle] : [];
          }

          if (!obstacle.cleared && obstacle.x + obstacle.spec.width < CAPY_X - 8) {
            nextResolvedObstacles += 1;
            nextFeedback = holdFeedback(`Clean clear. ${obstacle.spec.coaching}`, timestamp + FEEDBACK_HOLD_MS);
            return [{ ...obstacle, cleared: true }];
          }

          return [obstacle];
        });
      }

      if (nextLives <= 0) {
        nextStatus = "lost";
        nextFeedback = holdFeedback(
          "The lane closed in on this run. Reset, jump a little earlier, and keep your timing compact.",
          Number.POSITIVE_INFINITY,
        );
      } else if (currentStatus === "playing" && nextDistance >= TARGET_DISTANCE) {
        nextObstacles = [];
        pauseAudio(backgroundAudioRef.current, true);

        if (nextResolvedObstacles >= TOTAL_OBSTACLES) {
          nextStatus = "won";
          nextFinishProgress = 1;
          nextFeedback = holdFeedback(
            "Capy reached the front desk with a clean finish and perfect lane control.",
            Number.POSITIVE_INFINITY,
          );
        } else {
          nextStatus = "finishing";
          nextFeedback = holdFeedback(
            "Final stretch. The lane is clear, so bring Capy home to the front desk.",
            Number.POSITIVE_INFINITY,
          );
        }
      } else if (currentStatus === "playing" && nextTimeLeftMs <= 0) {
        nextStatus = "lost";
        nextFeedback = holdFeedback(
          "The desk closed before the finish. The next run just needs a steadier, earlier jump rhythm.",
          Number.POSITIVE_INFINITY,
        );
      } else if (currentStatus === "finishing" && nextFinishProgress >= 1) {
        nextStatus = "won";
        nextFeedback = holdFeedback(
          "Capy reached the front desk with a clean finish and perfect lane control.",
          Number.POSITIVE_INFINITY,
        );
      } else if (nextStatus === "playing" && timestamp >= feedbackUntilRef.current) {
        const upcomingObstacle = nextObstacles.find((obstacle) => !obstacle.cleared) ?? null;

        if (!upcomingObstacle) {
          nextFeedback = "Lane looks clean. Stay light on the timing and be ready for the next queue problem.";
        } else {
          const distanceToObstacle = upcomingObstacle.x - CAPY_X;

          if (distanceToObstacle <= 72) {
            nextFeedback = `${upcomingObstacle.spec.label} is at the lane edge. Jump now.`;
          } else if (distanceToObstacle <= 180) {
            nextFeedback = `${upcomingObstacle.spec.label} is almost at Capy. Get ready to jump.`;
          } else {
            nextFeedback = `${upcomingObstacle.spec.label} is coming up. Stay ready and keep the rhythm smooth.`;
          }
        }
      }

      if (nextStatus === "lost") {
        stopAllAudio(true);
        playAudio(gameOverAudioRef.current, { volume: 0.55 });
      }

      if (nextStatus === "finishing" && currentStatus !== "finishing") {
        finishCuePlayedRef.current = false;
      }

      if (nextStatus === "won") {
        stopAllAudio(true);
        playAudio(startFinishAudioRef.current, { volume: 0.46 });
      }

      if (currentStatus === "finishing" && !finishCuePlayedRef.current && nextFinishProgress > 0.35) {
        finishCuePlayedRef.current = true;
      }

      const runnerTilt = runner.grounded
        ? 0
        : Math.max(-8, Math.min(10, runner.velocityY > 0 ? -8 : 10));

      if (nextStatus !== currentStatus) {
        statusRef.current = nextStatus;
      }

      syncRender({
        status: nextStatus,
        timeLeftMs: nextTimeLeftMs,
        distance: nextDistance,
        lives: Math.max(nextLives, 0),
        resolvedObstacles: Math.min(nextResolvedObstacles, TOTAL_OBSTACLES),
        runnerY: runner.y,
        runnerTilt,
        finishProgress: nextFinishProgress,
        obstacles: nextObstacles,
        feedback: nextFeedback,
      });

      if (nextStatus === "playing" || nextStatus === "finishing") {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isOpen, renderState.status]);

  const hearts = Array.from({ length: MAX_LIVES }, (_, index) => index < renderState.lives);
  const visibleObstacles = renderState.obstacles.filter((obstacle) => obstacle.x + obstacle.spec.width > 0);
  const nextObstacle = visibleObstacles.find((obstacle) => !obstacle.cleared) ?? null;
  const obstacleCount = Math.max(0, TOTAL_OBSTACLES - renderState.resolvedObstacles);
  const progressPercent = clampPercent((renderState.distance / TARGET_DISTANCE) * 100);
  const deskShift = renderState.finishProgress * FRONT_DESK_FINAL_SHIFT;
  const runnerShift = renderState.finishProgress * (FRONT_DESK_FINAL_SHIFT - 24);
  const runnerTransform = `translate3d(${runnerShift}px, ${-renderState.runnerY}px, 0) rotate(${renderState.runnerTilt}deg)`;
  const timeLeftSeconds = formatSeconds(renderState.timeLeftMs);
  const distanceRemaining = Math.max(0, TARGET_DISTANCE - Math.round(renderState.distance));
  const isIntro = renderState.status === "intro";
  const isPlaying = renderState.status === "playing";
  const isFinishing = renderState.status === "finishing";
  const isWon = renderState.status === "won";
  const isLost = renderState.status === "lost";
  const displayObstacleCount = isIntro ? TOTAL_OBSTACLES : isPlaying ? obstacleCount : 0;
  const obstacleLabel = displayObstacleCount === 1 ? "obstacle" : "obstacles";
  const activeFeedback = renderState.feedback;
  const nextObstacleHint = nextObstacle && isPlaying ? formatObstacleHint(nextObstacle.spec.label, nextObstacle.spec.coaching) : "";

  if (!activeGame) return null;

  return (
    <div className="queue-dash-backdrop" role="dialog" aria-modal="true" aria-label="Queue Sprint easter egg">
      <div className="queue-dash-shell queue-sprint-shell">
        <div className="queue-sprint-topbar">
          <div className="queue-sprint-header-copy">
            <div className="queue-sprint-title-row">
              <div className="queue-dash-kicker">Priority Override</div>
              <div className="queue-sprint-status-chip">{TRIGGER_LABELS[activeGame.source]}</div>
            </div>
            <div className="queue-sprint-heading-row">
              <h2 className="queue-dash-title">Queue Sprint</h2>
              <p className="queue-sprint-tagline">Clean jumps. Clear lanes. Finish at the Front Office.</p>
            </div>
          </div>
          <div className="queue-dash-header-actions queue-sprint-toolbar">
            <button
              className="queue-dash-sound-toggle"
              onClick={() => setMuted((current) => !current)}
              type="button"
              aria-label={muted ? "Unmute Queue Sprint audio" : "Mute Queue Sprint audio"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button className="queue-dash-close" onClick={handleClose} type="button" aria-label="Close Queue Sprint">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="queue-sprint-hud-band">
          <div className="queue-sprint-hud">
            <div className="queue-sprint-hud-card">
              <Clock3 className="h-4 w-4" />
              <span>{timeLeftSeconds}s</span>
            </div>
            <div className="queue-sprint-hud-card">
              <Trophy className="h-4 w-4" />
              <span>{distanceRemaining}m to finish</span>
            </div>
            <div className="queue-sprint-hud-card">
              <Heart className="h-4 w-4" />
              <span>{renderState.lives}/{MAX_LIVES} hearts</span>
            </div>
            <div className="queue-sprint-hud-card queue-sprint-hud-card-eta">
              <Sparkles className="h-4 w-4" />
              <span>{displayObstacleCount} {obstacleLabel} ahead</span>
            </div>
          </div>

          <div className="queue-sprint-progress-wrap">
            <div className="queue-dash-progress-rail">
              <div className="queue-dash-progress-checks" aria-hidden="true">
                <span className="queue-dash-progress-check is-complete" />
                <span className={`queue-dash-progress-check ${progressPercent >= 33 ? "is-complete" : ""}`} />
                <span className={`queue-dash-progress-check ${progressPercent >= 66 ? "is-complete" : ""}`} />
                <span className={`queue-dash-progress-check ${progressPercent >= 100 ? "is-complete" : ""}`} />
              </div>
              <div className="queue-dash-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        <div className="queue-dash-stage queue-sprint-stage">
          <div className="queue-dash-runner-world queue-sprint-world">
            <div className="queue-dash-world-glow" aria-hidden="true" />
            <div className="queue-sprint-parallax queue-sprint-parallax-back" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="queue-sprint-parallax queue-sprint-parallax-mid" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="queue-sprint-ceiling" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            {renderState.status === "finishing" || renderState.status === "won" ? (
              <div
                className={`queue-sprint-desk ${renderState.status === "finishing" || renderState.status === "won" ? "is-arriving" : ""}`}
                style={{ transform: `translateX(${-deskShift}px)` }}
                aria-hidden="true"
              >
                <div className="queue-sprint-office-loader" />
                <div className="queue-sprint-desk-label">Front Office</div>
              </div>
            ) : null}

            <div className="queue-sprint-floor-lines" aria-hidden="true">
              <div className="queue-sprint-floor-lines-track">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className={`queue-sprint-runner ${runnerRef.current.grounded ? "is-grounded" : "is-airborne"}`} style={{ transform: runnerTransform }}>
              <div className="capybaraloader">
                <div className="capybara">
                  <div className="capy">
                    <div className="capyleg">
                      <div className="capyleg2" />
                      <div className="capyleg2" />
                    </div>
                    <div className="capyhead">
                      <div className="capyear">
                        <div className="capyear2" />
                      </div>
                      <div className="capyear">
                        <div className="capyear2" />
                      </div>
                      {isLost ? (
                        <div className="queue-sprint-loss-loader queue-sprint-loss-loader-head" aria-hidden="true">
                          <svg viewBox="0 0 120 48" role="presentation">
                            <path
                              className="queue-sprint-loss-star"
                              d="M16 3l3.2 7.6L27 12l-6 5.2L22.7 25 16 20.9 9.3 25 11 17.2 5 12l7.8-1.4L16 3z"
                            />
                            <path
                              className="queue-sprint-loss-star queue-sprint-loss-star-2"
                              d="M52 11l2.6 6.1L61 18.2l-5 4.3L57.2 29 52 25.8 46.8 29 48 22.5l-5-4.3 6.4-1.1L52 11z"
                            />
                            <path
                              className="queue-sprint-loss-star queue-sprint-loss-star-3"
                              d="M82 15l2.2 5.1L90 21l-4.4 3.8 1 5.6L82 27.6l-4.6 2.8 1-5.6L74 21l5.8-.9L82 15z"
                            />
                          </svg>
                        </div>
                      ) : null}
                      <div className="capyeye" />
                      <div className="capyeye" />
                      <div className="capymouth">
                        <div className="capylips" />
                        <div className="capylips" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="queue-sprint-runner-shadow" aria-hidden="true" />
            </div>

            {isWon ? (
              <>
                <div className="queue-sprint-win-signature" aria-hidden="true">
                  <div className="queue-sprint-win-signature-label">Lead Developer:</div>
                  <div className="queue-sprint-win-signature-name">Xander</div>
                  <div className="queue-sprint-win-signature-note">"A quiet signature waiting at the front of the line."</div>
                </div>
                <div className="queue-sprint-win-celebration" aria-hidden="true">
                  <div className="queue-sprint-win-trophy-title">Queue Cleared</div>
                  <div className="queue-sprint-win-trophy-title">Front Office reached.</div>
                  <div className="queue-sprint-win-trophy">
                    <div className="queue-sprint-win-trophy-star queue-sprint-win-trophy-star-back" />
                    <div className="queue-sprint-win-trophy-core">
                      <Trophy className="queue-sprint-win-trophy-icon" />
                    </div>
                  </div>
                  <div className="queue-sprint-win-trophy-copy">
                    {Math.round(renderState.distance)}m cleared {renderState.lives}/{MAX_LIVES} hearts left {timeLeftSeconds}s remaining
                  </div>
                  <div className="queue-sprint-win-actions">
                    <Button className="site-primary-button" onClick={handleClose}>
                      Exit
                    </Button>
                    <Button variant="outline" onClick={beginRun}>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Run again
                    </Button>
                  </div>
                </div>
              </>
            ) : null}

            {visibleObstacles.map((obstacle) => {
              const isNext = nextObstacle?.id === obstacle.id;
              return (
                <div
                  key={obstacle.id}
                  className={`queue-sprint-obstacle is-${obstacle.spec.kind} ${isNext ? "is-next" : ""} ${obstacle.cleared ? "is-cleared" : ""}`}
                  style={{
                    transform: `translate3d(${obstacle.x}px, 0, 0)`,
                    width: obstacle.spec.width,
                    height: obstacle.spec.height,
                    bottom: FLOOR_HEIGHT,
                  }}
                  aria-label={obstacle.spec.label}
                >
                  <span className="queue-sprint-obstacle-shadow" />
                  {obstacle.spec.kind === "stanchion" ? (
                    <div className="queue-sprint-cloud-wrapper" aria-hidden="true">
                      <div className="queue-sprint-cloud">
                        <div className="queue-sprint-cloud-left" />
                        <div className="queue-sprint-cloud-right" />
                      </div>
                      <div className="queue-sprint-rain">
                        <span className="queue-sprint-drop" />
                        <span className="queue-sprint-drop" />
                        <span className="queue-sprint-drop" />
                        <span className="queue-sprint-drop" />
                        <span className="queue-sprint-drop" />
                      </div>
                      <div className="queue-sprint-surface">
                        <span className="queue-sprint-hit" />
                        <span className="queue-sprint-hit" />
                        <span className="queue-sprint-hit" />
                        <span className="queue-sprint-hit" />
                        <span className="queue-sprint-hit" />
                      </div>
                    </div>
                  ) : null}
                  {obstacle.spec.kind === "closed" ? (
                    <>
                      <span className="queue-sprint-sign-stick" />
                      <span className="queue-sprint-sign-face">Closed</span>
                    </>
                  ) : null}
                  {obstacle.spec.kind === "ticket" ? (
                    <div className="queue-sprint-hourglass-loader" aria-hidden="true" />
                  ) : null}
                  {obstacle.spec.kind === "cone" ? (
                    <div className="queue-sprint-fire" aria-hidden="true">
                      <div className="queue-sprint-fire-center">
                        <div className="queue-sprint-fire-main" />
                        <div className="queue-sprint-fire-particle" />
                      </div>
                      <div className="queue-sprint-fire-right">
                        <div className="queue-sprint-fire-main" />
                        <div className="queue-sprint-fire-particle" />
                      </div>
                      <div className="queue-sprint-fire-left">
                        <div className="queue-sprint-fire-main" />
                        <div className="queue-sprint-fire-particle" />
                      </div>
                      <div className="queue-sprint-fire-bottom">
                        <div className="queue-sprint-fire-main" />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {(isPlaying || isFinishing) && activeFeedback ? (
              <div className="queue-sprint-subtitle queue-sprint-subtitle-primary" aria-live="polite">
                {activeFeedback}
              </div>
            ) : null}

            {(isPlaying || isFinishing) && nextObstacleHint ? (
              <div className="queue-sprint-subtitle queue-sprint-subtitle-secondary" aria-live="polite">
                <span className="queue-sprint-subtitle-label">Next up</span>
                <span>{nextObstacleHint}</span>
              </div>
            ) : null}

            {isIntro ? (
              <div className="queue-sprint-overlay">
                <div className="queue-sprint-panel queue-sprint-overlay-card queue-sprint-overlay-card-intro">
                  <div className="queue-sprint-overlay-kicker">Runner Brief</div>
                  <div className="queue-dash-panel-title">Capy is lined up for a premium-lane sprint.</div>
                  <div className="queue-dash-panel-copy">
                    Press <strong>Space</strong>, <strong>W</strong>, <strong>Up</strong>, or tap <strong>Jump</strong>
                    just before each queue obstacle reaches Capy.
                  </div>
                  <div className="queue-sprint-control-list">
                    <div className="queue-sprint-control-item">
                      <span className="queue-dash-keycap">Space</span>
                      <span>Main jump</span>
                    </div>
                    <div className="queue-sprint-control-item">
                      <span className="queue-dash-keycap">W / Up</span>
                      <span>Alt jump</span>
                    </div>
                    <div className="queue-sprint-control-item">
                      <span className="queue-dash-keycap">Tap</span>
                      <span>Mobile jump</span>
                    </div>
                  </div>
                  <div className="queue-dash-actions queue-sprint-overlay-actions">
                    <Button className="site-primary-button" onClick={beginRun}>
                      Start Queue Sprint
                    </Button>
                    <Button variant="outline" onClick={handleClose}>
                      Back
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {isPlaying || isFinishing ? (
              <div className="queue-sprint-live-controls">
                <div className="queue-dash-hearts queue-sprint-live-hearts" aria-label="Remaining hearts">
                  {hearts.map((filled, index) => (
                    <span key={index} className={`queue-dash-heart queue-sprint-live-heart ${filled ? "is-filled" : ""}`}>
                      <Heart className="h-4 w-4" />
                    </span>
                  ))}
                </div>
                <div className="queue-dash-mobile-controls queue-sprint-mobile-controls">
                  <Button className="queue-dash-jump-button site-primary-button" onClick={queueJump}>
                    Jump
                  </Button>
                </div>
              </div>
            ) : null}

            {isLost ? (
              <div className="queue-sprint-overlay">
                <div className="queue-sprint-panel queue-sprint-overlay-card queue-sprint-overlay-card-result">
                  <div className="queue-sprint-overlay-kicker">Run Interrupted</div>
                  <div className="queue-dash-panel-title">The lane tightened up this round.</div>
                  <div className="queue-dash-panel-copy">
                    Reset the rhythm, jump a touch earlier, and use the checkpoint bar to pace the next sprint.
                  </div>
                  <div className="queue-dash-actions queue-sprint-overlay-actions">
                    <Button className="site-primary-button" onClick={beginRun}>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Retry sprint
                    </Button>
                    <Button variant="outline" onClick={handleClose}>
                      Exit
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="queue-sprint-floor" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
