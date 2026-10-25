import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const FALLBACK_SITE_ORIGIN = 'https://snake-game-two-flame.vercel.app'
const configuredOrigin = import.meta.env.VITE_SITE_ORIGIN || FALLBACK_SITE_ORIGIN
const siteOrigin = configuredOrigin.replace(/\/$/, '')
const socialImage = `${siteOrigin}/img/home.png`

export function usePageMeta(title: string, description: string, noIndex = false): void {
  const { pathname } = useLocation()

  useEffect(() => {
    const fullTitle = `${title} · Snake`
    const canonicalUrl = `${siteOrigin}${pathname === '/' ? '' : pathname}`

    document.title = fullTitle
    setMeta('name', 'description', description)
    setMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow')
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', canonicalUrl)
    setMeta('property', 'og:image', socialImage)
    setMeta('name', 'twitter:title', fullTitle)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', socialImage)
    setCanonical(canonicalUrl)
  }, [description, noIndex, pathname, title])
}

function setMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.content = content
}

function setCanonical(href: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
}
