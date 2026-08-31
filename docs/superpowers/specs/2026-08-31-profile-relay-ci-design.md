# Profile Relay CI design

Status: Approved design, implementation not started
Date: 2026-08-31
Repository: KernelKittens/profile-relay
Base commit: 62845e282e9f97159230fec06e476945d3cec14f

## Boundary

This document defines a private, design-only change. Writing and committing this specification does not change the public repository, open pull requests, branch settings, releases, deployments, or user data.

A later implementation may change only the CI workflow and Dependabot limits described here. Public push, pull request creation, merge, and branch protection remain separate approval gates.

## Current state

The repository has root scripts for linting, type checking, unit tests, application builds, and Playwright end-to-end tests. The Playwright suite also runs Axe checks for WCAG A and AA rules on both public tabs.

There is no repository-owned file under .github/workflows. GitHub therefore has no project CI check to run on pull requests or pushes to main.

Five Dependabot pull requests are open for major development dependency updates. They were opened from an older main commit and have no project CI result. They must stay open and unmerged during this change.

The GitHub Actions Dependabot updater failed in run 33317130881 because it could not find an action manifest or workflow file to update.

## Goals

- Run the repository's existing quality checks on every pull request and every push to main.
- Run browser and Axe coverage in a separate job so failures are easy to classify.
- Use a read-only token, no repository secrets, and no retained checkout credentials.
- Pin every external action to a full commit SHA.
- Bound runner time and cancel superseded runs.
- Reduce new Dependabot noise to one npm pull request and one GitHub Actions pull request at a time.
- Leave all five existing Dependabot pull requests untouched.

## Non-goals

- Do not update application code, tests, documentation outside this specification, package manifests, or the lockfile.
- Do not merge, close, rebase, or edit the five open Dependabot pull requests.
- Do not add auto-merge, dependency groups, ignore rules, labels, comments, releases, deployments, or write permissions.
- Do not add branch protection or a repository ruleset. CI is advisory until that separate administrative change is approved.
- Do not add path filters or manual dispatch.
- Do not upload Playwright traces, screenshots, build output, or other artifacts.
- Do not add a Docker or Docker Compose build to this first workflow. CONTRIBUTING.md keeps docker compose build as a local check. CI coverage for it needs a separate runtime and maintenance decision.

## Chosen approach

Add one workflow at .github/workflows/ci.yml with two independent jobs named Quality and Browser.

This keeps routine static and unit failures separate from browser setup and end-to-end failures. A single job would use fewer repeated setup steps, but it would hide which class of check failed and make the slower browser work block basic feedback. More than two jobs would repeat installation work without enough benefit for this repository.

Both jobs use GitHub-hosted ubuntu-24.04 runners and Node 24, matching the version named in README.md. The package engine remains Node 22.12 or newer.

## Workflow contract

### Events and permissions

The workflow runs for:

- Every pull_request event.
- Every push to main.

It does not use pull_request_target. It has workflow-level permissions with contents: read and no write permission.

The workflow sets CI to true so Playwright rejects focused tests and applies its configured CI retries.

Concurrency uses this group:

