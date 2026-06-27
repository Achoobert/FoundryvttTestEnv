/**
 * Run Cypress from the action package against the consumer workspace (FOUNDRY_MODULE_ROOT).
 */
import { execFileSync } from 'node:child_process'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const ACTION_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const moduleRoot = process.env.FOUNDRY_MODULE_ROOT || process.cwd()
const configFile = path.join(ACTION_ROOT, 'cypress.config.ci.js')

process.env.CI = process.env.CI || 'true'

console.log('Cypress module root:', moduleRoot)
console.log('Cypress config:', configFile)

execFileSync(
  'npx',
  [
    'cypress',
    'run',
    '--headless',
    '--browser',
    'chrome',
    '--config-file',
    configFile
  ],
  {
    cwd: moduleRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      FOUNDRY_MODULE_ROOT: moduleRoot,
      NODE_PATH: path.join(ACTION_ROOT, 'node_modules')
    }
  }
)
