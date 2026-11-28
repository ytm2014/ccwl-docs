// Builds api-reference/messaging.openapi.json from the platform's API manifests.
//
//   node scripts/build-messaging-openapi.mjs <manifest-dir>
//
// <manifest-dir> holds the per-module JSON manifests the platform ships in
// docs/api/manifest/. The legacy per-product webhook module is skipped: these
// docs point integrators at the shared workspace webhooks instead.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/build-messaging-openapi.mjs <manifest-dir>');
  process.exit(1);
}

// Route name => unified key scope (from the platform's API scope registry).
const SCOPES = {
  'account.show': null,
  'channels.index': 'channels:read', 'channels.show': 'channels:read',
  'contacts.index': 'contacts:read', 'contacts.show': 'contacts:read',
  'contacts.store': 'contacts:write', 'contacts.bulk': 'contacts:write', 'contacts.update': 'contacts:write',
  'contacts.destroy': 'contacts:write', 'contacts.tags.add': 'contacts:write', 'contacts.tags.remove': 'contacts:write',
  'contacts.notes.store': 'contacts:write', 'contacts.stage.update': 'contacts:write',
  'tags.index': 'contacts:read', 'tags.show': 'contacts:read',
  'tags.store': 'contacts:write', 'tags.update': 'contacts:write', 'tags.destroy': 'contacts:write',
  'segments.index': 'contacts:read', 'segments.show': 'contacts:read', 'segments.contacts': 'contacts:read',
  'segments.store': 'contacts:write', 'segments.update': 'contacts:write', 'segments.destroy': 'contacts:write',
  'conversations.index': 'conversations:read', 'conversations.show': 'conversations:read',
  'conversations.messages': 'conversations:read',
  'conversations.read': 'conversations:write', 'conversations.unread': 'conversations:write', 'conversations.status.update': 'conversations:write',
  'conversations.assignee.update': 'conversations:write', 'conversations.bot.update': 'conversations:write',
  'conversations.blocked.update': 'conversations:write', 'conversations.notes.store': 'conversations:write',
  'messages.store': 'messages:send',
  'broadcasts.index': 'broadcasts:read', 'broadcasts.show': 'broadcasts:read', 'broadcasts.recipients': 'broadcasts:read',
  'broadcasts.store': 'broadcasts:write', 'broadcasts.update': 'broadcasts:write', 'broadcasts.destroy': 'broadcasts:write',
  'broadcasts.approve': 'broadcasts:write', 'broadcasts.send': 'broadcasts:write',
  'automations.index': 'automations:read', 'automations.show': 'automations:read',
  'automations.activate': 'automations:write', 'automations.pause': 'automations:write',
  'media.index': 'media:read', 'media.show': 'media:read',
  'media.store': 'media:write', 'media.destroy': 'media:write',
};

const SKIP_MODULES = new Set(['Webhooks']);

// Personal access tokens name the workspace in this header; a workspace API key may send it too.
const WORKSPACE_HEADER = {
  name: 'X-Workspace',
  in: 'header',
  required: false,
  schema: { type: 'string', format: 'uuid' },
  description: "The workspace UUID. Required with a personal access token. A workspace API key can leave it out; if sent, it must be the key's own workspace.",
};

