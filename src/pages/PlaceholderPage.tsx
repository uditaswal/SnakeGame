import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/page-meta'

type PlaceholderPageProps = {
  title: string
  message: string
  noIndex?: boolean
}

export function PlaceholderPage({ title, message, noIndex = false }: PlaceholderPageProps) {
  usePageMeta(title, message, noIndex)
  return (
    <section className="placeholder-page">
      <h1>{title}</h1>
      <p>{message}</p>
      <Link className="primary-action" to="/play">Play as guest</Link>
    </section>
  )
}

