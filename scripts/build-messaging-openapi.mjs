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
  'conversations.read': 'conversations:write', 'conversations.status.update': 'conversations:write',
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

// Wording the manifests use internally, swapped for neutral terms.
const neutral = (s) => String(s ?? '')
  .replace(/\bS\d+[a-z]?\b ?/g, '')
  .replace(/dev8'?s? ?/gi, '')
  .replace(/\bsalesbot\b/gi, 'messaging');

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
    description: 'Contacts, conversations, messages, broadcasts, automations and media for one workspace. The workspace is selected by the API key, so no workspace ID appears in any URL.',
  },
  servers: [{
    url: 'https://{domain}/api/v1',
    description: 'Your platform domain',
    variables: { domain: { default: 'app.example.com', description: 'The domain you sign in to, without https://' } },
  }],
  security: [{ bearerAuth: [] }, { apiKeyHeader: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'A workspace API key: `Authorization: Bearer osk_...`' },
      apiKeyHeader: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'The same workspace API key in the `x-api-key` header.' },
    },
  },
  tags: [],
  paths: {},
};

const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
for (const file of files) {
  const manifest = JSON.parse(readFileSync(join(dir, file), 'utf8').replace(/^﻿/, ''));
  if (SKIP_MODULES.has(manifest.module)) continue;
  spec.tags.push({ name: manifest.module, description: neutral(manifest.notes) || undefined });

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

    const scope = SCOPES[ep.name];
    if (scope === undefined) throw new Error(`No scope mapping for ${ep.name}`);
    const scopeNote = scope
      ? `\n\n**Required permission:** \`salesbot:${scope}\``
      : '\n\n**Required permission:** any messaging permission.';

    const op = {
      tags: [manifest.module],
      summary: ep.summary,
      description: neutral(ep.description) + scopeNote,
      operationId: ep.name,
      parameters: params.length ? params : undefined,
      responses: { 200: { description: 'Success' } },
    };
    if (ep.body && Object.keys(ep.body).length) {
      op.requestBody = { required: true, content: { 'application/json': { schema: schemaFor(ep.body) } } };
    }
    if (method === 'post' && !/\/(read|approve|send|activate|pause)$/.test(path)) {
      op.responses = { 201: { description: 'Created' } };
    }
    if (method === 'delete') op.responses = { 204: { description: 'Deleted' } };

    spec.paths[path] ??= {};
    spec.paths[path][method] = op;
  }
}

const out = new URL('../api-reference/messaging.openapi.json', import.meta.url);
writeFileSync(out, JSON.stringify(spec, null, 2) + '\n');
console.log(`Wrote ${Object.keys(spec.paths).length} paths to ${out.pathname}`);