// Tag notes that replace the manifest's, and sentences added to an endpoint's description.
const TAG_NOTES = {
  Account: 'No workspace id appears in any /api/v1 URL. A workspace API key selects its own workspace; a personal access token names it in the `X-Workspace` header.\n\n'
    + 'A workspace API key acts as the member who created it, and a personal access token acts as its owner. The API shows and changes only what that person could in the dashboard: a member limited to some channels sees only the contacts and conversations on those channels, a role that sees only its own assigned conversations sees only those in the conversation and message endpoints, and a role that hides phone numbers or email addresses gets them masked. A contact or conversation that person cannot see answers 404.',
  Channels: 'Read-only: connecting a channel is an OAuth flow that happens in the dashboard. A whitelabel partner can also start one with the separate partner API; see [Client Connect API](/partner/client-connect).',
  Contacts: 'custom_fields is a flat {key: value} map. An empty map is returned as {} so client-side property access is always safe.\n\n'
    + 'When the person behind the key has a role that hides phone numbers or email addresses, `phone`, `email` and the WhatsApp or SMS `handle` come back masked (for example `••••••••3456` and `j•••@example.com`), and searching with `q` matches those fields only by their whole value. Sending a masked value back in an update leaves the stored value unchanged.',
};
const EXTRA_NOTES = {
  'account.show': ' With a personal access token, it returns the workspace named in `X-Workspace`.',
  'contacts.store': " At the plan's total contacts limit the request is refused with 422 and an error on `name`. Contacts who have only commented publicly do not count toward the limit.",
  'contacts.update': ' `PATCH` works the same way. A phone number must be in full international form and cannot belong to another contact. `custom_fields`, when sent, replaces the whole map. The channel of an existing contact cannot be changed here.',
  'tags.update': ' `PATCH` works the same way.',
  'segments.update': ' `PATCH` works the same way.',
  'broadcasts.update': ' `PATCH` works the same way.',
  'messages.store': "\n\nThe contact must be one the person behind the key can see, otherwise the request answers 404. "
    + 'A template sent without `channel` goes to the contact\'s WhatsApp, even when they last wrote on another channel. '
    + "At the plan's active contacts limit, direct messages go only to contacts active in the last 30 days; anyone else is refused with `reason: active_contacts_limit`. Public comment replies (`kind: comment`) are not limited. "
    + 'Retrying with the same `Idempotency-Key` after a successful send is refused with `reason: already_attempted`, so check the conversation before sending again.',
};

// Manifest sentences that no longer match the code, swapped exactly (a missing one stops the build).
const DESCRIPTION_FIXES = {
  'broadcasts.store': [[
    '; set message.track_clicks to false to send them unchanged.',
    '. Tracking follows the workspace setting; `message.track_clicks` is ignored.',
  ]],
};

// Example bodies the manifests get wrong: a broadcast's message is `text` (or `template` + `parameters`).
const BODY_PATCHES = {
  'broadcasts.store': { message: { text: '20% off this week.' } },
  'broadcasts.update': { message: { text: '25% off this week.' } },
};

