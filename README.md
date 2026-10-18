# Developer docs

Brand-neutral developer documentation shared by every white-label instance. Built with Mintlify; pushes to `main` deploy automatically.

## Rules

- Never name the platform, a white-label brand or its domain. Use `app.example.com` for the reader's domain.
- Document only what is shipped. Plans and rollout notes stay in the app repo.

## Local preview

```bash
npx mint dev
```

## Regenerating the Messaging API reference

`api-reference/messaging.openapi.json` is generated from the app repo's `docs/api/manifest/*.json`:

```bash
node scripts/build-messaging-openapi.mjs <path-to-app>/docs/api/manifest
```

## Each platform's own domain in the examples

The examples use `app.example.com` (and `/os/` for the Publishing API). Every white-label platform
links here from its API pages as `https://workspace.guide/?domain=<its domain>&core=<its dashboard
path>`; `domain.js` (Mintlify loads every `.js` file on every page) remembers that for the visit and
swaps it into the text, code samples, links and copy buttons. Without a domain nothing changes.
Keep using `app.example.com` and `https://{domain}` in new pages and the OpenAPI files.
