# Snake migration plan

This document is intentionally local-only and is excluded from Git.

## Current implementation status

- **Tasks 1–2:** complete locally. The legacy multi-page implementation has been removed, and the React foundation plus pure TypeScript engine pass lint, strict type checking, unit tests, and a production build.
- **Task 3:** complete at code and component-test level with a cell-based responsive board, keyboard/swipe/touch input, coarse-pointer controls, safe-area handling, visibility pause, reduced-motion support, and a compact landscape layout. The available in-app browser blocks localhost inspection, so final device screenshot QA remains a deployment-stage check.
- **Task 4:** the code cutover from MongoDB Atlas to Neon Postgres is complete. The official `@neondatabase/serverless` HTTP driver, server-only environment validation, relational schema migration, constraints, cascade rules, lazy expiry cleanup, and query indexes are present. Live migration verification still requires `DATABASE_URL`.
- **Task 5:** the authentication API now uses parameterized Neon SQL while preserving tested Argon2id hashing, hashed opaque sessions, hardened cookies, JSON/origin validation, generic login errors, and database-backed rate limits. Live endpoint integration still requires Neon.
- **Task 6:** score submission keeps backend validation independent from authentication and uses an atomic Postgres statement to consume a challenge and insert its score. Guest challenges, local personal bests, pending-run handoff, engine/run metadata, replay prevention, and plausibility validation remain in place. Live challenge/submission integration still requires Neon.
- **Verification:** 9 test files / 28 tests pass, ESLint and strict TypeScript pass, the Vite production bundle builds, the bundle contains no database URL material, and the production dependency audit reports zero known vulnerabilities.
- **Configuration still required:** fill the pooled Neon `DATABASE_URL` and `RATE_LIMIT_SECRET` in ignored `.env.local`; later provide the production origin before deployment.

## Architecture decisions

- **Frontend:** React 19, TypeScript, Vite, and Tailwind CSS.
- **Hosting:** Vercel for the static frontend and Node.js serverless functions in `api/`; no Express server.
- **Data:** Neon Postgres through the official HTTP serverless driver. Vercel’s integration supplies a pooled `DATABASE_URL` and can create isolated database branches for preview deployments.
- **Authentication:** custom username-and-password authentication. Better Auth's official username plugin still requires an email and name at signup, which conflicts with the no-email requirement.
- **Access model:** anyone can play as a guest; an account is required only to publish and retain a leaderboard score.
- **Privacy:** no email addresses. A production privacy notice will explain account data, score data, public usernames, providers, browser storage/cookies, retention, deletion, and a real contact method.

## Delivery tasks

### 1. React foundation

- Replace the multi-page HTML shell with a Vite React + TypeScript application.
- Configure Tailwind CSS, linting, tests, and Vercel SPA routing.
- Establish a small route and component structure without a large UI framework.
- Preserve the existing game assets while moving browser-served files into `public/`.
- Add accessible, responsive page foundations for home, play, leaderboard, privacy, and account areas.

### 2. Framework-independent game engine

- Move direction, movement, growth, food placement, collision, scoring, and speed rules into pure TypeScript modules.
- Keep DOM, React, audio, timers, and storage outside the engine.
- Make randomness injectable so food placement is deterministic in tests.
- Add unit tests for movement, reverse-direction prevention, growth, wall/self collision, and food placement.
- Define versioned run-state serialization for safe local resume support.

### 3. Responsive game experience

- Build an arcade-specific visual system rather than a generic dashboard theme.
- Use a board that fits the smaller viewport dimension while preserving square cells.
- Support keyboard, swipe, and visible touch controls with 44px minimum targets.
- Handle portrait, landscape, safe areas, reduced motion, pausing on visibility loss, and resize without corrupting a run.
- Ensure score, time, status, and controls remain readable without covering the board.

### 4. Neon Postgres data layer

- Use `@neondatabase/serverless` over HTTP from Vercel serverless functions; no persistent application pool.
- Keep `DATABASE_URL` exclusively in backend environment variables. Never use a `VITE_` prefix, expose it in browser code, or return it from an endpoint.
- Create users, sessions, scores, run-challenges, and rate-limit tables through a checked-in migration.
- Add foreign keys, cascade rules, unique normalized-username/token/challenge constraints, expiry indexes, and leaderboard indexes.
- Use parameterized tagged-template queries and lazy expiry cleanup; Postgres has no Mongo-style TTL index.
- Store only password hashes, never plaintext passwords or recoverable credentials.

### 5. Username/password authentication

