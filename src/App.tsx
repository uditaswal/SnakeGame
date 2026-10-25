import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { AccountPage } from './pages/AccountPage'
import { PlayPage } from './pages/PlayPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { SiteLayout } from './ui/SiteLayout'

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="play" element={<PlayPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route
            path="*"
            element={<PlaceholderPage title="Page not found" message="This route does not exist." noIndex />}
          />
        </Route>
      </Routes>
    </>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

