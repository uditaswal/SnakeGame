import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/page-meta'

export function TermsPage() {
  usePageMeta('Terms of use', 'The rules for using Snake accounts, gameplay, and the public leaderboard.')

  return (
    <article className="legal-page">
      <h1>Terms of use</h1>
      <p>Last updated: October 26, 2026.</p>

      <h2>Using the game</h2>
      <p>You may play without an account. An account is optional and lets you publish verified scores under a public username. You are responsible for activity in your signed-in session.</p>

      <h2>Fair play</h2>
      <p>Do not automate play, tamper with score submissions, interfere with the service, probe other accounts, or try to bypass security and rate limits. Scores that are invalid, abusive, or produced through manipulation may be rejected or removed.</p>

      <h2>Usernames and public scores</h2>
      <p>Choose a username that does not impersonate another person, violate rights, or contain abusive content. Your username and best score may be visible on the public leaderboard.</p>

      <h2>Availability</h2>
      <p>The game is provided as available. Features may change, pause, or end, and uninterrupted access is not guaranteed. Keep your own copy of anything you need; the service is not a backup system.</p>

      <h2>Accounts</h2>
      <p>You may delete your account from Account settings. Google sign-in is subject to Google’s own account terms. Accounts may be limited or removed when needed to protect the game, its users, or the service from abuse.</p>

      <h2>Privacy and contact</h2>
      <p>The <Link to="/privacy">privacy notice</Link> explains what data is handled and how to request help. Questions about these terms can be sent through <a href="https://github.com/uditaswal" target="_blank" rel="noreferrer">the project owner’s GitHub profile</a>.</p>
    </article>
  )
}
