# Security policy

## Report a vulnerability

Use GitHub's private vulnerability reporting for this repository. Do not put exploit details, tokens, private chat content, or a live deployment URL in a public issue.

Include the affected commit, setup, exact request, observed result, and why it matters. A minimal reproduction is better than a broad scanner dump.

## Supported version

Security fixes target the latest commit on `main` until tagged releases begin.

## Deployment checklist

Before exposing a deployment:

- Replace every example link and email address.
- Use HTTPS.
- Use a random `BIOCTL_BRIDGE_TOKEN` with at least 32 characters.
- Keep `.env`, connector config, SQLite data, and model files out of Git.
- Leave `BIOCTL_TRUST_PROXY=false` unless a trusted reverse proxy replaces forwarding headers.
- Restrict the app port so visitors can reach it only through the intended proxy.
- Run the container as shipped: non-root, read-only root filesystem, no capabilities.
- Put a request limit at the reverse proxy too. The built-in limiter is per process.
- Review context classifications before switching from a local model to a cloud provider.
- Give the local model runtime no files, devices, tools, or network access it does not need.
- Keep Docker, Node, and model runtimes patched.

## Prompt injection

No model has complete prompt injection immunity. The boundary here is capability-based:

1. Visitor input is untrusted data.
2. Retrieved context is untrusted data.
3. Neither one becomes a system instruction.
4. The model has no tools.
5. Local-only context fails closed for cloud providers.
6. Output is bounded and displayed as plain text.

A successful prompt injection can still make the model produce a bad answer. It should not become a path to execute code, fetch URLs, read files, send email, or access an account because those capabilities are absent.

## Connector boundary

The website cannot choose the connector's model URL. The local connector accepts only:

- Loopback
- RFC1918 private IPv4 ranges
- Tailscale's `100.64.0.0/10` CGNAT range

It rejects public addresses, link-local metadata addresses, and non-HTTP protocols. A relay job contains only a model name, short-lived job ID, expiry, and message text. It does not contain a command, tool definition, endpoint, token, or filesystem path.

## Known limits

- The built-in rate limiter is process-local. Use one web replica or add a shared edge limit.
- The relay database is intended for a single Docker instance. Multi-replica deployments need a shared transactional store.
- Saved connector secrets rely on host filesystem permissions. Use environment injection or an OS secret manager on shared machines.
- Context retrieval is currently a bounded configured list, not a crawler. This keeps the trust boundary small.
