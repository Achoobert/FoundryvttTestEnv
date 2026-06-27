import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { MODULE_ROOT } from './fvtt-paths.js'

export function loadModuleDotEnv() {
  try {
    const raw = readFileSync(path.join(MODULE_ROOT, '.env'), 'utf8')
    const out = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))
      ) {
        value = value.slice(1, -1)
      }
      out[key] = value
    }
    return out
  } catch {
    return {}
  }
}
