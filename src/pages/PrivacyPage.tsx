import { usePageMeta } from '../lib/page-meta'

export function PrivacyPage() {
  usePageMeta('Privacy notice', 'How Snake handles account, score, cookie, and browser-storage data.')

  return (
    <article className="privacy-page">
      <h1>Privacy notice</h1>
      <p>Last updated: October 25, 2026.</p>
      <h2>What this game stores</h2>
      <p>If you create an account, this game stores your username, a password hash, account creation/update timestamps, hashed session tokens, and verified score records. It does not collect email addresses.</p>
      <h2>What is public</h2>
      <p>Your username and your best score may appear on the public leaderboard. Password hashes, session records, rate-limit identifiers, and game challenge tokens are not public.</p>
      <h2>Cookies and browser storage</h2>
      <p>An HttpOnly session cookie keeps you signed in; it is marked Secure on the production HTTPS site. The game also uses browser storage for a local personal best and a short-lived pending score submission. You can clear this storage in your browser settings. The site does not use advertising or analytics cookies, so there are no non-essential cookies to accept.</p>
      <h2>Service providers</h2>
      <p>Vercel hosts the site and its API. Neon Postgres stores account and score data. Google Fonts serves the two typefaces used by the site, so your browser may send Google your IP address and standard request information when it loads them.</p>
      <h2>Retention and deletion</h2>
      <p>Account and score data remain until you delete your account in Account settings. Deleting the account removes its scores, sessions, and associated game challenges. Sessions expire after 30 days. Unused game challenges expire after two hours, and rate-limit counters within two hours; expired records are removed during later service requests.</p>
      <h2>Contact</h2>
      <p>For a privacy question or deletion issue, contact the site owner through <a href="https://github.com/uditaswal" target="_blank" rel="noreferrer">the project owner’s GitHub profile</a>.</p>
    </article>
  )
}
