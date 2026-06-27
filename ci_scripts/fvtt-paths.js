import * as fs from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

export const MODULE_ROOT = path.resolve(
  process.env.FOUNDRY_MODULE_ROOT || process.cwd()
)

export function resolveUserDataPath(developmentOptions) {
  const raw = developmentOptions?.userDataPath
  if (!raw || typeof raw !== 'string' || !String(raw).trim()) {
    return null
  }
  const trimmed = String(raw).trim()
  return path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(MODULE_ROOT, trimmed)
}

export async function loadModuleFvttConfig() {
  const configPath = path.join(MODULE_ROOT, 'fvtt.config.js')
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing ${configPath} — run write-ci-config first`)
  }
  const mod = await import(pathToFileURL(configPath).href)
  return mod.default
}

export function readModuleJsonId(moduleJsonPath) {
  try {
    if (!fs.existsSync(moduleJsonPath)) return null
    return JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8')).id
  } catch {
    return null
  }
}
