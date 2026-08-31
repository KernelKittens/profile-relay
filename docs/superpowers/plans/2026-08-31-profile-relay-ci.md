# Profile Relay CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only GitHub CI for existing quality and browser checks and reduce Dependabot update noise.

**Architecture:** One workflow has independent Quality and Browser jobs. Existing root scripts remain the test interface. Quality explicitly generates Next.js route types before the clean-checkout typecheck. Dependabot keeps its weekly root schedules with lower caps.

**Tech Stack:** GitHub Actions, Node.js 24, npm workspaces, Next.js, Vitest, Playwright, Axe

## Global Constraints

- Work only in the task-owned AWS checkout based on public main commit `62845e282e9f97159230fec06e476945d3cec14f`.
- Preserve the reviewed design commit and this plan in the fast-forward history.
- The configuration commit may change only `.github/workflows/ci.yml` and `.github/dependabot.yml`.
- Do not edit application code, tests, package metadata, the lockfile, open pull requests, releases, deployments, branch protection, rulesets, or other repository settings.
- Do not add secrets, write permissions, self-hosted runners, artifacts, Docker builds, path filters, manual dispatch, or `pull_request_target`.
- Leave all five existing Dependabot pull requests open and unmodified.
- Pin external actions to the reviewed full commit SHAs and recheck those mappings immediately before push.
- Push only a verified fast-forward to public `main`. Never force-push.

## Baseline Evidence

The clean AWS checkout passed `npm ci` and lint. Its first typecheck failed at `apps/web/app/layout.tsx:9` because `LayoutProps` had not been generated. The installed Next.js 16.3.2 CLI and its bundled documentation confirm that `next typegen`, `next dev`, or `next build` generates that global helper.

Running this command from the repository root generated the missing ignored type files:

```sh
npm exec --workspace @bioctl/web -- next typegen
```

After that command, typecheck, 31 unit tests, the production build, and both Chromium end-to-end tests passed. The browser suite includes Axe checks for WCAG A and AA on both public tabs.

## Task 1: Add the CI safety net and lower Dependabot caps

**Files:**

- Create: `.github/workflows/ci.yml`
- Modify: `.github/dependabot.yml`

- [ ] **Step 1: Confirm the isolated starting point**

Run:

```sh
git merge-base --is-ancestor 62845e282e9f97159230fec06e476945d3cec14f HEAD
git status --short
```

Expected: the ancestry check exits 0 and the status is clean.

- [ ] **Step 2: Run the contract check before implementation**

Run:

```sh
test -f .github/workflows/ci.yml \
  && test "$(grep -c 'open-pull-requests-limit: 1' .github/dependabot.yml)" -eq 2
```

Expected: nonzero because the workflow is absent and both current limits are 5.

- [ ] **Step 3: Create the workflow**

Create `.github/workflows/ci.yml` with exactly:

```yaml
name: CI

"on":
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

env:
  CI: "true"

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Quality
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - name: Check out repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Generate Next.js route types
        run: npm exec --workspace @bioctl/web -- next typegen

      - name: Lint
        run: npm run lint

      - name: Type-check
        run: npm run typecheck

      - name: Run unit tests
        run: npm test

      - name: Build
        run: npm run build

  browser:
    name: Browser
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - name: Check out repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Install Chromium
        run: npx playwright install --with-deps chromium

      - name: Build
        run: npm run build

      - name: Run browser tests
        run: npm run test:e2e
```

- [ ] **Step 4: Lower both update caps**

Set `.github/dependabot.yml` to:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 1

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 1
```

- [ ] **Step 5: Run the contract check after implementation**

Run the Step 2 command again.

Expected: exit 0.

- [ ] **Step 6: Validate workflow syntax and exact policy**

Use actionlint v1.7.12 from its official GitHub release after verifying the published checksum. Then parse both YAML files and assert:

- events are only all pull requests and pushes to `main`
- workflow permissions are only `contents: read`
- `CI` is `"true"`
- concurrency matches the approved expression and cancels superseded runs
- both jobs use `ubuntu-24.04`, a 20-minute timeout, Node 24, npm caching, and the lockfile cache path
- both external actions use the reviewed full SHA and checkout does not retain credentials
- Quality runs install, type generation, lint, typecheck, unit tests, and build in that order
- Browser runs install, Chromium setup, build, and the full end-to-end script in that order
- both Dependabot entries keep weekly root schedules and have a cap of 1

Expected: actionlint and every assertion exit 0.

- [ ] **Step 7: Run the complete project checks**

From clean generated output, run:

```sh
npm ci
npm exec --workspace @bioctl/web -- next typegen
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run build
npm run test:e2e
```

Expected: lint and typecheck pass, 31 unit tests pass, the production build succeeds, and both Chromium end-to-end tests pass.

- [ ] **Step 8: Review the exact change**

Run:

```sh
git diff --check
git diff --name-only
git diff -- .github/workflows/ci.yml .github/dependabot.yml
```

Expected: no whitespace errors and exactly the two approved configuration paths.

- [ ] **Step 9: Commit the configuration**

Run:

```sh
git add .github/workflows/ci.yml .github/dependabot.yml
git commit -m "ci: add Profile Relay checks"
```

Expected: one commit containing only the two approved configuration files.

## Final Integration Gate

Before push, independently review the full branch, rerun the complete checks, fetch `origin/main`, and prove the branch remains a fast-forward from the unchanged public base. Recheck the action tag mappings and all five open Dependabot pull requests. Push `HEAD:main` only if every gate passes, then observe the hosted `main` workflow through completion. The pull request trigger is configured but cannot be called observed until a future pull request runs it.

After hosted verification, confirm the public main SHA, confirm the five pull requests remain open, save the exact recovery state, and remove the task-owned AWS instance, schedule, security group, volumes, and saved state.
