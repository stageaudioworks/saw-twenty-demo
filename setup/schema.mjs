// Applies saw-model.mjs to the workspace. Idempotent: existing objects and fields are left alone.
import { twenty, getObjects, options, toValue, listAll, log, rows } from './lib.mjs';
import { STANDARD_FIELDS, CUSTOM_OBJECTS, RELATIONS, STAGES } from './saw-model.mjs';

function fieldPayload(objectMetadataId, f) {
  const p = { objectMetadataId, name: f.name, label: f.label, type: f.type, icon: f.icon };
  if (f.options) p.options = options(f.options);
  if (f.defaultValue !== undefined) p.defaultValue = f.defaultValue;
  if (f.isUnique) p.isUnique = true;
  if (f.description) p.description = f.description;
  return p;
}

async function ensureFields(obj, fields) {
  const have = new Set(obj.fields.map((f) => f.name));
  for (const f of fields) {
    if (have.has(f.name)) continue;
    await twenty('POST', '/rest/metadata/fields', fieldPayload(obj.id, f));
    log(`  + ${obj.nameSingular}.${f.name}`);
  }
}

// Twenty seeds every new workspace with a few sample records (Notion, Stripe, Airbnb…).
// Remove only those created by the system so the demo starts clean.
async function removeSampleRecords() {
  for (const plural of ['opportunities', 'people', 'companies']) {
    const all = await listAll(plural);
    const sample = all.filter((r) => r.createdBy?.source === 'SYSTEM');
    for (const r of sample) await twenty('DELETE', `/rest/${plural}/${r.id}`);
    if (sample.length) log(`  - removed ${sample.length} Twenty sample ${plural}`);
  }
}

async function setStages(oppObject) {
  const stage = oppObject.fields.find((f) => f.name === 'stage');
  const want = STAGES.map(([l]) => toValue(l));
  const have = (stage.options || []).map((o) => o.value);
  if (JSON.stringify(want) === JSON.stringify(have)) return;
  // Any remaining opportunity on a stage that is about to disappear blocks the change.
  const opps = await listAll('opportunities');
  for (const o of opps.filter((o) => o.stage && !want.includes(o.stage))) {
    await twenty('PATCH', `/rest/opportunities/${o.id}`, { stage: 'LEAD' }).catch(() => {});
  }
  await twenty('PATCH', `/rest/metadata/fields/${stage.id}`, {
    options: options(STAGES), defaultValue: "'LEAD'",
  });
  log('  ~ opportunity.stage set to SAW pipeline');
}

export async function applySchema({ removeSamples = true } = {}) {
  log('schema: reading workspace');
  let objects = await getObjects();
  const byName = () => Object.fromEntries(objects.map((o) => [o.nameSingular, o]));

  if (removeSamples) await removeSampleRecords();

  // 1. Custom objects
  for (const o of CUSTOM_OBJECTS) {
    if (byName()[o.nameSingular]) continue;
    const { fields, ...def } = o;
    await twenty('POST', '/rest/metadata/objects', def);
    log(`  + object ${o.nameSingular}`);
  }
  objects = await getObjects();

  // 2. Fields on standard and custom objects
  for (const [name, fields] of Object.entries(STANDARD_FIELDS)) await ensureFields(byName()[name], fields);
  for (const o of CUSTOM_OBJECTS) await ensureFields(byName()[o.nameSingular], o.fields);
  objects = await getObjects();

  // 3. Relations
  for (const [src, name, label, target, inverseLabel, icon] of RELATIONS) {
    const s = byName()[src];
    if (s.fields.some((f) => f.name === name)) continue;
    await twenty('POST', '/rest/metadata/fields', {
      objectMetadataId: s.id, type: 'RELATION', name, label, icon,
      relationCreationPayload: {
        type: 'MANY_TO_ONE', targetObjectMetadataId: byName()[target].id,
        targetFieldLabel: inverseLabel, targetFieldIcon: byName()[src].icon || 'IconLink',
      },
    });
    log(`  + relation ${src}.${name} → ${target}`);
  }
  objects = await getObjects();

  // 4. Pipeline stages
  await setStages(byName().opportunity);
  log('schema: done');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  applySchema().catch((e) => { console.error(e.message, e.body ? JSON.stringify(e.body).slice(0, 500) : ''); process.exit(1); });
}
