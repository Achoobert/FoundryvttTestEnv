# FoundryvttTestEnv

Composite GitHub Action: Foundry Docker (felddy), Quench, **action-owned Cypress** E2E against **your repo** workspace (`$GITHUB_WORKSPACE`).

```yaml
- uses: Achoobert/FoundryvttTestEnv@0.0.4
  with:
    foundry_version: '14.364'
    foundry_world: my-module-test
    quench_tests_path: ./quench
    quench_build_command: npm run quench:build
    foundry_username: ${{ secrets.FOUNDRY_USERNAME }}
    foundry_password: ${{ secrets.FOUNDRY_PASSWORD }}
    foundry_admin_key: ${{ secrets.FOUNDRY_ADMIN_KEY }}
```

Composite actions use **inputs only** — pass Foundry credentials as `foundry_username`, `foundry_password`, `foundry_admin_key` (from your repo secrets).

## Consumer contract

### Required in your job before calling the action

- `npm ci` (and any build that copies your **main module/system** into `foundrydata/Data/...`).
- Repo secrets: `FOUNDRY_USERNAME`, `FOUNDRY_PASSWORD`, `FOUNDRY_ADMIN_KEY`.
- `permissions: actions: write` on the workflow (for Foundry distribution cache).

### Cypress (in the action)

Smoke + Quench runners live in this repo (`cypress/e2e/`, `cypress/support/`). The action runs `cypress run` from `github.action_path` with `FOUNDRY_MODULE_ROOT` = your workspace. You do **not** need `cypress`, `test_command`, or `cypress_install_command` in the consumer unless you override.

Optional escape hatches:

- `test_command` — custom Cypress command (runs in workspace).
- `cypress_install_command` — custom install step.

### Optional `fvtt.config.example.js` at repo root

If present (see `fvtt_config_path` input), merged into generated `fvtt.config.js`. Useful keys:

- `testWorldName`, `testModuleIds`, `dockerContainerName`
- `quenchManifestUrl`, `testSystemManifestUrl`

If missing, the action synthesizes config from inputs (`foundry_world`, derived `testModuleIds`, etc.).

### `quench_tests_path`

Local directory with Quench **batches only** (`module/src/quench/`, etc.) and a webpack (or other) build. The action:

1. Writes `fvtt.config.js` in that folder with `userDataPath` pointing at workspace `foundrydata/`.
2. Runs `quench_build_command` or `npm --prefix <path> run build`.
3. Ensures output lives under `foundrydata/Data/modules/<tests-module-id>`.

**TODO:** support `quench_tests_path` as a git repository URL (clone + build).

### Main module / system

The action does **not** build your primary package. Use `build_script` / pre-steps so `foundrydata/Data/modules/<id>` or `foundrydata/Data/systems/<id>` exists before Cypress runs.

### `test_system_manifest_url: local`

When testing a **game system** from the same repo (not a release zip), stage `foundrydata/Data/systems/<id>/` in `build_script`, then pass `test_system_manifest_url: local` so install-quench skips downloading the default release manifest.

## Layout

- `action.yml` — composite steps
- `cypress/` — shared E2E specs and support (smoke, Quench runner)
- `cypress.config.ci.js` — CI config (Chrome swiftshader WebGL for headless)
- `ci_scripts/` — write config, install Quench, run Cypress, wait for Foundry
- `docker/docker-compose.yml` — staged to `.foundry-docker/` in the consumer workspace

## Reference

[FoundryVTT-modern-names](https://github.com/Achoobert/FoundryVTT-modern-names) keeps a self-contained inline CI workflow as the reference implementation; this action mirrors that flow for other modules (e.g. Simple Requests).
