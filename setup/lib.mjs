// Shared helpers for talking to Twenty's REST APIs.
// Core API:     /rest/<objectPlural>
// Metadata API: /rest/metadata/<objects|fields|webhooks>
import fs from 'node:fs';
import path from 'node:path';

export const TWENTY_URL = (process.env.TWENTY_INTERNAL_URL || 'http://server:3000').replace(/\/$/, '');
export const STATE_FILE = process.env.STATE_FILE || '/state/twenty.json';

export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
export function writeState(patch) {
  const next = { ...readState(), ...patch };
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}
export function apiKey() {
  const key = process.env.TWENTY_API_KEY || readState().apiKey;
  if (!key) throw new Error('No Twenty API key: run bootstrap first, or set TWENTY_API_KEY in .env');
  return key;
}

// Small pacing so a default 100 req/min limit is never hit hard; retries on 429/5xx.
let last = 0;
const MIN_GAP_MS = Number(process.env.TWENTY_MIN_GAP_MS || 120);

export async function twenty(method, urlPath, body, { token, retries = 5, okStatuses = [] } = {}) {
  for (let attempt = 0; ; attempt++) {
    const wait = last + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const res = await fetch(TWENTY_URL + urlPath, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || apiKey()}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (res.ok || okStatuses.includes(res.status)) return json;
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    const msg = json?.messages?.join?.('; ') || json?.message || json?.error || text.slice(0, 300);
    const err = new Error(`${method} ${urlPath} → ${res.status}: ${msg}`);
    err.status = res.status; err.body = json;
    throw err;
  }
}

// REST list responses look like { data: { companies: [...] }, pageInfo, totalCount }
export const rows = (json) => {
  const d = json?.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    const first = Object.values(d)[0];
    return Array.isArray(first) ? first : [];
  }
  return [];
};
// REST single-record responses look like { data: { createCompany: {...} } }
export const one = (json) => {
  const d = json?.data ?? json;
  if (d && typeof d === 'object' && !d.id) {
    const first = Object.values(d)[0];
    if (first && typeof first === 'object') return first;
  }
  return d;
};

export async function listAll(plural, { filter, fields } = {}) {
  const out = [];
  let cursor;
  for (;;) {
    const q = new URLSearchParams({ limit: '60' });
    if (filter) q.set('filter', filter);
    if (cursor) q.set('starting_after', cursor);
    const json = await twenty('GET', `/rest/${plural}?${q}`);
    const page = rows(json);
    out.push(...page);
    if (!json?.pageInfo?.hasNextPage || page.length === 0) break;
    cursor = json.pageInfo.endCursor;
  }
  return fields ? out.map((r) => Object.fromEntries(fields.map((f) => [f, r[f]]))) : out;
}

// Metadata
export async function getObjects() {
  const json = await twenty('GET', '/rest/metadata/objects?limit=200');
  return rows(json);
}

// Twenty SELECT values must be UPPER_SNAKE_CASE.
export const toValue = (label) =>
  label.normalize('NFKD').replace(/&/g, ' AND ').replace(/[^\w\s-]/g, ' ')
    .trim().replace(/[\s-]+/g, '_').replace(/_+/g, '_').toUpperCase();

const COLORS = ['blue', 'turquoise', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'sky', 'gray'];
export const options = (labels) =>
  labels.map((l, i) => {
    const [label, color] = Array.isArray(l) ? l : [l, COLORS[i % COLORS.length]];
    return { label, value: toValue(label), color, position: i };
  });

export const zar = (rand) => ({ amountMicros: Math.round(rand * 1e6), currencyCode: 'ZAR' });
