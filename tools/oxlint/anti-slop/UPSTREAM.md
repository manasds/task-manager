# anti-slop provenance

- Source: https://github.com/dmmulroy/anti-slop
- Commit: `13909c9e07590f5a85d93c62712259fe14a883f7` (2026-10-13), path `skills/install-anti-slop/assets/anti-slop`
- Verified: this directory was identical to that commit's assets when installed on 2026-10-24.
- Installed plugin: `tools/oxlint/anti-slop/index.ts`, registered as `anti-slop` in `.oxlintrc.json`.
- Not installed: the Effect plugin (`effect/index.ts`), because the project does not depend on `effect`.
- Vendored Stylistic code keeps its own license and provenance in `vendor/eslint-stylistic/`.

## Local deviations

None to the plugin source. To support it, `tsconfig.json` sets `allowImportingTsExtensions`, because the rules import `.ts` paths and the app type-check includes them.
