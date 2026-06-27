/**
 * Shared Cypress config for Foundry E2E (headless Chrome + software WebGL).
 * Copied into quench test repos as foundry-cypress.js by install-quench-tests.js.
 */
import { defineConfig } from 'cypress'

/** Headless CI needs software WebGL for Foundry / Pixi (avoids getExtension errors). */
export function applyChromeLaunchArgs (launchOptions) {
  launchOptions.args.push(
    '--window-size=1366,768',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-angle=swiftshader-webgl',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist'
  )
  return launchOptions
}

function resolveAdminPassword () {
  return (
    process.env.FOUNDRY_ADMIN_KEY ||
    process.env.FOUNDRY_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    ''
  )
}

/**
 * @param {import('cypress').PluginConfigOptions & { e2e?: Record<string, unknown>; env?: Record<string, unknown> }} overrides
 */
export function defineFoundryConfig (overrides = {}) {
  const { e2e: e2eOverrides = {}, env: envOverrides = {}, ...restOverrides } = overrides
  const { setupNodeEvents: consumerSetup, ...e2eRest } = e2eOverrides

  const baseUrl =
    (typeof e2eRest.baseUrl === 'string' && e2eRest.baseUrl) ||
    'http://localhost:30000'

  return defineConfig({
    ...restOverrides,
    e2e: {
      baseUrl,
      video: false,
      screenshotOnRunFailure: true,
      defaultCommandTimeout: 15000,
      requestTimeout: 15000,
      responseTimeout: 15000,
      pageLoadTimeout: 60000,
      retries: { runMode: 2, openMode: 0 },
      ...e2eRest,
      setupNodeEvents (on, config) {
        on('before:browser:launch', (browser, launchOptions) => {
          if (browser.name === 'chrome' || browser.name === 'chromium') {
            applyChromeLaunchArgs(launchOptions)
          }
          return launchOptions
        })
        if (typeof consumerSetup === 'function') {
          config = consumerSetup(on, config)
        }
        return config
      }
    },
    env: {
      ...envOverrides,
      ADMIN_PASSWORD: resolveAdminPassword(),
      FOUNDRY_WORLD:
        process.env.FOUNDRY_WORLD ||
        envOverrides.FOUNDRY_WORLD ||
        ''
    },
    viewportWidth: restOverrides.viewportWidth ?? 1366,
    viewportHeight: restOverrides.viewportHeight ?? 768
  })
}
