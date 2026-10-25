import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import {
  createGame,
  createSeededRandom,
  getTickDelay,
  pauseGame,
  queueDirection,
  startGame,
  stepGame,
  type Direction,
  type GameConfig,
  type GameState,
  type RandomSource,
} from "../game/engine";
import { gameConfigForBoard, sameGeometry } from "../game/geometry";
import {
  parseRun,
  RUN_STORAGE_KEY,
  serializeRun,
  type GameCheckpoint,
} from "../game/persistence";
import { usePageMeta } from "../lib/page-meta";
import { getSession } from "../lib/auth";
import {
  requestRunChallenge,
  storePendingRun,
  submitPendingRun,
  type MoveEvent,
  type RunChallenge,
} from "../lib/run-api";

const PERSONAL_BEST_KEY = "snake.personal-best.v1";

function readPersonalBest(): number {
  try {
    return (
      Number.parseInt(localStorage.getItem(PERSONAL_BEST_KEY) || "0", 10) || 0
    );
  } catch {
    return 0;
  }
}

function writePersonalBest(score: number): void {
  try {
    localStorage.setItem(PERSONAL_BEST_KEY, String(score));
  } catch {
    // A storage restriction should not stop a run.
  }
}

const keyDirections: Record<string, Direction> = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
};

export function PlayPage() {
  usePageMeta(
    "Play",
    "Play classic Snake with keyboard, touch, or swipe controls.",
  );
  const [checkpoint] = useState(loadCheckpoint);
  const [config, setConfig] = useState<GameConfig>(
    () => checkpoint?.config ?? createGameConfig(),
  );
  const [game, setGame] = useState<GameState>(() =>
    checkpoint ? resumeState(checkpoint.state) : createGame(config),
  );
  const [elapsedMs, setElapsedMs] = useState(() => checkpoint?.elapsedMs ?? 0);
  const [personalBest, setPersonalBest] = useState(readPersonalBest);
  const [saveState, setSaveState] = useState<
    "idle" | "guest" | "ready" | "saving" | "saved" | "error"
  >("idle");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const challenge = useRef<RunChallenge | null>(checkpoint?.challenge ?? null);
  const moves = useRef<MoveEvent[]>(checkpoint?.moves ?? []);
  const runGeneration = useRef(0);
  const gameRef = useRef(game);
  gameRef.current = game;
  const randomRef = useRef<RandomSource>(randomForCheckpoint(checkpoint));
  const storedRunTick = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [geometryNotice, setGeometryNotice] = useState("");
  const [geometryReady, setGeometryReady] = useState(false);
  const pendingChallenge = useRef<{
    columns: number;
    rows: number;
    promise: Promise<RunChallenge>;
  } | null>(null);

  const getRunChallenge = useCallback((columns: number, rows: number) => {
    const pending = pendingChallenge.current;
    if (pending?.columns === columns && pending.rows === rows) {
      return pending.promise;
    }
    const entry = {
      columns,
      rows,
      promise: requestRunChallenge(columns, rows),
    };
    pendingChallenge.current = entry;
    void entry.promise.catch(() => {
      if (pendingChallenge.current === entry) pendingChallenge.current = null;
    });
    return entry.promise;
  }, []);

  // Start the challenge after the board has been measured. Most players can
  // then press Play without waiting for a cold backend to start.
  useEffect(() => {
    if (!geometryReady || game.status !== "ready") return;
    void getRunChallenge(config.columns, config.rows).catch(() => {});
  }, [config.columns, config.rows, game.status, geometryReady, getRunChallenge]);

  const startNewGame = useCallback(async () => {
    const generation = ++runGeneration.current;
    setGeometryNotice("Preparing board…");
    try {
      const nextChallenge = await getRunChallenge(config.columns, config.rows);
      if (generation !== runGeneration.current) return;
      pendingChallenge.current = null;
      challenge.current = nextChallenge;
      const random = createSeededRandom(nextChallenge.seed);
      randomRef.current = random;
      moves.current = [];
      storedRunTick.current = null;
      setElapsedMs(0);
      setSaveState("idle");
      setGame(startGame(createGame(config, random)));
      clearCheckpoint();
      setGeometryNotice("");
    } catch {
      if (generation !== runGeneration.current) return;
      challenge.current = null;
      const random = createSeededRandom(createLocalSeed());
      randomRef.current = random;
      moves.current = [];
      storedRunTick.current = null;
      setElapsedMs(0);
      setSaveState("idle");
      setGame(startGame(createGame(config, random)));
      setGeometryNotice(
        "Playing locally. This game's score cannot be published to the leaderboard.",
      );
    }
  }, [config, getRunChallenge]);

  const turn = useCallback((direction: Direction) => {
    const current = gameRef.current;
    const next = queueDirection(current, direction);
    if (
      current.status === "running" &&
      next.queuedDirection !== current.queuedDirection
    ) {
      moves.current.push({
        tick: current.ticks,
        direction: next.queuedDirection,
      });
    }
    if (next !== current) setGame(next);
  }, []);

  const restart = useCallback(() => {
    setElapsedMs(0);
    setSaveState("idle");
    void startNewGame();
  }, [startNewGame]);

  const toggle = useCallback(() => {
    const current = gameRef.current;
    if (current.status === "lost" || current.status === "won") {
      restart();
      return;
    }
    if (current.status === "ready") {
      void startNewGame();
      return;
    }
    setGame(
      current.status === "running" ? pauseGame(current) : startGame(current),
    );
  }, [restart, startNewGame]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const updateGeometry = () => {
      const bounds = board.getBoundingClientRect();
      const nextConfig = gameConfigForBoard(bounds.width, bounds.height);
      setGeometryReady(true);
      setConfig((currentConfig) => {
        if (sameGeometry(currentConfig, nextConfig)) return currentConfig;
        setGame((currentGame) => {
          if (currentGame.status === "ready") return createGame(nextConfig);
          setElapsedMs(0);
          runGeneration.current += 1;
          moves.current = [];
          clearCheckpoint();
          setGeometryNotice(
            "The board size changed. Press Play to start again.",
          );
          return createGame(nextConfig);
        });
        return nextConfig;
      });
    };

    updateGeometry();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateGeometry);
      return () => window.removeEventListener("resize", updateGeometry);
    }

    const observer = new ResizeObserver(updateGeometry);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (game.status !== "running") return;
    const delay = getTickDelay(game.score);
    const timer = window.setTimeout(() => {
      setElapsedMs((current) => current + delay);
      setGame((current) => stepGame(current, config, randomRef.current));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [config, game.status, game.score, game.ticks]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isInteractiveTarget(event.target)) return;
      const direction = keyDirections[event.key];
      if (direction) {
        event.preventDefault();
        turn(direction);
      } else if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, turn]);

  useEffect(() => {
    if (game.status !== "running" && game.status !== "paused") return;
    storeCheckpoint({
      state: game,
      config,
      elapsedMs,
      challenge: challenge.current,
      moves: moves.current,
    });
  }, [config, elapsedMs, game]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setGame((current) => pauseGame(current));
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    if (!stageRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    try {
      await stageRef.current.requestFullscreen();
    } catch {
      setGeometryNotice("Fullscreen is unavailable in this browser.");
    }
  }

  useEffect(() => {
    if (game.status !== "lost" && game.status !== "won") return;
    if (storedRunTick.current === game.ticks) return;
    storedRunTick.current = game.ticks;
    clearCheckpoint();

    if (game.score > personalBest) {
      setPersonalBest(game.score);
      writePersonalBest(game.score);
    }
    if (game.score === 0) {
      setSaveState("idle");
      return;
    }
    if (!challenge.current) {
      setSaveState("error");
      return;
    }
    storePendingRun({
      version: 1,
      challenge: challenge.current.challenge,
      engineVersion: challenge.current.engineVersion,
      expiresAt: challenge.current.expiresAt,
      score: game.score,
      durationMs: elapsedMs,
      ticks: game.ticks,
      columns: config.columns,
      rows: config.rows,
      moves: moves.current,
    });
    getSession()
      .then(({ user }) => setSaveState(user ? "ready" : "guest"))
      .catch(() => setSaveState("guest"));
  }, [
    config.columns,
    config.rows,
    elapsedMs,
    game.score,
    game.status,
    game.ticks,
    personalBest,
  ]);

  async function saveScore() {
    setSaveState("saving");
    try {
      const score = await submitPendingRun();
      if (score === null) {
        setSaveState("error");
        return;
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (totalSeconds % 60).toString().padStart(2, "0");
  const statusLabel =
    game.status === "lost"
      ? "Game over"
      : game.status === "won"
        ? "Board cleared"
        : game.status === "running"
          ? "Playing"
          : game.status === "paused"
            ? "Paused"
            : "Ready";

  return (
    <section className="play-layout">
      <div className="play-heading">
        <div>
          <h1>Classic Snake.</h1>
          <p>Eat the food, avoid the walls and your own tail.</p>
        </div>
        <div className="run-actions">
          <button
            type="button"
            onClick={toggle}
            disabled={game.status === "lost" || game.status === "won"}
          >
            {game.status === "running" ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
            {game.status === "running"
              ? "Pause"
              : game.status === "paused"
                ? "Resume"
                : "Start"}
          </button>
          <button type="button" onClick={restart}>
            <RotateCcw aria-hidden="true" /> Restart
          </button>
          <button
            type="button"
            onClick={() => {
              void toggleFullscreen();
            }}
            aria-label={isFullscreen ? "Exit full screen" : "Play full screen"}
          >
            {isFullscreen ? (
              <Minimize aria-hidden="true" />
            ) : (
              <Maximize aria-hidden="true" />
            )}
            {isFullscreen ? "Exit" : "Full screen"}
          </button>
        </div>
      </div>

      <div
        className={`play-stage${isFullscreen ? " play-stage--fullscreen" : ""}`}
        ref={stageRef}
      >
        <div className="score-strip">
          <span aria-live="polite">
            <small>Score</small>
            <strong>{game.score.toString().padStart(2, "0")}</strong>
          </span>
          <span className={`game-status game-status--${game.status}`}>
            <i /> {statusLabel}
          </span>
          <span>
            <small>Time</small>
            <strong>
              {minutes}:{remainingSeconds}
            </strong>
          </span>
        </div>

        <div
          className="game-board"
          ref={boardRef}
          role="application"
          aria-label="Snake game board"
          aria-describedby="game-instructions"
          tabIndex={0}
          style={
            {
              "--columns": config.columns,
              "--rows": config.rows,
            } as CSSProperties
          }
          onTouchStart={(event) => {
            const touch = event.changedTouches[0];
            touchStart.current = { x: touch.clientX, y: touch.clientY };
          }}
          onTouchEnd={(event) => {
            if (!touchStart.current) return;
            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - touchStart.current.x;
            const deltaY = touch.clientY - touchStart.current.y;
            touchStart.current = null;
            if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;
            turn(
              Math.abs(deltaX) > Math.abs(deltaY)
                ? deltaX > 0
                  ? "right"
                  : "left"
                : deltaY > 0
                  ? "down"
                  : "up",
            );
          }}
        >
          {game.food ? (
            <i
              aria-hidden="true"
              className="food"
              style={cellStyle(game.food, config)}
            />
          ) : null}
          {game.snake.map((segment, index) => (
            <i
              aria-hidden="true"
              className={
                index === 0 ? "snake-cell snake-cell--head" : "snake-cell"
              }
              key={`${index}-${segment.x}-${segment.y}`}
              style={cellStyle(segment, config)}
            />
          ))}
          {game.status !== "running" ? (
            <div className="board-overlay">
              <strong>
                {game.status === "lost"
                  ? "Game over."
                  : game.status === "won"
                    ? "You won."
                    : game.status === "paused"
                      ? "Paused."
                      : "Ready?"}
              </strong>
              <button
                type="button"
                onClick={
                  game.status === "lost" || game.status === "won"
                    ? restart
                    : toggle
                }
              >
                {game.status === "lost" || game.status === "won"
                  ? "Play again"
                  : game.status === "paused"
                    ? "Resume"
                    : "Play"}
              </button>
            </div>
          ) : null}
          {isFullscreen ? (
            <FullscreenControls
              game={game}
              onToggle={toggle}
              onRestart={restart}
              onExit={() => {
                void toggleFullscreen();
              }}
              onTurn={turn}
            />
          ) : null}
        </div>
      </div>

      <div
        className="touch-controls"
        role="group"
        aria-label="Touch direction controls"
      >
        <button
          type="button"
          aria-label="Move up"
          data-direction="up"
          onClick={() => turn("up")}
        >
          <ArrowUp aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Move left"
          data-direction="left"
          onClick={() => turn("left")}
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Move down"
          data-direction="down"
          onClick={() => turn("down")}
        >
          <ArrowDown aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Move right"
          data-direction="right"
          onClick={() => turn("right")}
        >
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
      <div className="run-result" aria-live="polite">
        <span>
          High Score <strong>{personalBest.toString().padStart(2, "0")}</strong>
        </span>
        {saveState === "guest" ? (
          <Link to="/account">
            Sign in or create an account to save the score and compete against
            others.
          </Link>
        ) : null}
        {saveState === "ready" ? (
          <button type="button" onClick={saveScore}>
            Save score to my account
          </button>
        ) : null}
        {saveState === "saving" ? <span>Saving score…</span> : null}
        {saveState === "saved" ? (
          <span className="save-success">Score saved</span>
        ) : null}
        {saveState === "error" ? (
          <span className="save-error">
            {challenge.current
              ? "Could not save this score. Your local best is safe."
              : "This local run cannot be added to the leaderboard."}
            {challenge.current ? (
              <button type="button" onClick={saveScore}>Try again</button>
            ) : null}
          </span>
        ) : null}
      </div>
      {geometryNotice ? (
        <p className="geometry-notice" role="status">
          {geometryNotice}
        </p>
      ) : null}
    </section>
  );
}

function createGameConfig(): GameConfig {
  return gameConfigForBoard(window.innerWidth, window.innerHeight);
}

function cellStyle(
  point: { x: number; y: number },
  config: GameConfig,
): CSSProperties {
  return {
    width: `${100 / config.columns}%`,
    height: `${100 / config.rows}%`,
    left: `${(point.x / config.columns) * 100}%`,
    top: `${(point.y / config.rows) * 100}%`,
  };
}

function randomForCheckpoint(checkpoint: GameCheckpoint | null): RandomSource {
  if (!checkpoint?.challenge) return Math.random;
  const random = createSeededRandom(checkpoint.challenge.seed);
  for (let call = 0; call <= checkpoint.state.score; call += 1) random();
  return random;
}

function loadCheckpoint(): GameCheckpoint | null {
  try {
    const stored = sessionStorage.getItem(RUN_STORAGE_KEY);
    return stored ? parseRun(stored) : null;
  } catch {
    return null;
  }
}

function storeCheckpoint(
  checkpoint: Omit<GameCheckpoint, "version" | "savedAt">,
): void {
  try {
    sessionStorage.setItem(RUN_STORAGE_KEY, serializeRun(checkpoint));
  } catch {
    // Gameplay remains available when session storage is blocked.
  }
}

function clearCheckpoint(): void {
  try {
    sessionStorage.removeItem(RUN_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

function resumeState(state: GameState): GameState {
  return state.status === "running" ? { ...state, status: "paused" } : state;
}

function createLocalSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0];
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        'button, a, input, textarea, select, [contenteditable="true"]',
      ),
    )
  );
}

function FullscreenControls({
  game,
  onToggle,
  onRestart,
  onExit,
  onTurn,
}: {
  game: GameState;
  onToggle: () => void;
  onRestart: () => void;
  onExit: () => void;
  onTurn: (direction: Direction) => void;
}) {
  return (
    <div className="fullscreen-controls" aria-label="Fullscreen game controls">
      <div className="fullscreen-actions">
        <button
          type="button"
          onClick={onToggle}
          disabled={game.status === "lost" || game.status === "won"}
        >
          {game.status === "running" ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
          {game.status === "running" ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={onRestart}>
          <RotateCcw aria-hidden="true" />
          Restart
        </button>
        <button type="button" onClick={onExit}>
          <X aria-hidden="true" />
          Exit
        </button>
      </div>
      <div
        className="fullscreen-dpad"
        role="group"
        aria-label="Fullscreen direction controls"
      >
        <button type="button" aria-label="Move up" onClick={() => onTurn("up")}>
          <ArrowUp aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Move left"
          onClick={() => onTurn("left")}
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Move down"
          onClick={() => onTurn("down")}
        >
          <ArrowDown aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Move right"
          onClick={() => onTurn("right")}
        >
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
