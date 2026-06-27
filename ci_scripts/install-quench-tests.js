/**
 * Build local Quench test package and ensure output is in foundrydata/Data/modules.
 * TODO: support quench_tests_path as a git repository URL (clone + build).
 */
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadModuleFvttConfig, MODULE_ROOT, resolveUserDataPath } from './fvtt-paths.js'

function writeQuenchFvttConfig(quenchRoot, userDataPath, baseURL) {
  const out = `/** Generated for Quench webpack build */\nconst developmentOptions = {\n  userDataPath: '${userDataPath.replace(/'/g, "\\'")}',\n  baseURL: '${baseURL.replace(/'/g, "\\'")}'\n}\n\nexport default developmentOptions\n`
  fs.writeFileSync(path.join(quenchRoot, 'fvtt.config.js'), out, 'utf8')
}

function findBuiltModuleDir(quenchRoot, moduleId, userDataPath) {
  const inUserData = path.join(userDataPath, 'Data', 'modules', moduleId)
  if (fs.existsSync(path.join(inUserData, 'module.json'))) {
    return inUserData
  }
  const buildDir = path.join(quenchRoot, 'build')
  if (fs.existsSync(path.join(buildDir, 'module.json'))) {
    return buildDir
  }
  return null
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

  const manifestPath = path.join(quenchRoot, 'module', 'module.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}`)
  }
  const moduleId = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).id

  const developmentOptions = await loadModuleFvttConfig()
  const userDataPath = resolveUserDataPath(developmentOptions)
  if (!userDataPath) throw new Error('userDataPath missing in fvtt.config.js')

  const baseURL = developmentOptions.baseURL ?? 'http://localhost:30000'
  writeQuenchFvttConfig(quenchRoot, userDataPath, baseURL)

  const buildCmd =
    process.env.FOUNDRY_QUENCH_BUILD_COMMAND?.trim() ||
    `npm --prefix "${quenchRoot}" run build`

  console.log('Building Quench tests:', buildCmd)
  execFileSync('bash', ['-lc', buildCmd], {
    cwd: MODULE_ROOT,
    stdio: 'inherit',
    env: { ...process.env, FOUNDRY_MODULE_ROOT: MODULE_ROOT }
  })

  const builtDir = findBuiltModuleDir(quenchRoot, moduleId, userDataPath)
  if (!builtDir) {
    throw new Error(
      `Quench build did not produce module ${moduleId} under ${userDataPath}/Data/modules or ${quenchRoot}/build`
    )
  }

  const destDir = path.join(userDataPath, 'Data', 'modules', moduleId)
  if (path.resolve(builtDir) !== path.resolve(destDir)) {
    if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(destDir), { recursive: true })
    fs.cpSync(builtDir, destDir, { recursive: true })
    console.log('Copied Quench tests module to', destDir)
  } else {
    console.log('Quench tests module already at', destDir)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
