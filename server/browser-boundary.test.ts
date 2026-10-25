import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const browserSourceRoot = join(process.cwd(), 'src')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return ['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name)) ? [path] : []
  })
}

describe('browser secret boundary', () => {
  it('keeps the database connection string out of browser source', () => {
    for (const path of sourceFiles(browserSourceRoot)) {
      const source = readFileSync(path, 'utf8')
      expect(source, `${path} must not reference the server database URL`).not.toMatch(/DATABASE_URL|VITE_[A-Z0-9_]*DATABASE/)
    }
  })
})
