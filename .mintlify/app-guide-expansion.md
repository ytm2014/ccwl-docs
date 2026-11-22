# App guide expansion brief (23 Nov 2026)

Read `.mintlify/app-guide-brief.md` first: everything in it still applies (source of truth, no invention,
`<AppName />`, no brand, format). This file adds what changes for the expansion.

## Why

The first app guide (43 pages under `guide/`) is too coarse: one page per area. DMly's help centre
(`C:\Projects\dmly-docs`, pages listed in its `docs.json`) has a page per task — the Automation group
alone has 22 pages. The owner wants the same depth.

## Using DMly's docs

The white label's messaging side (the sales inbox, Contacts, Flows, Broadcasts, Appointments, AI
Knowledge, ...) is a port of DMly's, so DMly's pages are an excellent **checklist of topics** and a
model for depth, tone and structure. Read the DMly pages for your area to see what a complete page
covers.

But DMly's text is NOT a source of truth for this product:

- For every topic, find the feature in the white-label code (`origin/single-wl-deployment`, see the main
  brief). If it is not there, there is no page. Several DMly areas do not exist here at all (Offerings,
  Finance, Reputation, the mobile app, DMly's agency programme as written, WhatsApp calling unless you
  find it).
- Every button, label, field, limit and behaviour you write must be confirmed in that code. Labels and
  behaviour often differ from DMly. Rewrite in your own words; never copy DMly sentences, and never name
  DMly.
- If DMly describes a detail you cannot confirm here, leave it out.

## Depth

- One page per task or concept, as in DMly (roughly 400–1,200 words each). A topic that the old page
  covered in one paragraph probably deserves its own page now.
- Cover settings tables, every option of a step or trigger, limits, what the reader sees when something
  goes wrong, and a "Troubleshooting" or "Common questions" section where the code shows failure modes.
- Plan and switch notes as in the main brief ("Don't see X? Your plan or your platform doesn't include
  it yet.").

## Folders and old pages

You own only the folders and old pages listed in your assignment. You may rewrite, split or delete the
old pages you own. When you delete or move one, list it in your report as a redirect `old path -> new
path` so links keep working. Link to other areas by the paths in the "Site map" below; if a page you
link to is not listed, link to its area's first page.

## Site map (new structure; pages are being written in parallel)

- `guide/getting-started/` (introduction, navigating, workspaces, social-accounts stay)
- `guide/publishing/` publishing, per-network options, approvals, calendar, queue, media, analytics
- `guide/inbox/` the Inbox and conversations
- `guide/channels/` connecting each messaging channel, channel troubleshooting
- `guide/contacts/` contacts and CRM
- `guide/automation/` Flows, triggers, steps, AI replies, comment automation, ...
- `guide/broadcasts/` broadcasts, WhatsApp templates, audiences, growth tools
- `guide/appointments/` appointments and meetings
- `guide/analytics/` sales-inbox reports
- `guide/account/` profile, security, team, roles, notifications, workspace settings
- `guide/billing/` plans, add-ons, upgrading, cancelling
- `guide/bio-links/` (unchanged)
- `guide/integrations/` one page per integration
- `guide/troubleshooting/` cross-area troubleshooting

## Report

List every file (path, title, sidebarTitle), the sidebar order with any sub-groups, redirects for old
pages you removed, and what you could not confirm. Keep the report short; do not paste page content.

## Sidebar: one layout only (owner, 23 Nov 2026)

There is only ONE sidebar layout for everyone. The "classic sidebar" and the "older sidebar" have been
dropped. Never describe several layouts, never write "depending on your layout", and remove any such
table or wording from pages you own. The sidebar is (top to bottom):

- **New post** button
- **Home**, **Analytics**, **Inbox**
- **Content** section: **Posts** (folds open: **All Posts**, **Queue**, **Templates**, **Bulk Posts**,
  **RSS Campaigns**), **Calendar**, **Media Library**
- **Engagement & Automation** section: **Salesbot** (opens its own menu: Overview, Contacts, Flows,
  Broadcasts, More ...), **Bio Links** (opens its own menu)
- At the bottom: **Settings** (opens its own menu), **Accounts**, **Integrations**
- Top bar: workspace switcher (top left), notifications bell and your user menu (top right)

Confirm the items inside the Salesbot, Bio Links and Settings menus in the code
(`resources/wl/js/Components/Shell/`, sidebar sections / product nav) and write locations as paths such
as "In the sidebar, open **Salesbot** > **Contacts**".
