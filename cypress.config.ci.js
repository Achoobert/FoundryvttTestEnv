import { fileURLToPath, pathToFileURL } from 'node:url'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { defineFoundryConfig } from './templates/foundry-cypress.js'
import {
  resolveAdminPassword,
  resolveFoundryWorld
} from './cypress/load-repo-env.js'

const actionRoot = path.dirname(fileURLToPath(import.meta.url))
const moduleRoot = process.env.FOUNDRY_MODULE_ROOT || process.cwd()

let developmentOptions = {}
const fvttPath = path.join(moduleRoot, 'fvtt.config.js')
if (fs.existsSync(fvttPath)) {
  developmentOptions = (await import(pathToFileURL(fvttPath).href)).default ?? {}
}

const baseURL = developmentOptions.baseURL || 'http://localhost:30000'
const foundryWorld = resolveFoundryWorld(developmentOptions)
const adminPassword = resolveAdminPassword(developmentOptions)

export default defineFoundryConfig({
  e2e: {
    baseUrl: baseURL,
    supportFile: path.join(actionRoot, 'cypress/support/e2e.js'),
    specPattern: path.join(actionRoot, 'cypress/e2e/**/*.cy.js'),
    screenshotsFolder: path.join(moduleRoot, 'cypress/screenshots')
  },
  env: {
    ADMIN_PASSWORD: adminPassword,
    FOUNDRY_WORLD: foundryWorld
  }
})
