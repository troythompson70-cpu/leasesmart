#!/usr/bin/env node
/**
 * Fail if tgt-website/src still mentions Formspark. Intake mode is api only.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')
const needle = 'formspark'

function walk(dir) {
  const hits = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      hits.push(...walk(full))
      continue
    }
    if (!entry.isFile()) continue
    const text = readFileSync(full, 'utf8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].toLowerCase().includes(needle)) {
        hits.push(`${relative(root, full)}:${i + 1}: ${lines[i].trim()}`)
      }
    }
  }
  return hits
}

const hits = walk(srcDir)
if (hits.length > 0) {
  console.error('FAIL formspark reference in tgt-website/src:')
  for (const hit of hits) console.error(hit)
  process.exit(1)
}

console.log('PASS no formspark string in tgt-website/src')
