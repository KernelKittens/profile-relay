# bioctl

A white-label link page with a small, isolated AI chat and a terminal settings harness.

Links open first. Chat is a separate tab. The site owner controls the name, copy, colors, links, model provider, model, context, domain, and whether any bioctl credit appears. The default footer is blank.

This is a Kernel Kittens open-source project under Apache-2.0.

## Why this is custom

We checked the current self-hosted options before building. LittleLink is an excellent MIT-licensed static link page, but it has no server or chat boundary. LinkStack and Nexo Links add multi-user dashboards, databases, and product weight that this project does not need. The chat relay and local connector are the important part here, so a small purpose-built codebase is easier to audit.

## What is included

- Mobile-first profile page with Links selected by default
- Optional Chat tab with plain-text output
- JSON white-label configuration
- OpenAI Responses API, Anthropic Messages API, generic OpenAI-compatible API, and a local connector
- Local-only context that is blocked from cloud providers
- Outbound connector for Ollama, LM Studio, llama.cpp, and similar OpenAI-compatible local servers
- Persistent SQLite relay jobs with short expiry and connector-bound leases
- Terminal settings harness inspired by coding-agent CLIs
- Docker image, Compose file, health check, and custom-domain recipe
- Keyboard navigation, reduced-motion support, and accessible labels

## Security model

Prompt injection protection is not a magic filter. bioctl makes the model low-consequence instead:

- The model receives no tools, browser, filesystem, email, account, shell, or arbitrary network access.
- Trusted instructions, retrieved context, and visitor input are separate messages.
- Context text and visitor text are escaped as untrusted data.
- Context is classified as `public`, `local-only`, or `disabled`.
- `local-only` context cannot be sent to OpenAI, Anthropic, or a remote compatible provider.
- The local connector chooses its own model endpoint. A website visitor cannot change it.
- The connector accepts only loopback, private LAN, and Tailscale CGNAT model endpoints.
- Relay tokens must be at least 32 characters. Jobs expire after two minutes.
- The public chat endpoint has bounded request size, bounded output, and a rate limit.
- Model output renders as text, not HTML.

The local model runtime is still a separate process. Run it as an unprivileged user or container, give it no host mounts, and block outbound network access if the runtime does not need it. bioctl does not pretend a system prompt is a sandbox.

## Quick start with Docker

Requirements: Docker Engine with Compose v2.

```sh
cp .env.example .env
docker compose up -d --build
```

Open `http://localhost:3000`. The demo provider works without an API key.

Before using the local provider, generate a bridge token and put it in `.env`:

```sh
openssl rand -hex 32
```

The container runs as a non-root user with a read-only root filesystem, no Linux capabilities, and a persistent data volume for relay state.

## White-label settings

Edit these files directly or run the terminal harness:

- `config/site.json`: identity, colors, links, provider, model, limits, footer
- `config/context.json`: public, local-only, or disabled context entries

Build and open the harness:

```sh
npm ci
npm run build --workspace @bioctl/core
npm run build --workspace @bioctl/cli
node apps/cli/dist/index.js
```

The menu uses slash commands:

```text
/site /links /theme /provider /model /context /limits
/connect /domain /doctor /export /help /quit
```

`/doctor` catches invalid JSON, placeholder links, and missing provider settings. Config writes are validated and replaced atomically.

## Model providers

Set `chat.provider` and `chat.model` in `config/site.json`.

| Provider | Value | Server setting |
| --- | --- | --- |
| Demo | `mock` | None |
| Local connector | `local` | `BIOCTL_BRIDGE_TOKEN` |
| OpenAI | `openai` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` |
| OpenAI-compatible | `compatible` | `BIOCTL_COMPATIBLE_BASE_URL`, optional API key |

Remote compatible endpoints must use HTTPS. Loopback development endpoints may use HTTP.

Cloud API keys stay on the server. They are never included in page data or connector jobs.

## Local model connector

The connector runs beside your model, usually on your PC. It polls the site over HTTPS, sends a claimed job to the configured local OpenAI-compatible endpoint, and posts back plain text. Nothing needs an inbound port on your home network.

In the terminal harness, run `/connect` and enter:

- Public site URL
- The same bridge token used by the server
- Local model endpoint, such as `http://127.0.0.1:11434`
- Allowed model names

Then start it:

```sh
node apps/cli/dist/index.js bridge
```

Environment variables can replace the saved connector file:

```text
BIOCTL_SITE_URL
BIOCTL_BRIDGE_TOKEN
BIOCTL_CONNECTOR_ID
BIOCTL_MODEL_ENDPOINT
BIOCTL_MODELS
```

## Tailscale

The connector is outbound-only, so a public HTTPS site does not require Tailscale. If the site should remain tailnet-only, run the container on a machine with Tailscale and publish the local port with Tailscale Serve:

```sh
tailscale serve --bg http://127.0.0.1:3000
```

Use the resulting `https://...ts.net` address as `BIOCTL_SITE_URL`. For a containerized Tailscale client, persist `TS_STATE_DIR` so the node identity survives restarts. Keep auth keys in `.env`, never in Compose or Git.

## Bring your own domain

Point the domain to the host, then reverse proxy to port 3000. A minimal Caddy block is:

```caddyfile
bio.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

If Caddy is the only public path, set `BIOCTL_TRUST_PROXY=true` and make sure direct access to port 3000 is blocked. The proxy must replace, not append untrusted, forwarding headers.

## Development

Node 22.12 or newer is required. This repository currently builds on Node 24 LTS.

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

## Data and privacy

- The site stores local relay jobs in `data/relay.sqlite`.
- Jobs expire quickly and old rows are removed.
- Chat content is not written to application logs.
- Provider requests follow the provider's own data policy.
- The connector config contains a secret. Its file is written with owner-only permissions where the operating system supports them.

Review `SECURITY.md` before exposing the chat publicly.

## License

Apache License 2.0. See `LICENSE`.
