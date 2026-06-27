describe('Smoke tests', () => {
  it('should visit the home page', () => {
    cy.visit('/')
    cy.get('body').should('exist', { timeout: 10000 })
  })
  it('should login', () => {
    // There may be first-setup screen we have to ignore
    cy.visit('/')
    cy.licenseAgreeAndClickAccept()
    cy.setupInputPasswordAndClickLogin()
    cy.closeTourOverlay()
    cy.launchTestWorldFromSetup()
    cy.loginAsGM()
    cy.get('body').should('exist', { timeout: 10000 })
    // cy.activateModules()
  })
})