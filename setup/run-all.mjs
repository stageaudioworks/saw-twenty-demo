// One-shot setup: wait for Twenty → bootstrap admin + API key → schema → demo data → webhook.
import { TWENTY_URL, twenty, rows, log } from './lib.mjs';
import { bootstrap } from './bootstrap.mjs';
import { applySchema } from './schema.mjs';
import { seed } from './seed.mjs';
import { applyViews } from './views.mjs';

async function waitForTwenty() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${TWENTY_URL}/healthz`)).ok) return; } catch {}
    if (i % 6 === 0) log('waiting for Twenty to come up…');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Twenty did not become healthy at ${TWENTY_URL}`);
}

async function ensureWebhook() {
  const target = process.env.SYNC_WEBHOOK_URL || 'http://saw-sync:8088/webhooks/twenty';
  const operations = ['opportunity.created', 'opportunity.updated', 'company.updated'];
  const existing = rows(await twenty('GET', '/rest/metadata/webhooks'));
  const hook = existing.find((w) => w.targetUrl === target);
  const body = { targetUrl: target, operations, description: 'SAW sync service (SAP B1)', secret: process.env.WEBHOOK_SECRET };
  if (hook) await twenty('PATCH', `/rest/metadata/webhooks/${hook.id}`, body);
  else await twenty('POST', '/rest/metadata/webhooks', body);
  log(`webhook → ${target}`);
}

const steps = process.argv.slice(2);
const want = (s) => !steps.length || steps.includes(s);

try {
  await waitForTwenty();
  if (want('bootstrap')) await bootstrap();
  if (want('schema')) await applySchema({ removeSamples: process.env.REMOVE_TWENTY_SAMPLES !== 'false' });
  if (want('views')) await applyViews();
  if (want('seed') && process.env.SEED_DEMO_DATA !== 'false') await seed();
  if (want('webhook')) await ensureWebhook();
  log('setup complete');
} catch (e) {
  console.error('setup failed:', e.message, e.body ? JSON.stringify(e.body).slice(0, 500) : '');
  process.exit(1);
}
