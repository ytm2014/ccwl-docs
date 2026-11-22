# App guide writing brief

Shared by everyone writing pages under `guide/`. Keep it next to the pages; `.mintlify/` is not published.

## What this section is

An end-user help centre for a white-label social media and messaging platform: how to use each part of
the dashboard. It is shared by every brand, so it never names a brand. Readers are workspace owners,
admins, members and viewers, not developers. Developer topics (REST API, webhooks payloads, MCP) already
have pages: link to them (`/quickstart`, `/authentication`, `/webhooks/overview`, `/mcp/overview`,
`/zapier`) instead of repeating them.

## Source of truth

The product is the repo `C:\Projects\OnlySocial Live`, ref `origin/single-wl-deployment`. Its working tree
is stale: read only with `git -C "C:\Projects\OnlySocial Live" show origin/single-wl-deployment:<path>`,
`git ls-tree -r --name-only origin/single-wl-deployment -- <dir>` and `git grep -n <pattern>
origin/single-wl-deployment -- <paths>`. Never read or edit working-tree files of that repo.

- Vue pages (since the Mixpost 7 re-base, 22 Nov 2026): white-label pages and outlets in
  `resources/wl/js/...`; core pages (posts, composer, calendar, queue, media, analytics, profile) in
  `vendor/inovector/mixpost-pro-team/resources/js/Pages/...`; enterprise settings, team and billing in
  `vendor/inovector/mixpost-enterprise/...`. Ignore `resources/wl-legacy/`.
- English UI text: resolve `$t('key')` with `tools/i18n/messages/en-GB.json` (`wl.*`, `salesbot.*`,
  `biolink.*` keys), `vendor/inovector/mixpost-pro-team/resources/lang-json/en-GB.json` and
  `vendor/inovector/mixpost-enterprise/resources/lang-json/en-GB.json`. Quote button, tab and field
  labels exactly as they appear, in **bold**.

**No invention.** Only describe screens, buttons, fields and behaviour you found in that source. If you
cannot confirm a detail, leave it out. Do not describe anything from other products (DMly, Mixpost docs).

## The product name

Pages never name a brand (no OnlySocial, Mixpost, DMly, Salesbot as a product name, Alex Social, ...).
Where the product's own name belongs, write the component and import it at the top of the page body:

```mdx
import { AppName } from "/snippets/app-name.jsx";

Sign in to <AppName /> with your email and password.
```

It renders "the app" by default and the reader's brand name when they arrive from their platform. So:

- Never start a sentence or heading with `<AppName />`, and never put it in frontmatter, headings,
  table headers, code blocks, card titles or link text.
- Every sentence must read naturally both as "the app" and as "Alex Social".
- Use it sparingly (a few times per page at most); "your workspace", "the dashboard" are often better.
- The messaging area is called **Salesbot** in a few places of the UI (a hard-coded label). Refer to it as
  "the sales inbox" or by the menu label the reader sees, and avoid presenting "Salesbot" as a brand.

## Features that may be missing

Many areas depend on the plan and on what the platform has switched on, and two sidebar layouts exist
(the classic sidebar and a newer sectioned one; labels can differ slightly, e.g. **Inbox** vs **Unified
Inbox**, **Links** vs **Short Links**). Write locations so they work in both ("In the sidebar, open
**Posts**"). Where an area is optional, add one line such as: "Don't see **Broadcasts**? Your plan or
your platform doesn't include it yet." Never mention environment variables, switches, config files,
route names or code.

Roles matter: say when something needs the **Admin** role (or an editor role) where the source enforces it.

## Page format

- MDX with frontmatter: `title` (sentence case, no brand), `description` (one sentence), `keywords` list.
  Optional `sidebarTitle` for short sidebar labels.
- Second person, active voice, plain British English as in the UI ("organise" only if the UI does;
  otherwise neutral). Sentence-case headings. No marketing language, no emoji.
- Structure: a one-paragraph intro, then task sections ("Create a post", "Schedule it") using `<Steps>`
  for procedures, tables for field lists, `<Note>`/`<Tip>`/`<Warning>` sparingly, and a short "Related"
  list of links at the end.
- No images or screenshots. Internal links are root-relative without extensions (`/guide/publishing/calendar`).
- Each page roughly 300–900 words. Prefer fewer, solid pages over thin ones.

## Deliverable

Write files only inside your assigned folder under `C:\Projects\ccwl-docs-app-guide\guide\`. Do not touch
`docs.json` or other folders. In your final report list each file with its title, and the exact order the
pages should appear in the sidebar (and any sub-groups you suggest), plus anything you could not confirm.
