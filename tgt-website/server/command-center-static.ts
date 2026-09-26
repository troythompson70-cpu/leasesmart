/**
 * Serves revenue-command-center/ at /command-center/ on the local Vite origin.
 * Same origin as /api/dashboard-feed. Does not widen CORS.
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const COMMAND_CENTER_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../revenue-command-center',
)

function contentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.ico':
      return 'image/x-icon'
    default:
      return 'application/octet-stream'
  }
}

export function commandCenterFile(url: string): string | null {
  const pathname = decodeURIComponent(String(url || '').split('?')[0])
  if (!pathname.startsWith('/command-center')) return null
  let rel = pathname.slice('/command-center'.length).replace(/^\/+/, '')
  if (!rel || rel.endsWith('/')) rel = `${rel}index.html`
  const full = path.resolve(COMMAND_CENTER_ROOT, rel)
  const rootWithSep = COMMAND_CENTER_ROOT.endsWith(path.sep)
    ? COMMAND_CENTER_ROOT
    : `${COMMAND_CENTER_ROOT}${path.sep}`
  if (full !== COMMAND_CENTER_ROOT && !full.startsWith(rootWithSep)) return null
  return full
}

export function serveCommandCenter(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  if (!String(req.url || '').startsWith('/command-center')) {
    next()
    return
  }
  const file = commandCenterFile(req.url || '')
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Not found')
    return
  }
  res.statusCode = 200
  res.setHeader('Content-Type', contentType(file))
  res.setHeader('Cache-Control', 'no-store')
  createReadStream(file).pipe(res)
}
