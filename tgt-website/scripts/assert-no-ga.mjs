#!/usr/bin/env node
/**
 * Fail if website source still loads or names Google Analytics.
 * Scans tgt-website/src only. Does not contact Google or production.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')
const needles = ['googletagmanager', 'gtag', 'G-3WSD9VGVM6']

function walk(dir) {
  const hits = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      hits.push(...walk(full))
      continue
    }
    const text = readFileSync(full, 'utf8')
    for (const needle of needles) {
      if (text.includes(needle)) {
        hits.push(`${relative(root, full)} contains ${needle}`)
      }
    }
  }
  return hits
}

const hits = walk(srcDir)
if (hits.length > 0) {
  console.error('FAIL Google Analytics references remain in tgt-website/src:')
  for (const hit of hits) console.error(`  ${hit}`)
  process.exit(1)
}

console.log('PASS no Google Analytics references in tgt-website/src')
