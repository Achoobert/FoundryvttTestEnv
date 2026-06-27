import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { loadModuleFvttConfig } from './fvtt-paths.js'
import { loadModuleDotEnv } from './module-dotenv.js'

const developmentOptions = await loadModuleFvttConfig()
const env = loadModuleDotEnv()
const container =
  env.FOUNDRY_CONTAINER_NAME ||
  developmentOptions.dockerContainerName ||
  process.env.FOUNDRY_CONTAINER_NAME ||
  'foundry-vtt-test'

const baseURL = developmentOptions.baseURL ?? 'http://localhost:30000'
const waitMs = Number(process.env.FOUNDRY_WAIT_MS) || 120_000
const deadline = Date.now() + waitMs
const pollMs = 2000
const progressMs = 30_000

let lastStatus = ''
let lastError = ''
let nextProgressAt = Date.now()

function logProgress() {
  const elapsed = Math.round((Date.now() - (deadline - waitMs)) / 1000)
  const detail = lastStatus
    ? `last HTTP ${lastStatus}`
    : lastError
      ? `last error: ${lastError}`
      : 'no response yet'
  console.log(
    `Still waiting for Foundry (${elapsed}s / ${Math.round(waitMs / 1000)}s) — ${detail}`
  )
}

function dumpDockerDiagnostics() {
  try {
    console.error('--- docker ps -a ---')
    console.error(execFileSync('docker', ['ps', '-a'], { encoding: 'utf8' }))
  } catch (e) {
    console.error('docker ps failed:', e.message)
  }
  try {
    console.error(`--- docker logs ${container} (last 80 lines) ---`)
    console.error(
      execFileSync('docker', ['logs', '--tail', '80', container], { encoding: 'utf8' })
    )
  } catch (e) {
    console.error('docker logs failed:', e.message)
  }
}

console.log(`Waiting for Foundry at ${baseURL} (timeout ${Math.round(waitMs / 1000)}s)`)

while (Date.now() < deadline) {
  if (Date.now() >= nextProgressAt) {
    logProgress()
    nextProgressAt = Date.now() + progressMs
  }
  try {
    const res = await fetch(baseURL, { redirect: 'follow' })
    lastStatus = String(res.status)
    lastError = ''
    if (res.ok || res.status === 302) {
      console.log('Foundry is up:', baseURL)
      process.exit(0)
    }
  } catch (e) {
    lastStatus = ''
    lastError = e instanceof Error ? e.message : String(e)
  }
  await new Promise((r) => setTimeout(r, pollMs))
}

console.error('Timed out waiting for Foundry at', baseURL)
dumpDockerDiagnostics()
process.exit(1)
