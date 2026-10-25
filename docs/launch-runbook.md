# Launch and incident runbook

## Before production

1. Confirm `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm audit --prod`, and `pnpm exec vercel build --prod --yes` pass from the release commit.
2. Run Gitleaks across the complete Git history. Rotate any exposed credential before removing it from history.
3. Apply migrations to a Neon branch copied from production, run the database integration test, and verify account deletion removes the user, sessions, scores, and challenges.
4. Confirm Production has `DATABASE_URL` and `RATE_LIMIT_SECRET`. Set `APP_ORIGIN` when using a custom domain. Never use a `VITE_` prefix for a secret.
5. Verify the production domain, HTTPS redirect, security headers, `robots.txt`, `sitemap.xml`, legal pages, and all account and score flows.
6. Configure an external uptime check and error monitor. Use a test alert to confirm the notification path before launch.
7. Take or confirm a recoverable database snapshot, then perform a restore drill into an isolated branch. Record the restore time and the person who verified it.

## Rollback

1. Stop further releases and preserve logs and the failing deployment URL.
2. Promote the last known-good Vercel deployment or revert the release commit and deploy that exact revision.
3. If a database change caused the incident, prefer a forward repair. Restore from the verified snapshot only when data loss and recovery implications are understood.
4. Re-run the smoke test against the restored production service. Confirm login, score submission, leaderboard reads, and account deletion.
5. Rotate any credential that may have been exposed and invalidate affected sessions.

## First 72 hours

- Watch uptime, function errors, database errors, rate-limit volume, and Core Web Vitals.
- Check Search Console and Bing Webmaster Tools for crawl or sitemap errors.
- Record incidents, mitigations, and follow-up owners without copying secrets or personal data into tickets.
