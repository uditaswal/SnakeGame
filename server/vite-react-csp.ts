import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/** Keep React Fast Refresh compatible with script-src 'self' in development. */
export function reactCspPreamble(): Plugin {
  let base = '/'
  const filename = '@snake/react-preamble.js'
  const preamble = () => react.preambleCode.replace('__BASE__', base)

  return {
    name: 'snake:react-csp-preamble',
    apply: 'serve',
    configResolved(config) {
      base = config.base
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== `${base}${filename}`) return next()
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('X-Content-Type-Options', 'nosniff')
        response.end(preamble())
      })
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Replace only the installed React plugin's preamble, in its original
        // position before application modules. Never externalize arbitrary HTML.
        return html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (tag, code: string) =>
          code.trim() === preamble().trim()
            ? `<script type="module" src="${base}${filename}"></script>`
            : tag,
        )
      },
    },
  }
}
