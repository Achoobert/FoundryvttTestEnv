# FoundryvttTestEnv

Composite GitHub Action: Foundry Docker (felddy), Quench, Cypress E2E against **your module repo** workspace (`$GITHUB_WORKSPACE`).

```yaml
- uses: Achoobert/FoundryvttTestEnv@0.0.1
  with:
    foundry_version: '14.364'
    foundry_world: my-module-test
    quench_tests_path: ./quench
    quench_build_command: npm run quench:build
    test_command: npm run test:ci
    foundry_username: ${{ secrets.FOUNDRY_USERNAME }}
    foundry_password: ${{ secrets.FOUNDRY_PASSWORD }}
    foundry_admin_key: ${{ secrets.FOUNDRY_ADMIN_KEY }}
```

Composite actions use **inputs only** — pass Foundry credentials as `foundry_username`, `foundry_password`, `foundry_admin_key` (from your repo secrets).

## Consumer contract

### Required in your job before calling the action

- `npm ci` (and any build that copies your **main module** into `foundrydata/Data/modules/<id>`).
- Repo secrets: `FOUNDRY_USERNAME`, `FOUNDRY_PASSWORD`, `FOUNDRY_ADMIN_KEY`.
- `permissions: actions: write` on the workflow (for Foundry distribution cache).

### Optional `fvtt.config.example.js` at repo root

If present (see `fvtt_config_path` input), merged into generated `fvtt.config.js`. Useful keys:

- `testWorldName`, `testModuleIds`, `dockerContainerName`
- `quenchManifestUrl`, `testSystemManifestUrl`

If missing, the action synthesizes config from inputs (`foundry_world`, derived `testModuleIds`, etc.).

### `quench_tests_path`

Local directory with `module/module.json` and a webpack (or other) build. The action:

1. Writes `fvtt.config.js` in that folder with `userDataPath` pointing at workspace `foundrydata/`.
2. Runs `quench_build_command` or `npm --prefix <path> run build`.
3. Ensures output lives under `foundrydata/Data/modules/<tests-module-id>`.

**TODO:** support `quench_tests_path` as a git repository URL (clone + build).

### Main module

The action does **not** build your primary module. Use `build_script` / pre-steps so `foundrydata/Data/modules/<your-module-id>` exists before Cypress runs.

## Layout

- `action.yml` — composite steps
- `ci_scripts/` — write config, install Quench, wait for Foundry
- `docker/docker-compose.yml` — staged to `.foundry-docker/` in the consumer workspace

## Reference

[FoundryVTT-modern-names](https://github.com/Achoobert/FoundryVTT-modern-names) keeps a self-contained inline CI workflow as the reference implementation; this action mirrors that flow for other modules (e.g. Simple Requests).
