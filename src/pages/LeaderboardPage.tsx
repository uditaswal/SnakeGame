import { useEffect, useState } from "react";
import { getLeaderboard, type LeaderboardEntry } from "../lib/leaderboard";
import { usePageMeta } from "../lib/page-meta";

export function LeaderboardPage() {
  usePageMeta("Leaderboard", "Public personal best scores from Snake players.");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getLeaderboard()
      .then(({ entries: nextEntries }) => setEntries(nextEntries))
      .catch(() => setError("The leaderboard is unavailable right now."));
  }, []);

  return (
    <section className="leaderboard-page">
      <header>
        <h1>Leaderboard</h1>
        <p>Personal best scores from signed-in players.</p>
      </header>
      {error ? (
        <p className="form-message form-message--error" role="alert">
          {error}
        </p>
      ) : null}
      {!entries && !error ? (
        <p className="leaderboard-loading">Loading scores…</p>
      ) : null}
      {entries?.length === 0 ? (
        <p className="leaderboard-empty">
          No verified scores yet. Be the first to play.
        </p>
      ) : null}
      {entries?.length ? (
        <ol className="leaderboard-list">
          {entries.map((entry) => (
            <li key={`${entry.rank}-${entry.username}`}>
              <span className="leaderboard-rank">{entry.rank}</span>
              <span>{entry.username}</span>
              <strong>{entry.score}</strong>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
