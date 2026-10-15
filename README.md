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