// Request bodies written out in full, where the manifest's example shows only some fields.
const BODIES = {
  'messages.store': {
    type: 'object',
    required: ['contact_id'],
    properties: {
      contact_id: { type: 'string', format: 'uuid', description: 'The contact (conversation) to send to.' },
      type: { type: 'string', enum: ['text', 'image', 'video', 'audio', 'file', 'template'], default: 'text', description: 'What to send. `image`, `video`, `audio` and `file` need `media`; `template` needs `template_id`.' },
      body: { type: 'string', maxLength: 4096, example: 'Your order has shipped.', description: 'The message text, or the caption of a file.' },
      kind: { type: 'string', enum: ['dm', 'comment'], default: 'dm', description: "`dm` sends a direct message. `comment` replies publicly to one of the contact's comments. A template is always a direct message." },
      channel: { type: 'string', format: 'uuid', description: 'A channel id from List channels. The contact must be known on it, otherwise the send is refused with `reason: no_channel`. Left out, the message goes on the channel the customer last wrote on, and a template goes to their WhatsApp.' },
      template_id: { type: 'string', description: 'An approved WhatsApp template. Templates are sent on WhatsApp only, and reach a contact whose messaging window has closed.' },
      parameters: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 1024 }, description: "Values for the template's `{{1}}`, `{{2}}`, … placeholders, in order." },
      coupon_code: { type: 'string', maxLength: 200, description: 'For a template with a copy-code button: the code the button copies (Meta allows at most 15 characters).' },
      expiration_time_ms: { type: 'integer', description: 'For a limited-time offer template with a countdown: when the offer ends, as a UNIX timestamp in milliseconds.' },
      offer_expires_at: { type: 'string', format: 'date-time', description: 'The same as `expiration_time_ms`, as an ISO 8601 date and time.' },
      media: {
        type: 'object',
        description: 'The file to send, by reference. A `url` is refused: upload the file with POST /media first. A channel that cannot carry the file type refuses the send with `reason: unsupported_send_type`.',
        properties: {
          library: { type: 'string', format: 'uuid', description: 'A media library id, from POST /media or List media.' },
          source_message_id: { type: 'string', format: 'uuid', description: 'Send again an attachment of a message in this workspace.' },
          source_media_index: { type: 'integer', minimum: 0, maximum: 20, description: 'Which attachment of `source_message_id` to send, counting from 0.' },
        },
      },
      reply_to_id: { type: 'string', format: 'uuid', description: "Quote one of the contact's messages on the same channel. WhatsApp shows it as a reply. An id that matches nothing is ignored and the message goes out unquoted." },
      parent_id: { type: 'string', format: 'uuid', description: "For `kind: comment`: the comment to reply to. Left out, the reply goes to the contact's newest comment." },
      idempotency_key: { type: 'string', maxLength: 200, description: 'The same as the `Idempotency-Key` header.' },
    },
  },
  'contacts.update': {
    type: 'object',
    description: 'Send only the fields you want to change.',
    properties: {
      name: { type: 'string', maxLength: 120, example: 'Ada King' },
      email: { type: 'string', format: 'email', maxLength: 190, example: 'ada@example.org' },
      phone: { type: 'string', maxLength: 40, example: '+15550100', description: 'Full international form, starting with `+` or `00`. A local number is refused, and so is a number another contact holds.' },
      source: { type: 'string', maxLength: 60, example: 'API' },
      timezone: { type: 'string', example: 'Europe/London', description: 'An IANA timezone name.' },
      custom_fields: { type: 'object', additionalProperties: { type: 'string', maxLength: 500 }, maxProperties: 50, example: { plan: 'pro' }, description: 'A flat map of up to 50 keys (each up to 60 characters). Replaces the whole map; an empty map clears it.' },
      stage: { type: 'string', format: 'uuid', nullable: true, description: 'A pipeline stage id. `null` clears the stage. An unknown stage is refused. Fires contact.stage_changed.' },
      tags: { type: 'array', maxItems: 50, items: { type: 'string', maxLength: 60 }, example: ['VIP'], description: 'Tag names to add. Missing tags are created. Tags already on the contact are kept.' },
      marketing_opted_out: { type: 'boolean', description: "Sets (`true`) or clears (`false`) the contact's opt-out from promotional messages, where the workspace has that option. While set, automated marketing templates are not sent to the contact." },
    },
  },
};

// The plan refusal (403), the same body on every API.
const PLAN_REFUSAL = (module) => ({
  description: "Your plan doesn't include this feature.",
  content: { 'application/json': { schema: { $ref: '#/components/schemas/PlanFeatureMissing' }, example: { message: 'Broadcasts are not included in your plan. You can add them with an add-on.', code: 'plan_feature_missing', module } } },
});

