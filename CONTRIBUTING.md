# Contributing

Small, reviewable changes are welcome.

## Before coding

Open an issue for a new provider, storage backend, public tool capability, authentication system, or major UI change. Those alter the security or product boundary.

Straightforward bug fixes, accessibility fixes, tests, and documentation corrections can go directly to a pull request.

## Local checks

Use Node 22.12 or newer.

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
docker compose build
```

Do not commit `.env`, connector settings, databases, logs, model files, visitor messages, or real personal profile data.

## Code rules

- Keep provider secrets server-only.
- Do not add tools to model requests.
- Treat visitor input and retrieved content as untrusted data.
- Keep local-only context fail-closed for cloud providers.
- Validate configuration before writing it.
- Add a test for every interactive control and security boundary you change.
- Use plain text for model output unless a separate sanitizer and tests are added.
- Keep the site usable with a keyboard and reduced motion.

## Pull requests

Explain the behavior change, security impact, test evidence, and any migration step. Screenshots help for visual work, but they do not replace keyboard and accessibility checks.

By contributing, you agree that your contribution is licensed under Apache-2.0.
