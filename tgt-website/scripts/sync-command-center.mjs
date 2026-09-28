/**
 * Copy revenue-command-center/ into public/command-center/ so production
 * static hosting can serve /command-center without the Vite middleware.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const websiteRoot = path.resolve(here, '..')
const repoRoot = path.resolve(websiteRoot, '..')
const source = path.join(repoRoot, 'revenue-command-center')
const dest = path.join(websiteRoot, 'public', 'command-center')

if (!existsSync(source)) {
  console.error(`[sync-command-center] missing source: ${source}`)
  process.exit(1)
}

rmSync(dest, { recursive: true, force: true })
mkdirSync(path.dirname(dest), { recursive: true })
cpSync(source, dest, {
  recursive: true,
  filter: (src) => {
    const base = path.basename(src)
    if (base === 'node_modules' || base === '.git') return false
    if (base === 'tests') return false
    return true
  },
})

console.log(`[sync-command-center] ${source} → ${dest}`)