// Responses beyond the generic success one.
const RESPONSES = {
  'messages.store': {
    201: { description: 'Sent and recorded. `data` is the message. A `delivery` field is present when the provider did not answer: the message may have arrived, and it is not retried.' },
    404: { description: 'No contact with this id that the person behind the key can see.' },
    422: {
      description: 'The send was refused before anything reached the provider (`message` and `reason`), the request failed validation (`message` and `errors`), or the provider refused it (`message`, with the failed message recorded in the thread and returned in `data`).',
      content: { 'application/json': {
        schema: { $ref: '#/components/schemas/SendRefused' },
        examples: {
          active_contacts_limit: { summary: 'Active contacts limit reached', value: { message: 'The workspace reached its active contacts limit, so messages can only go to contacts active in the last 30 days. Add a contacts pack for more.', reason: 'active_contacts_limit' } },
          messaging_window: { summary: 'Messaging window closed', value: { message: "WhatsApp's 24-hour messaging window has closed, so only an approved template may be sent.", reason: 'messaging_window' } },
        },
      } },
    },
  },
  'contacts.store': {
    201: { description: 'Created' },
    422: {
      description: "Validation failed. At the plan's total contacts limit the error is on `name`.",
      content: { 'application/json': { example: { message: "You've reached your plan's limit of 1000 contacts.", errors: { name: ["You've reached your plan's limit of 1000 contacts."] } } } },
    },
  },
  'broadcasts.store': { 403: PLAN_REFUSAL('broadcasts') },
  'broadcasts.update': { 403: PLAN_REFUSAL('broadcasts') },
  'broadcasts.approve': { 403: PLAN_REFUSAL('broadcasts') },
  'broadcasts.send': { 403: PLAN_REFUSAL('broadcasts') },
};

const SCHEMAS = {
  PlanFeatureMissing: {
    type: 'object',
    description: "Your plan doesn't include this feature. Every Messaging API call except GET /account answers this with `module: integrations.salesbot_api` when the plan doesn't include the Messaging API; creating, editing, approving or sending a broadcast answers it with `module: broadcasts` when the plan doesn't include broadcasts.",
    properties: {
      message: { type: 'string' },
      code: { type: 'string', enum: ['plan_feature_missing'] },
      module: { type: 'string', example: 'broadcasts', description: 'The plan feature that is missing.' },
    },
  },
  SendRefused: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'A sentence you can show to a person.' },
      reason: {
        type: 'string',
        description: [
          'Why the send was refused. Nothing was sent and nothing was recorded. The most common reasons:',
          '- `active_contacts_limit`: the workspace is at its active contacts limit and the contact has not been active in the last 30 days.',
          '- `blocked`, `opted_out`: the contact is blocked or opted out of messages.',
          '- `marketing_opted_out`: the contact asked WhatsApp to stop marketing messages from this number (marketing templates only).',
          '- `messaging_window`: the messaging window has closed. Send an approved WhatsApp template.',
          '- `standing`: the workspace is not in good standing for this kind of send.',
          '- `no_channel`, `no_account`, `channel_inactive`: there is no working channel to send through.',
          '- `platform_unsupported`, `unsupported_send_type`: the channel cannot carry this message.',
          '- `invalid_reply`: an empty message, an unknown or incomplete template, or a comment that is no longer available.',
          "- `access_denied`: the person behind the key cannot reply on this conversation's channel.",
          '- `already_attempted`: this send (the same idempotency key) was already made.',
        ].join('\n'),
        example: 'active_contacts_limit',
      },
      errors: { type: 'object', description: 'Validation errors, by field.' },
      data: { type: 'object', description: 'The recorded failed message, when the provider refused the send.' },
    },
  },
};

