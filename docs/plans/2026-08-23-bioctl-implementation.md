# bioctl implementation plan

Date: 2026-08-23

## 1. Establish the monorepo

Create npm workspaces for `apps/web`, `apps/cli`, and `packages/core`. Add shared TypeScript settings, formatting, linting, test commands, Apache-2.0 licensing, release-safe ignores, and contributor guidance.

Verification: clean install, workspace typecheck, and an empty test run all succeed.

## 2. Define security and configuration contracts

Write failing tests for brand configuration, context classes, provider routing, prompt envelopes, chat limits, and local-only fallback blocking. Implement Zod schemas and pure routing functions in `packages/core`.

Verification: malicious or malformed configuration is rejected, and local-only context cannot select a cloud provider.

## 3. Build the white-label public shell

Replace the generated Next.js page with a mobile-first profile card, Links tab selected by default, Chat tab, theme tokens, reduced-motion support, focus states, accessible status messaging, and neutral demo content.

Verification: component tests cover keyboard tab switching, link semantics, focus behavior, and the default selected tab.

## 4. Add safe chat handling

Add a validated chat route with separate instruction, visitor-input, and retrieved-context fields. Enforce request size, output size, rate, concurrency, timeout, and budget boundaries before invoking a provider. Sanitize rendered output and return citations from approved context entries.

Verification: prompt-injection strings remain visitor data, HTML is escaped, missing citations fail validation, and provider errors fail closed.

## 5. Add provider adapters

Implement OpenAI, Anthropic, generic OpenAI-compatible, and mock adapters behind one streaming interface. Keep credentials server-only and redact provider errors.

Verification: mocked provider contract tests cover streaming, cancellation, timeout, malformed events, and secret redaction.

## 6. Add the outbound connector protocol

Create persistent bridge jobs with signed tenant-scoped claims, expiry, nonce replay protection, model allowlists, and explicit context classifications. Add claim, result, heartbeat, and health endpoints.

Verification: cross-tenant access, expired jobs, replay, oversized results, arbitrary endpoints, and cloud fallback for local-only context are rejected.

## 7. Build the CLI

Create the keyboard-first `bioctl` terminal, first-run setup, settings views, diagnostic checks, and `bioctl bridge`. Store non-secret preferences in the user config directory and require secrets through environment variables or the operating-system secret store.

Verification: command tests cover first-run flow, non-interactive output, offline behavior, connector cancellation, and no-color mode.

## 8. Package self-hosting

Add multi-stage Docker builds, Docker Compose, persistent data mounts, health checks, a local connector profile, and an optional Tailscale sidecar example using scoped credentials.

Verification: images build, containers start without secrets, health checks pass, and no task-owned secret appears in image history or exported configuration.

## 9. Release checks

Run unit, integration, browser, accessibility, dependency, container, and secret scans. Render the site at phone and desktop widths and fix visible defects. Confirm documentation, license notices, issue templates, security policy, and neutral demo data before creating the Kernel Kittens public repository.

Verification: all required checks pass from a clean clone and the release artifact contains no personal or infrastructure data.
