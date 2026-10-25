import { Github } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useSession } from '../lib/session-context'

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link nav-link--active' : 'nav-link'

export function SiteLayout() {
  const { loading, user } = useSession()
  const accountLabel = loading ? 'Account' : user?.username ?? 'Sign in'

  return (
    <div className="site-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <Link className="wordmark" to="/" aria-label="Snake home">
          <span className="wordmark-mark" aria-hidden="true">S</span>
          <span>Snake</span>
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <NavLink className={navClass} to="/play">Play</NavLink>
          <NavLink className={navClass} to="/leaderboard" aria-label="Leaderboard">
            <span className="nav-label-long" aria-hidden="true">Leaderboard</span>
            <span className="nav-label-short" aria-hidden="true">Scores</span>
          </NavLink>
          <NavLink
            className={({ isActive }) => `${navClass({ isActive })} nav-account`}
            to="/account"
            aria-label={user ? `Account: ${user.username}` : accountLabel}
            title={user?.username}
          >
            {accountLabel}
          </NavLink>
        </nav>
      </header>

      <main className="site-main" id="main-content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <p>Built by Udit Aswal · {new Date().getFullYear()}</p>
        <div className="footer-links">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <a href="https://github.com/uditaswal" target="_blank" rel="noreferrer">
            <Github aria-hidden="true" size={18} />
            <span className="sr-only">Udit Aswal on GitHub</span>
          </a>
        </div>
      </footer>
    </div>
  )
}

