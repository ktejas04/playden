# 001 — Workspace tooling
Phase: 2 (Setup)
Depends on: —
Touches: package.json, pnpm-workspace.yaml, tsconfig.base.json, eslint.config.js, .prettierrc.json, .prettierignore, .gitignore, .gitattributes, .githooks/pre-commit, vitest.config.ts
Spec: docs/PROJECT.md#tech-stack-and-repo-layout, #code-practices-and-modularity

## Steps
1. Root `package.json` (private, `packageManager` pinned to the installed pnpm, `engines.node` >= 20) with scripts: `dev`, `build`, `typecheck`, `lint`, `format`, `format:check`, `test`, `prepare`.
2. `pnpm-workspace.yaml` covering `apps/*`, `packages/*`, `packages/games/*`.
3. `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, ES2022, bundler resolution.
4. ESLint flat config with `typescript-eslint` (strict, `no-explicit-any` as error). Prettier config. Root Vitest config using `projects` (empty list is fine for now; `passWithNoTests`).
5. `.gitignore`: `node_modules`, `dist`, `.wrangler`, `.dev.vars`, `*.local`, coverage. `.gitattributes`: `* text=auto eol=lf`.
6. `.githooks/pre-commit` runs `pnpm lint && pnpm format:check`; `prepare` sets `git config core.hooksPath .githooks` (D24).
7. `pnpm install`.

## Done when
- [ ] `pnpm install` succeeds in PowerShell
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` exit 0
- [ ] The pre-commit hook runs on `git commit`
