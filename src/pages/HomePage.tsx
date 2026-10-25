import { Link } from "react-router-dom";
import { usePageMeta } from "../lib/page-meta";

const previewSnake = [
  [4, 8],
  [5, 8],
  [6, 8],
  [7, 8],
  [7, 7],
  [7, 6],
  [8, 6],
];

export function HomePage() {
  usePageMeta(
    "Snake",
    "Play classic Snake in your browser with keyboard, touch, and a verified public leaderboard.",
  );
  return (
    <section className="home-grid">
      <div className="home-copy">
        <h1>Classic Snake Game</h1>
        <div className="home-actions">
          <Link className="primary-action" to="/play">
            Play
          </Link>
        </div>
        <dl className="controls-list">
          <div>
            <dt>Move</dt>
            <dd>Arrow keys, WASD or swipe</dd>
          </div>
          <div>
            <dt>Pause</dt>
            <dd>Space bar</dd>
          </div>
        </dl>
      </div>

      <div
        className="game-preview"
        aria-label="Illustrative preview of the Snake game board"
      >
        <div className="preview-stats">
          <span>
            <small>Score</small>
            <strong>07</strong>
          </span>
          <span aria-hidden="true" />
          <span>
            <small>Time</small>
            <strong>00:42</strong>
          </span>
        </div>
        <div className="preview-grid" aria-hidden="true">
          {previewSnake.map(([x, y], index) => (
            <i
              key={`${x}-${y}`}
              className={
                index === previewSnake.length - 1
                  ? "preview-head"
                  : "preview-segment"
              }
              style={{ gridColumn: x, gridRow: y }}
            />
          ))}
          <i className="preview-food" style={{ gridColumn: 12, gridRow: 4 }} />
        </div>
      </div>
    </section>
  );
}
