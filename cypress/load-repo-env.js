import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Minimal parser for repo root .env (no dotenv dependency). */
export function loadRepoEnv() {
  try {
    const raw = readFileSync(resolve('.env'), 'utf8')
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

export function resolveAdminPassword(developmentOptions) {
  const repoEnv = loadRepoEnv()
  return (
    process.env.FOUNDRY_ADMIN_KEY ||
    process.env.FOUNDRY_PASSWORD ||
    developmentOptions.adminPassword ||
    repoEnv.FOUNDRY_ADMIN_KEY ||
    repoEnv.FOUNDRY_PASSWORD ||
    ''
  )
}

export function resolveFoundryWorld(developmentOptions) {
  const repoEnv = loadRepoEnv()
  return (
    process.env.FOUNDRY_WORLD ||
    repoEnv.FOUNDRY_WORLD ||
    developmentOptions.testWorldName ||
    'modern-names-test'
  )
}