// Wording the manifests use internally, swapped for neutral terms.
const neutral = (s) => String(s ?? '')
  .replace(/\bS\d+[a-z]?\b ?/g, '')
  .replace(/dev8'?s? ?/gi, '')
  .replace(/\bsalesbot\b/gi, 'messaging');

function fixed(name, text) {
  let out = text;
  for (const [from, to] of DESCRIPTION_FIXES[name] ?? []) {
    if (!out.includes(from)) throw new Error(`${name}: the manifest no longer says "${from}". Update DESCRIPTION_FIXES.`);
    out = out.replace(from, to);
  }
  return out;
}

function schemaFor(value) {
  if (value === null) return { nullable: true };
  if (Array.isArray(value)) return { type: 'array', items: value.length ? schemaFor(value[0]) : {} };
  switch (typeof value) {
    case 'number': return { type: Number.isInteger(value) ? 'integer' : 'number', example: value };
    case 'boolean': return { type: 'boolean', example: value };
    case 'string':
      return /^\{\{.+\}\}$/.test(value) ? { type: 'string', format: 'uuid' } : { type: 'string', example: value };
    case 'object': {
      const properties = {};
      for (const [k, v] of Object.entries(value)) properties[k] = schemaFor(v);
      return { type: 'object', properties };
    }
    default: return {};
  }
}

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Messaging API',
    version: '1.0.0',
    description: 'Contacts, conversations, messages, broadcasts, automations and media for one workspace. No workspace ID appears in any URL: a workspace API key selects its own workspace, and a personal access token names it in the `X-Workspace` header.\n\n'
      + "A key or token acts as the person who created it, with that person's channels and role. When your plan doesn't include this API, every call except GET /account answers 403 with `code: plan_feature_missing` (see the `PlanFeatureMissing` schema).",
  },
  servers: [{
    url: 'https://{domain}/api/v1',
    description: 'Your platform domain',
    variables: { domain: { default: 'app.example.com', description: 'The domain you sign in to, without https://' } },
  }],
  security: [{ bearerAuth: [] }, { apiKeyHeader: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'A workspace API key (`Authorization: Bearer osk_...`), or a personal access token created with permissions, sent with `X-Workspace`.' },
      apiKeyHeader: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'The same key or token in the `x-api-key` header.' },
    },
    schemas: SCHEMAS,
  },
  tags: [],
  paths: {},
};

const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
for (const file of files) {
  const manifest = JSON.parse(readFileSync(join(dir, file), 'utf8').replace(/^﻿/, ''));
  if (SKIP_MODULES.has(manifest.module)) continue;
  spec.tags.push({ name: manifest.module, description: TAG_NOTES[manifest.module] ?? (neutral(manifest.notes) || undefined) });

  for (const ep of manifest.endpoints) {
    const path = '/' + ep.path;
    const method = ep.method.toLowerCase();
    const params = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
      name, in: 'path', required: true, schema: { type: 'string' }, description: `The ${name} ID.`,
    }));
    for (const q of ep.query ?? []) {
      params.push({ name: q.key, in: 'query', required: false, schema: { type: 'string', example: q.value }, description: neutral(q.description) });
    }
    if (method === 'post' && ep.name === 'messages.store') {
      params.push({ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' }, description: 'Makes a retried request a single send.' });
    }
    params.push(WORKSPACE_HEADER);

    const scope = SCOPES[ep.name];
    if (scope === undefined) throw new Error(`No scope mapping for ${ep.name}`);
    const scopeNote = scope
      ? `\n\n**Required permission:** \`salesbot:${scope}\``
      : '\n\n**Required permission:** any messaging permission.';

    const op = {
      tags: [manifest.module],
      summary: ep.summary,
      description: fixed(ep.name, neutral(ep.description)) + (EXTRA_NOTES[ep.name] ?? '') + scopeNote,
      operationId: ep.name,
      parameters: params,
      responses: { 200: { description: 'Success' } },
    };
    if (BODIES[ep.name]) {
      op.requestBody = { required: true, content: { 'application/json': { schema: BODIES[ep.name] } } };
    } else if (ep.body && Object.keys(ep.body).length) {
      const body = { ...ep.body, ...(BODY_PATCHES[ep.name] ?? {}) };
      op.requestBody = { required: true, content: { 'application/json': { schema: schemaFor(body) } } };
    }
    if (method === 'post' && !/\/(read|unread|approve|send|activate|pause)$/.test(path)) {
      op.responses = { 201: { description: 'Created' } };
    }
    if (method === 'delete') op.responses = { 204: { description: 'Deleted' } };
    if (RESPONSES[ep.name]) op.responses = { ...op.responses, ...RESPONSES[ep.name] };

    spec.paths[path] ??= {};
    spec.paths[path][method] = op;
  }
}

const out = new URL('../api-reference/messaging.openapi.json', import.meta.url);
writeFileSync(out, JSON.stringify(spec, null, 2) + '\n');
console.log(`Wrote ${Object.keys(spec.paths).length} paths to ${out.pathname}`);
