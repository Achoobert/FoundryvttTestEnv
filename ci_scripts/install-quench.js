/**
 * Installs Quench + test system; enables modules on test world (fvtt.config.js).
 */
import { execFileSync } from 'node:child_process'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ClassicLevel } from 'classic-level'
import { loadModuleFvttConfig, MODULE_ROOT, resolveUserDataPath } from './fvtt-paths.js'
import { loadModuleDotEnv } from './module-dotenv.js'

const DEFAULT_QUENCH_MANIFEST =
  'https://github.com/SobranDM/FVTT-Quench/releases/download/v0.11.2/module.json'
// 'https://github.com/Ethaks/FVTT-Quench/releases/download/v0.10.0/module.json'

const DEFAULT_TEST_SYSTEM_MANIFEST =
  'https://github.com/deltagreen-foundryvtt/delta-green-foundry-vtt-system/releases/download/v1.7.0/system.json'

const FOUNDRY_CORE_VERSION = process.env.FOUNDRY_CORE_VERSION || '14.364'

const WORLD_DATA_DIRS = [
  'actors',
  'cards',
  'combats',
  'effects',
  'folders',
  'fog',
  'items',
  'journal',
  'macros',
  'messages',
  'playlists',
  'scenes',
  'settings',
  'tables',
  'users'
]

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.json()
}

