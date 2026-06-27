/**
 * Install a local Quench test package (or any module/system) into foundrydata/Data.
 *
 * Detects the manifest type and drops into the right place:
 *   - system.json -> foundrydata/Data/systems/<id>
 *   - module.json -> foundrydata/Data/modules/<id>
 *
 * If a build command is provided (FOUNDRY_QUENCH_BUILD_COMMAND) it runs first and
 * we prefer the built output; otherwise the manifest's directory is dropped as-is.
 *
 * TODO: support quench_tests_path as a git repository URL (clone + build).
 */
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadModuleFvttConfig, MODULE_ROOT, resolveUserDataPath } from './fvtt-paths.js'

const ACTION_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function copyFoundryCypressTemplate (quenchRoot) {
  const src = path.join(ACTION_ROOT, 'templates', 'foundry-cypress.js')
  if (!fs.existsSync(src)) {
    throw new Error(`foundry-cypress template missing: ${src}`)
  }
  const dest = path.join(quenchRoot, 'foundry-cypress.js')
  fs.copyFileSync(src, dest)
  console.log('Copied foundry-cypress.js to', dest)
}

function writeQuenchFvttConfig(quenchRoot, userDataPath, baseURL) {
  const out = `/** Generated for Quench webpack build */\nconst developmentOptions = {\n  userDataPath: '${userDataPath.replace(/'/g, "\\'")}',\n  baseURL: '${baseURL.replace(/'/g, "\\'")}'\n}\n\nexport default developmentOptions\n`
  fs.writeFileSync(path.join(quenchRoot, 'fvtt.config.js'), out, 'utf8')
}

/** Manifest can live at <root>/module/ (webpack source layout) or <root>/ directly. */
function findManifest(quenchRoot) {
  const candidates = [
    { dir: path.join(quenchRoot, 'module'), file: 'system.json', dataSubdir: 'systems' },
    { dir: path.join(quenchRoot, 'module'), file: 'module.json', dataSubdir: 'modules' },
    { dir: quenchRoot, file: 'system.json', dataSubdir: 'systems' },
    { dir: quenchRoot, file: 'module.json', dataSubdir: 'modules' }
  ]
  for (const c of candidates) {
    const manifestPath = path.join(c.dir, c.file)
    if (fs.existsSync(manifestPath)) {
      const id = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).id
      return { ...c, manifestPath, id }
    }
  }
  return null
}

/** Prefer built output (in userdata or build/) over raw source. */
function findBuiltDir({ quenchRoot, sourceDir, file, dataSubdir, id, userDataPath }) {
  const inUserData = path.join(userDataPath, 'Data', dataSubdir, id)
  if (fs.existsSync(path.join(inUserData, file))) return inUserData

  const buildDir = path.join(quenchRoot, 'build')
  if (fs.existsSync(path.join(buildDir, file))) return buildDir

  return sourceDir
}

async function main() {
  const quenchRel = process.env.FOUNDRY_QUENCH_TESTS_PATH
  if (!quenchRel || !String(quenchRel).trim()) {
    console.log('FOUNDRY_QUENCH_TESTS_PATH not set — skip install-quench-tests')
    return
  }

  const quenchRoot = path.resolve(MODULE_ROOT, quenchRel.replace(/^\.\//, ''))
  if (!fs.existsSync(quenchRoot)) {
    throw new Error(`quench_tests_path not found: ${quenchRoot}`)
  }

  const manifest = findManifest(quenchRoot)
  if (!manifest) {
    throw new Error(
      `No system.json or module.json under ${quenchRoot} (checked ./module/ and ./)`
    )
  }
  const { file, dataSubdir, id } = manifest
  const sourceDir = path.dirname(manifest.manifestPath)
  console.log(`Found ${file} (id=${id}) -> Data/${dataSubdir}/${id}`)

  const developmentOptions = await loadModuleFvttConfig()
  const userDataPath = resolveUserDataPath(developmentOptions)
  if (!userDataPath) throw new Error('userDataPath missing in fvtt.config.js')

  const baseURL = developmentOptions.baseURL ?? 'http://localhost:30000'
  writeQuenchFvttConfig(quenchRoot, userDataPath, baseURL)
  copyFoundryCypressTemplate(quenchRoot)

  const buildCmd = process.env.FOUNDRY_QUENCH_BUILD_COMMAND?.trim()
  if (buildCmd) {
    console.log('Building Quench tests:', buildCmd)
    execFileSync('bash', ['-lc', buildCmd], {
      cwd: MODULE_ROOT,
      stdio: 'inherit',
      env: { ...process.env, FOUNDRY_MODULE_ROOT: MODULE_ROOT }
    })
  } else {
    console.log('No build command — dropping directory as-is')
  }

  const builtDir = findBuiltDir({
    quenchRoot,
    sourceDir,
    file,
    dataSubdir,
    id,
    userDataPath
  })

  const destDir = path.join(userDataPath, 'Data', dataSubdir, id)
  if (path.resolve(builtDir) !== path.resolve(destDir)) {
    if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(destDir), { recursive: true })
    fs.cpSync(builtDir, destDir, { recursive: true })
    console.log('Installed', id, 'to', destDir)
  } else {
    console.log(id, 'already at', destDir)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