~~~text
${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
~~~

cancel-in-progress is true. A newer run for the same pull request or ref cancels the older run.

No path filter is allowed. Root package, workspace, test, workflow, and documentation changes can affect the result.

### Shared setup

Each job must:

1. Set timeout-minutes to 20.
2. Check out the tested commit with actions/checkout pinned to 3d3c42e5aac5ba805825da76410c181273ba90b1, documented as v7.0.1.
3. Set persist-credentials to false on checkout.
4. Set up Node 24 with actions/setup-node pinned to 820762786026740c76f36085b0efc47a31fe5020, documented as v7.0.0.
5. Enable setup-node's npm cache with package-lock.json as cache-dependency-path.
6. Run npm ci.

The job command lists below restate npm ci. It runs once per job.

The npm cache is the only workflow cache. node_modules is never cached.

The pinned action SHAs were verified against the official action repositories on 2026-08-31. Implementation must recheck the tag-to-commit mapping immediately before a public push.

### Quality job

The Quality job runs these commands in order:

~~~sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
~~~

Every command fails the job on a nonzero exit. No step uses continue-on-error.

### Browser job

The Browser job runs these commands in order:

~~~sh
npm ci
npx playwright install --with-deps chromium
npm run build
npm run test:e2e
~~~

The build must finish before Playwright starts because playwright.config.ts launches the production Next server with npm run start --workspace @bioctl/web.

The existing test:e2e script supplies the required browser and Axe coverage. The workflow must not replace it with a smaller test selection. The current suite covers mobile interaction, keyboard focus, both Links and Chat tabs, and WCAG A and AA Axe tags.

A GitHub-hosted runner starts clean, so Playwright cannot reuse a server from another task. No deployment or external base URL is involved.

## Dependabot contract

Update .github/dependabot.yml without changing its weekly schedules or root directories.

Set:

- npm open-pull-requests-limit to 1.
- github-actions open-pull-requests-limit to 1.

Do not add grouping, ignore rules, labels, reviewers, or auto-merge. The CI and Dependabot commits must not close or merge an existing pull request. While an ecosystem's current version-update count is above its cap, Dependabot must not open another version-update pull request for that ecosystem.

## Trust and data handling

Pull request code runs only on a GitHub-hosted runner with a read-only repository token. The workflow passes no repository or environment secrets. Checkout credentials are removed after checkout.

The workflow does not run on self-hosted infrastructure, deploy an application, contact a model service, persist a relay database, or upload test artifacts. Test output remains in the job log and temporary runner filesystem.

## Failure behavior

A failed command produces a failed job. A canceled superseded run remains distinguishable from a test failure.

If npm ci fails, later steps in that job do not run. If the application build fails in Browser, Playwright does not start. If Playwright or Axe fails, Browser fails even if Quality passed.

An implementation failure that requires application code, tests, package metadata, or lockfile changes is a scope break. Stop and revise the plan instead of including those changes in the CI commit.

## Verification plan

Before committing the implementation in an isolated development checkout:

1. Confirm the checkout still starts from the intended public main commit and has no unrelated changes.
2. Validate .github/workflows/ci.yml with actionlint.
3. Parse both YAML files and confirm the event scope, read-only permission, concurrency, timeouts, runner, Node version, full action pins, checkout credential setting, cache path, command order, and Dependabot limits.
4. Run the Quality command sequence from a clean npm ci.
5. Install Chromium with Playwright dependencies, build the application, and run npm run test:e2e.
6. Run git diff --check and confirm only .github/workflows/ci.yml and .github/dependabot.yml changed.
7. Recheck the five open Dependabot pull requests and confirm none changed state.

After a separately approved public push:

1. Observe one hosted pull request run and confirm both Quality and Browser pass.
2. Observe the resulting hosted main run and confirm both jobs pass.
3. Confirm workflow permissions remain read-only and no unexpected artifact, deployment, comment, or release was created.
4. Do not call CI operational or enforced until these hosted checks are observed. Enforcement still requires separate branch protection approval.

## Rollback

Revert the CI and Dependabot configuration commit. This removes the repository-owned workflow and restores the previous Dependabot limits without changing application data or closing the five existing pull requests.

## Acceptance criteria

- This design is committed privately before implementation starts.
- The later implementation changes only .github/workflows/ci.yml and .github/dependabot.yml.
- Quality runs lint, typecheck, unit tests, and the full application build.
- Browser installs Chromium, builds before starting the production server, and runs the full Playwright and Axe suite.
- Both jobs use Node 24, ubuntu-24.04, 20-minute timeouts, read-only permissions, no secrets, and full action SHA pins.
- Superseded runs are canceled by workflow and pull request or ref.
- Dependabot limits are one for npm and one for GitHub Actions.
- The existing five Dependabot pull requests remain open and unmerged.
- No public reference or repository setting changes during design or private implementation.
- Hosted CI and any later enforcement are verified through separate approved gates.