async function downloadFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`)
  fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))
}

function unzipInto(zipPath, extractDir) {
  fs.mkdirSync(extractDir, { recursive: true })
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', extractDir], { stdio: 'inherit' })
}

function findPackageRoot(extractDir, manifestFileName) {
  const direct = path.join(extractDir, manifestFileName)
  if (fs.existsSync(direct)) return extractDir
  for (const name of fs.readdirSync(extractDir)) {
    const sub = path.join(extractDir, name)
    if (
      fs.statSync(sub).isDirectory() &&
      fs.existsSync(path.join(sub, manifestFileName))
    ) {
      return sub
    }
  }
  throw new Error(`${manifestFileName} not found under ${extractDir} after unzip`)
}

function copyTree(srcDir, destDir) {
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true })
  fs.mkdirSync(destDir, { recursive: true })
  fs.cpSync(srcDir, destDir, { recursive: true })
}

async function installFromZipManifest({
  manifestUrl,
  downloadUrlOverride,
  destDir,
  manifestFileName,
  label
}) {
  const manifest = await fetchJson(manifestUrl)
  const downloadUrl = downloadUrlOverride ?? manifest.download
  if (!downloadUrl) throw new Error(`No download URL for ${label}`)

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-install-`))
  const zipPath = path.join(tmpDir, 'package.zip')
  const extractDir = path.join(tmpDir, 'extract')

  try {
    console.log(`Downloading ${label} from`, downloadUrl)
    await downloadFile(downloadUrl, zipPath)
    unzipInto(zipPath, extractDir)
    const packageRoot = findPackageRoot(extractDir, manifestFileName)
    copyTree(packageRoot, destDir)
    console.log(`Installed ${label} to`, destDir)
    return manifest
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function readInstalledManifest(destDir, manifestFileName) {
  const p = path.join(destDir, manifestFileName)
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

/**
 * Find systems staged under systemsRoot by build_script.
 * Returns an array of { dir, manifest } for every subdirectory containing a system.json.
 */
function discoverStagedSystems(systemsRoot) {
  if (!fs.existsSync(systemsRoot)) return []
  return fs
    .readdirSync(systemsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(systemsRoot, entry.name))
    .map((dir) => ({ dir, manifest: readInstalledManifest(dir, 'system.json') }))
    .filter((candidate) => candidate.manifest)
}

/**
 * Resolve the single system staged locally by build_script (system-agnostic).
 * Throws when none or more than one is present.
 */
function resolveStagedSystem(systemsRoot, context) {
  const staged = discoverStagedSystems(systemsRoot)
  if (staged.length === 0) {
    throw new Error(
      `${context} but no built system found under ${systemsRoot} — run build_script first`
    )
  }
  if (staged.length > 1) {
    const ids = staged.map((s) => s.manifest.id).join(', ')
    throw new Error(
      `${context} but multiple systems found under ${systemsRoot} (${ids}) — set test_system_manifest_url to a manifest URL to disambiguate`
    )
  }
  return staged[0]
}

async function ensureTestSystem(systemsRoot, options) {
  const manifestUrl = options.testSystemManifestUrl ?? DEFAULT_TEST_SYSTEM_MANIFEST

  if (manifestUrl === 'local') {
    const { dir, manifest } = resolveStagedSystem(
      systemsRoot,
      'test_system_manifest_url is local'
    )
    console.log(`Using staged test system at ${dir} (id=${manifest.id})`)
    return manifest
  }

  let manifest
  try {
    manifest = await fetchJson(manifestUrl)
  } catch (err) {
    const staged = discoverStagedSystems(systemsRoot)
    if (staged.length === 1) {
      console.warn(
        `Could not fetch test system manifest (${err.message}); using ${staged[0].dir}`
      )
      return staged[0].manifest
    }
    throw err
  }

  const destDir = path.join(systemsRoot, manifest.id)

  try {
    await installFromZipManifest({
      manifestUrl,
      downloadUrlOverride: options.testSystemDownloadUrl,
      destDir,
      manifestFileName: 'system.json',
      label: 'test system'
    })
    return manifest
  } catch (err) {
    const existing = readInstalledManifest(destDir, 'system.json')
    if (existing) {
      console.warn(`Could not refresh test system (${err.message}); using existing ${destDir}`)
      return existing
    }
    throw err
  }
}

function worldIdFromTitle(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'test-world'
}

function syncWorldCoreVersion(world) {
  world.coreVersion = FOUNDRY_CORE_VERSION
  world.compatibility = { ...(world.compatibility ?? {}), minimum: '14', verified: '14' }
}

const MODULE_CONFIGURATION_KEY = 'core.moduleConfiguration'

function generateSettingId() {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  while (id.length < 16) {
    id += chars[crypto.randomInt(chars.length)]
  }
  return id
}

function assertSettingsDbNotLocked(settingsDir) {
  const lockPath = path.join(settingsDir, 'LOCK')
  if (!fs.existsSync(lockPath)) return
  const lockBody = fs.readFileSync(lockPath, 'utf8').trim()
  if (lockBody) {
    throw new Error(`settings DB locked at ${settingsDir} — stop Foundry first`)
  }
}

function moduleConfigurationFromIds(moduleIds) {
  return Object.fromEntries(moduleIds.map((id) => [id, true]))
}

function parseModuleConfigurationValue(rawValue) {
  if (rawValue == null || rawValue === '') return {}
  if (typeof rawValue === 'object') return { ...rawValue }
  try {
    return JSON.parse(rawValue)
  } catch {
    return {}
  }
}

async function upsertModuleConfigurationSetting(settingsDir, world, moduleIds) {
  assertSettingsDbNotLocked(settingsDir)
  fs.mkdirSync(settingsDir, { recursive: true })

  let db
  try {
    db = new ClassicLevel(settingsDir, { keyEncoding: 'utf8', valueEncoding: 'json' })
  } catch (err) {
    if (/lock|LOCK|busy/i.test(String(err.message))) {
      throw new Error(`settings DB locked at ${settingsDir} (${err.message})`)
    }
    throw err
  }

  try {
    let existingKey = null
    let doc = null

    for await (const [key, entry] of db.iterator({ gte: '!settings!', lt: '!settings!~' })) {
      if (entry?.key === MODULE_CONFIGURATION_KEY) {
        existingKey = key
        doc = entry
        break
      }
    }

    const merged = {
      ...parseModuleConfigurationValue(doc?.value),
      ...moduleConfigurationFromIds(moduleIds)
    }
    const now = Date.now()

    if (doc && existingKey) {
      doc.value = JSON.stringify(merged)
      doc._stats = {
        ...(doc._stats ?? {}),
        coreVersion: FOUNDRY_CORE_VERSION,
        systemId: world.system,
        systemVersion: world.systemVersion,
        modifiedTime: now
      }
      await db.put(existingKey, doc)
    } else {
      const _id = generateSettingId()
      doc = {
        key: MODULE_CONFIGURATION_KEY,
        value: JSON.stringify(merged),
        _id,
        user: null,
        _stats: {
          coreVersion: FOUNDRY_CORE_VERSION,
          systemId: world.system,
          systemVersion: world.systemVersion,
          createdTime: now,
          modifiedTime: now,
          lastModifiedBy: null,
          compendiumSource: null,
          duplicateSource: null,
          exportSource: null
        }
      }
      await db.put(`!settings!${_id}`, doc)
    }
  } finally {
    await db.close()
  }
}

async function enableModulesInWorld(worldJsonPath, moduleIds, moduleVersions) {
  const raw = fs.readFileSync(worldJsonPath, 'utf8')
  const world = JSON.parse(raw)
  syncWorldCoreVersion(world)
  world.modules = world.modules ?? {}
  for (const id of moduleIds) {
    const version = moduleVersions[id]
    world.modules[id] = {
      ...(world.modules[id] ?? {}),
      id,
      type: 'module',
      enabled: true,
      ...(version ? { version } : {})
    }
    delete world.modules[id].disabled
  }
  fs.writeFileSync(worldJsonPath, JSON.stringify(world, null, 2) + '\n', 'utf8')

  const settingsDir = path.join(path.dirname(worldJsonPath), 'data', 'settings')
  await upsertModuleConfigurationSetting(settingsDir, world, moduleIds)
}

function findWorldJsonPath(worldsRoot, testWorldName) {
  if (!testWorldName || !fs.existsSync(worldsRoot)) return null

  const byFolder = path.join(worldsRoot, testWorldName, 'world.json')
  if (fs.existsSync(byFolder)) return byFolder

  const bySlug = path.join(worldsRoot, worldIdFromTitle(testWorldName), 'world.json')
  if (fs.existsSync(bySlug)) return bySlug

  for (const entry of fs.readdirSync(worldsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const worldJson = path.join(worldsRoot, entry.name, 'world.json')
    if (!fs.existsSync(worldJson)) continue
    try {
      const world = JSON.parse(fs.readFileSync(worldJson, 'utf8'))
      if (world.title === testWorldName || world.id === testWorldName) return worldJson
    } catch {
      //
    }
  }
  return null
}

/** Authoritative system version = the system.json Foundry will actually load. */
function readInstalledSystemVersion(worldsRoot, systemId, fallback) {
  try {
    const systemsRoot = path.join(path.dirname(worldsRoot), 'systems')
    const installed = path.join(systemsRoot, systemId, 'system.json')
    if (fs.existsSync(installed)) {
      const version = JSON.parse(fs.readFileSync(installed, 'utf8')).version
      if (version) return version
    }
  } catch {
    //
  }
  return fallback
}

function createTestWorld(worldsRoot, title, systemManifest) {
  const worldId = worldIdFromTitle(title)
  const worldDir = path.join(worldsRoot, worldId)
  const worldJsonPath = path.join(worldDir, 'world.json')

  if (fs.existsSync(worldJsonPath)) return worldJsonPath

  fs.mkdirSync(path.join(worldDir, 'data'), { recursive: true })
  for (const sub of WORLD_DATA_DIRS) {
    fs.mkdirSync(path.join(worldDir, 'data', sub), { recursive: true })
  }

  const systemVersion = readInstalledSystemVersion(
    worldsRoot,
    systemManifest.id,
    systemManifest.version
  )

  const world = {
    title,
    id: worldId,
    system: systemManifest.id,
    systemVersion,
    coreVersion: FOUNDRY_CORE_VERSION,
    compatibility: { minimum: '14', verified: '14' },
    playtime: 0,
    description: 'Auto-created for Quench/Cypress tests',
    flags: {},
    modules: {}
  }

  fs.writeFileSync(worldJsonPath, JSON.stringify(world, null, 2) + '\n', 'utf8')
  console.log('Created test world:', worldDir)
  return worldJsonPath
}

async function ensureTestWorld(worldsRoot, title, systemManifest, moduleIds, moduleVersions) {
  let worldJsonPath = findWorldJsonPath(worldsRoot, title)
  if (!worldJsonPath) {
    worldJsonPath = createTestWorld(worldsRoot, title, systemManifest)
  }
  await enableModulesInWorld(worldJsonPath, moduleIds, moduleVersions)
  console.log('Enabled test modules in world:', title, worldJsonPath)
}

function patchQuenchForCore14(quenchDir) {
  const manifestPath = path.join(quenchDir, 'module.json')
  if (!fs.existsSync(manifestPath)) return
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  manifest.compatibility = {
    ...(manifest.compatibility ?? {}),
    minimum: '13.341',
    verified: '14'
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
}

function readLocalModuleVersion(moduleJsonPath) {
  try {
    if (!fs.existsSync(moduleJsonPath)) return undefined
    return JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8')).version
  } catch {
    return undefined
  }
}

async function main() {
  const developmentOptions = await loadModuleFvttConfig()
  const {
    testWorldName,
    testModuleIds,
    quenchManifestUrl,
    quenchDownloadUrl,
    testSystemManifestUrl,
    testSystemDownloadUrl
  } = developmentOptions

  const moduleIds = Array.isArray(testModuleIds) ? testModuleIds.filter(Boolean) : []
  if (moduleIds.length === 0) {
    console.error('fvtt.config.js: testModuleIds must be a non-empty array')
    process.exit(1)
  }

  const resolvedUserData = resolveUserDataPath(developmentOptions)
  if (!resolvedUserData) {
    console.error('fvtt.config.js: userDataPath missing or invalid')
    process.exit(1)
  }
  fs.mkdirSync(resolvedUserData, { recursive: true })

  if (!testWorldName) {
    console.error('fvtt.config.js: testWorldName is required')
    process.exit(1)
  }

  const envHost = loadModuleDotEnv().FOUNDRY_USERDATA_HOST
  if (envHost && path.resolve(envHost) !== resolvedUserData) {
    console.error('Mismatch: fvtt.config.js userDataPath !== .env FOUNDRY_USERDATA_HOST')
    process.exit(1)
  }

  try {
    const actionPath = process.env.FOUNDRY_ACTION_PATH
    const loaderCandidates = [
      actionPath ? path.join(actionPath, 'cypress', 'load-repo-env.js') : null,
      path.join(MODULE_ROOT, 'cypress', 'load-repo-env.js')
    ].filter((p) => p && fs.existsSync(p))
    for (const loaderPath of loaderCandidates) {
      const { loadRepoEnv } = await import(pathToFileURL(loaderPath).href)
      const host = loadRepoEnv().FOUNDRY_USERDATA_HOST
      if (host && path.resolve(host) !== resolvedUserData) {
        console.error('Mismatch: fvtt.config.js userDataPath !== .env FOUNDRY_USERDATA_HOST')
        process.exit(1)
      }
      break
    }
  } catch {
    //
  }

  const dataRoot = path.join(resolvedUserData, 'Data')
  const modulesDir = path.join(dataRoot, 'modules')
  const systemsRoot = path.join(dataRoot, 'systems')
  const worldsRoot = path.join(dataRoot, 'worlds')

  const quenchDir = path.join(modulesDir, 'quench')
  const quenchManifest = await installFromZipManifest({
    manifestUrl: quenchManifestUrl ?? DEFAULT_QUENCH_MANIFEST,
    downloadUrlOverride: quenchDownloadUrl,
    destDir: quenchDir,
    manifestFileName: 'module.json',
    label: 'Quench'
  })
  patchQuenchForCore14(quenchDir)

  const systemManifest = await ensureTestSystem(systemsRoot, {
    testSystemManifestUrl,
    testSystemDownloadUrl
  })

  const moduleVersions = { quench: quenchManifest.version }
  for (const id of moduleIds) {
    if (id === 'quench') continue
    moduleVersions[id] = readLocalModuleVersion(path.join(modulesDir, id, 'module.json'))
  }

  await ensureTestWorld(worldsRoot, testWorldName, systemManifest, moduleIds, moduleVersions)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
