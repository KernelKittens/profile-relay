# bioctl design

Date: 2026-08-23
Status: approved direction
License target: Apache-2.0
Release home: Kernel Kittens

## Product

`bioctl` is a self-hosted, white-label link-in-bio site with a default Links tab, a separate AI Chat tab, a terminal control surface, Docker deployment, and bring-your-own-domain support.

The product has three replaceable parts:

1. The public site and API.
2. The owner CLI and settings menu.
3. An outbound connector that can use a model on the owner's machine.

Branding is data, not hard-coded UI. Names, colors, fonts, avatar, icon, profile copy, links, footer, social metadata, and feature visibility come from a validated site configuration.

## Trust zones

The application does not claim that a prompt can sandbox a model. Isolation comes from capabilities and process boundaries.

- Visitor input is untrusted data.
- Retrieved context is untrusted data, even when the owner supplied it.
- System instructions are application policy, but are never treated as a secret.
- The model is an untrusted text generator.
- Authorization, provider routing, context classification, budgets, and output rendering are enforced by deterministic code.
- The public model receives no shell, filesystem, browser, network, email, admin, or arbitrary function tools.

Visitor input and retrieved context are passed as separately typed fields. They are never interpolated into system instructions. Both are still treated as potentially hostile because an LLM may follow instructions found in either field.

## Context classes

Every context source has one routing class:

- `public`: may be sent to a hosted or local provider.
- `local-only`: may only be processed by the paired local connector.
- `disabled`: never indexed or sent to a model.

Cloud fallback is blocked when any selected context is `local-only`. This is enforced before provider invocation.

## Public chat

The initial chat is deliberately read-only:

- Owner-approved context only.
- Citations point to the supplied context entries.
- No uploads, arbitrary URLs, live browsing, tools, or agent actions.
- Strict input, output, concurrency, and daily budget limits.
- IP and session rate limits with an optional challenge provider.
- Escaped output with a small Markdown allowlist.
- Short, redacted operational logs. Chat bodies are not retained by default.

A successful injection can influence generated text. It cannot gain a new capability because the model has none.

## Provider router

Provider adapters expose one internal streaming contract:

- OpenAI Responses API.
- Anthropic Messages API.
- Generic OpenAI-compatible endpoint.
- Local connector for Ollama, LM Studio, llama.cpp, and similar servers.

Provider keys remain server-side or in the operator's local environment. They never enter browser JavaScript, site configuration exports, logs, or model prompts.

## Local connector

`bioctl bridge` pairs to one site using a one-time code. The resulting credential is scoped to a single tenant and connector identity.

The connector makes outbound HTTPS requests to claim signed, expiring jobs. It validates tenant, model allowlist, job expiry, nonce, input size, and context classification before calling a loopback or explicitly configured model endpoint. It cannot receive arbitrary URLs or command arguments from a job.

Tailscale is optional. A tagged Docker sidecar can provide private service-to-service transport, but the public browser never receives a tailnet address and never connects directly to the owner's machine.

## CLI

Running `bioctl` opens a keyboard-first terminal interface inspired by the focused Codex and Claude interaction loop without copying their branding.

Primary commands:

- `/site`, `/links`, `/theme`, `/domain`
- `/context`, `/provider`, `/model`
- `/connect`, `/limits`, `/deploy`
- `/doctor`, `/logs`, `/export`, `/quit`

The status bar shows the active site, provider, model, connector state, context class, and current request budget. Non-interactive subcommands expose the same operations for scripts.

## Deployment

The supported self-hosted path is Docker Compose with persistent data and configuration mounts. A reverse proxy terminates TLS for any owner-controlled domain. Optional profiles add a Tailscale sidecar or local connector without changing the public container.

The repository includes example configuration, health checks, secret placeholders, backup notes, upgrade notes, and a release-safe `.env.example`.

## Accessibility and presentation

The site is mobile-first and public-light by default. It keeps a visible way back, supports keyboard navigation, respects reduced motion and contrast preferences, exposes status changes to assistive technology, and ships an accessibility statement. The terminal remains fully usable without color.

## Open-source boundary

The public repository contains no personal links, provider keys, tailnet details, infrastructure addresses, private prompts, or deployment credentials. A neutral demo profile is the default. Kernel Kittens branding appears in project ownership and contributor material, while deployed sites can remove all project branding.

## Initial exclusions

The first release does not include autonomous tools, public file uploads, live web browsing, payments, multi-user teams, a plugin marketplace, or automatic public deployment. Those features require separate threat models.