- Implement registration, login, logout, session lookup, password change, and account deletion as Vercel functions.
- Validate and normalize usernames, reserve unsafe names, and prevent confusable duplicates where practical.
- Hash passwords with Argon2id using current OWASP-aligned parameters.
- Use opaque, rotated session tokens stored as hashes in Postgres and sent in Secure, HttpOnly, SameSite cookies.
- Add CSRF/origin checks, generic login errors, rate limiting, audit-safe logs, and security headers.
- Clearly disclose that no-email accounts have no email reset path; add recovery codes only as a separately designed feature.

### 6. Trustworthy score submission

- Issue short-lived, single-use run challenges from the server.
- Allow guests to play immediately and retain a local personal best.
- Require login to publish a score; bind submissions to a user, challenge, engine version, and run metadata.
- Enforce plausible duration/score bounds, reject replayed challenges, and rate-limit submissions.
- Treat authentication only as player identity. Always validate score legitimacy in the backend before writing it.
- Consume a challenge and insert its score atomically so a failed insert cannot burn a valid challenge.
- Treat client validation as abuse friction, not cheat-proof authority, and label the leaderboard accordingly.

### 7. Leaderboard and player dashboard

- Publish a paginated leaderboard with rank, public username, score, and achieved date.
- Add signed-in views for personal best, recent runs, rank, password change, sessions, and account deletion.
- Design explicit loading, empty, error, signed-out, and stale-session states.
- Keep private account data out of public responses.

### 8. Privacy notice and consent surfaces

- Publish a permanent `/privacy/` page linked from every public page and registration.
- State exactly what is stored: username, password hash, user/session IDs, timestamps, scores, run metadata, and limited abuse/security logs.
- Identify public fields: username, score, rank, and score date.
- Name Vercel and Neon and link to their privacy information.
- Explain essential session cookies, local game storage, retention windows, account/score deletion, anonymization rules, and the no-email recovery limitation.
- Add an effective date and a real privacy contact supplied by the owner before launch.

### 9. SEO and shareability

- Pre-render the home, leaderboard, and privacy routes; keep the account dashboard `noindex`.
- Add unique titles/descriptions, canonical URLs, Open Graph/Twitter cards, sitemap, robots rules, favicon/manifest, and crawlable semantic copy.
- Add accurate `VideoGame`/`WebApplication` structured data only for facts present on the site.
- Keep primary content in HTML rather than canvas-only output and maintain heading/link semantics.
- Validate with Lighthouse, rich-results tooling, and Google Search Console after the production domain is known.

### 10. Verification and deployment

- Run unit, component, API integration, accessibility, and end-to-end tests.
- Verify desktop and mobile layouts, keyboard-only use, touch use, reduced motion, slow networks, and supported browsers.
- Connect the Neon/Vercel integration, enable preview database branches, set production variables and secrets, run migrations, and configure deployment protections.
- Add CI gates for type checking, linting, tests, production build, and dependency/security review.
- Document local setup, environment variables, deployment, data deletion operations, and rollback.

## Visual quality guardrails

- Keep the game itself as the visual focus; supporting UI should recede.
- Avoid generic purple gradients, decorative glass, repetitive card grids, excessive pills, fake metrics, and placeholder marketing copy.
- Use a distinctive arcade display face paired with a highly readable UI face, deliberate spacing, and one purposeful motion language.
- Use consistent authored icons, visible focus states, sufficient contrast, touch-sized controls, and responsive typography.
- Prefer game-specific language and real states over generic dashboard labels.

## Launch inputs still needed

- Production domain for canonical metadata and allowed origins.
- A public contact method for the privacy notice.
- Final retention periods for sessions, security logs, deleted-account scores, and inactive accounts.
- A Neon project connected to Vercel, plus its pooled local development `DATABASE_URL`.

## Neon cutover checklist

1. Create Neon Postgres through Vercel Storage in the same region as the serverless functions.
2. Connect Development, Preview, and Production environments; keep the injected `DATABASE_URL` server-only.
3. Enable a Neon database branch for each Vercel Preview Deployment so schema and test data stay isolated.
4. Pull the development environment locally without copying credentials into chat.
5. Run `npm run db:migrate`; it prefers `DATABASE_URL_UNPOOLED` when Vercel provides it and otherwise uses `DATABASE_URL`.
6. Run live integration tests for registration, login, session rotation, deletion cascades, challenge replay prevention, and atomic score submission.
7. Set the production `APP_ORIGIN`, generate a production `RATE_LIMIT_SECRET`, deploy, and repeat the migration/integration checks against the production branch.

