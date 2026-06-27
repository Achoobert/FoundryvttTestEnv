/* global cy, describe, expect, it */
import 'cypress-if'

describe('Quench tests', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.licenseAgreeAndClickAccept()
    cy.setupInputPasswordAndClickLogin()
    cy.closeTourOverlay()
    cy.launchTestWorldFromSetup()
    cy.loginAsGM()
    cy.window({ timeout: 120000 }).should((win) => {
      expect(win.game?.ready, 'game.ready before Quench').to.eq(true)
    })
    cy.get('.quench-button, [data-tooltip="QUENCH.Title"]', { timeout: 120000 }).should('exist')
  })

  it('run quench tests', () => {
    cy.get('.quench-button, [data-tooltip="QUENCH.Title"]').if().then(() => {
      cy.get('.quench-button, [data-tooltip="QUENCH.Title"]').click()
    })

    cy.get('.quench-button, [data-tooltip="QUENCH.Title"]').click()
    cy.get("[data-select='all']").should('exist').click({ force: true })
    cy.get('#quench-run').should('be.visible').click()

    cy.get('.stats', { timeout: 300000 }).should('be.visible')
    cy.get('.stats').then((stats) => {
      cy.log('Test report: ', stats.text())
    })

    cy.get('.error').if().then((summary) => {
      cy.log('errors: ', summary.text())
    })

    cy.get('.stats').if().then(($stats) => {
      const summary = $stats.text()
      if (!summary.includes('failed')) return

      const errors = Cypress.$('.error-message')
        .map((_, el) => Cypress.$(el).text().trim())
        .get()
      const diffs = Cypress.$('.diff')
        .map((_, el) => Cypress.$(el).text().trim())
        .get()

      expect(
        summary,
        `Quench failures:\n${JSON.stringify({ summary, errors, diffs }, null, 2)}`
      ).to.not.include('failed')
    })
  })
})
