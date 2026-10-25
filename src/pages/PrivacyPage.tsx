import { usePageMeta } from '../lib/page-meta'

export function PrivacyPage() {
  usePageMeta('Privacy notice', 'How Snake handles account and gameplay data.')

  return (
    <article className="privacy-page">
      <h1>Privacy notice</h1>
      <p>Last updated: October 26, 2026.</p>
      <h2>Account and score data</h2>
      <p>If you create an account, Snake keeps the information needed to run your account and save verified scores. Your username and best score may appear on the public leaderboard. The game does not collect your email address.</p>
      <h2>Cookies and local data</h2>
      <p>Snake uses an essential cookie to keep you signed in. Your browser may also save your personal best and unfinished score submission. The site does not use advertising or analytics cookies.</p>
      <h2>Service providers</h2>
      <p>We use service providers to host and operate the game. They process data only as needed to provide the service.</p>
      <h2>Your choices</h2>
      <p>You can delete your account and published scores from Account settings. You can clear locally saved game data through your browser settings.</p>
      <h2>Contact</h2>
      <p>For a privacy question or deletion issue, contact the site owner through <a href="https://github.com/uditaswal" target="_blank" rel="noreferrer">the project owner’s GitHub profile</a>.</p>
    </article>
  )
}
