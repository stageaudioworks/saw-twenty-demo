// Views: kanban columns for the SAW stages, SAW fields on the main tables, and a few saved views.
// Idempotent: reruns only add or adjust what is missing.
import { twenty, rows, getObjects, toValue, log } from './lib.mjs';
import { STAGES } from './saw-model.mjs';

// Columns shown on each object's main ("All …") table, in order, after the name column.
const TABLE_COLUMNS = {
  company: ['customerType', 'market', 'region', 'branch', 'accountOwner', 'sapCardCode', 'sapBalance', 'sapCreditLimit', 'sapPaymentTerms', 'sapOpenInvoices', 'sapSyncStatus'],
  person: ['company', 'jobTitle', 'jobRole', 'decisionRole', 'emails', 'phones'],
  opportunity: ['company', 'stage', 'amount', 'dealType', 'market', 'brands', 'closeDate', 'pointOfContact', 'sapQuotationNo', 'sapSalesOrderNo', 'sapOrderStatus', 'sapSyncStatus'],
  project: ['company', 'status', 'contractValue', 'startDate', 'handoverDate', 'sowStatus', 'projectManager', 'opportunity'],
  installedSystem: ['company', 'category', 'brand', 'model', 'installDate', 'warrantyExpiry', 'serialNumber'],
  supportCase: ['company', 'caseType', 'status', 'priority', 'branch', 'installedSystem', 'serialNumber'],
  product: ['itemCode', 'brand', 'itemGroup', 'listPrice', 'stockMidrand', 'stockWindhoek', 'onOrder', 'sapLastSync'],
};
// Standard columns that add noise for SAW.
const HIDE = {
  company: ['linkedinLink', 'xLink', 'employees', 'idealCustomerProfile', 'annualRecurringRevenue', 'createdBy'],
  opportunity: ['createdBy'],
  person: ['linkedinLink', 'xLink', 'createdBy', 'city', 'avatarUrl'],
};

// Saved views: [object, name, icon, filters [[field, operand, value]], sort [field, direction], columns]
const SAVED_VIEWS = [
  ['opportunity', 'Tenders', 'IconFileCertificate', [['dealType', 'IS', '["TENDER"]']], ['tenderClosingDate', 'ASC'],
    ['company', 'stage', 'amount', 'tenderReference', 'tenderClosingDate', 'biddingEntity', 'market', 'sapQuotationNo']],
  ['opportunity', 'Won — in SAP', 'IconFileCheck', [['stage', 'IS', '["WON"]']], ['closeDate', 'DESC'],
    ['company', 'amount', 'dealType', 'sapQuotationNo', 'sapSalesOrderNo', 'sapOrderStatus', 'expectedInstallDate']],
  ['company', 'SAP B1 accounts', 'IconLink', [['sapCardCode', 'IS_NOT_EMPTY', '']], ['name', 'ASC'],
    ['sapCardCode', 'sapBalance', 'sapCreditLimit', 'sapPaymentTerms', 'sapOpenInvoices', 'sapLastSync', 'sapSyncStatus']],
  ['installedSystem', 'Warranty ending soonest', 'IconShieldCheck', [['warrantyExpiry', 'IS_NOT_EMPTY', '']], ['warrantyExpiry', 'ASC'],
    ['company', 'category', 'brand', 'model', 'installDate', 'warrantyExpiry']],
];

async function list(what) {
  const out = [];
  let after;
  for (;;) {
    const json = await twenty('GET', `/rest/metadata/${what}?limit=200${after ? `&starting_after=${after}` : ''}`);
    const page = rows(json);
    out.push(...page);
    if (!json?.pageInfo?.hasNextPage || !page.length) return out;
    after = json.pageInfo.endCursor;
  }
}
const fieldId = (obj, name) => obj.fields.find((f) => f.name === name)?.id;

async function setColumns(view, obj, columns, hide = [], allViewFields) {
  const vf = allViewFields.filter((f) => f.viewId === view.id);
  const nameId = fieldId(obj, 'name');
  let pos = 1;
  for (const name of columns) {
    const id = fieldId(obj, name);
    if (!id || id === nameId) continue;
    const ex = vf.find((f) => f.fieldMetadataId === id);
    if (!ex) await twenty('POST', '/rest/metadata/viewFields', { viewId: view.id, fieldMetadataId: id, isVisible: true, position: pos, size: 160 });
    else if (!ex.isVisible || ex.position !== pos) await twenty('PATCH', `/rest/metadata/viewFields/${ex.id}`, { isVisible: true, position: pos });
    pos++;
  }
  const keep = new Set([nameId, ...columns.map((c) => fieldId(obj, c))]);
  for (const f of vf) {
    const fname = obj.fields.find((x) => x.id === f.fieldMetadataId)?.name;
    if (f.isVisible && !keep.has(f.fieldMetadataId) && (hide.includes(fname) || f.position < 1000)) {
      // Push standard columns we did not ask for behind ours; hide the noisy ones entirely.
      await twenty('PATCH', `/rest/metadata/viewFields/${f.id}`, hide.includes(fname) ? { isVisible: false } : { position: pos++ });
    }
  }
}

export async function applyViews() {
  log('views: configuring');
  const objects = Object.fromEntries((await getObjects()).map((o) => [o.nameSingular, o]));
  let views = await list('views');
  const allViewFields = await list('viewFields');

  // 1. Kanban columns for the SAW pipeline
  const opp = objects.opportunity;
  const stageId = fieldId(opp, 'stage');
  const groups = await list('viewGroups');
  for (const v of views.filter((v) => v.type === 'KANBAN' && v.mainGroupByFieldMetadataId === stageId)) {
    const mine = groups.filter((g) => g.viewId === v.id);
    const want = STAGES.map(([l]) => toValue(l));
    for (const g of mine) if (!want.includes(g.fieldValue)) await twenty('DELETE', `/rest/metadata/viewGroups/${g.id}`);
    for (const [i, value] of want.entries()) {
      const ex = mine.find((g) => g.fieldValue === value);
      if (!ex) await twenty('POST', '/rest/metadata/viewGroups', { viewId: v.id, fieldValue: value, position: i, isVisible: true });
      else if (ex.position !== i || !ex.isVisible) await twenty('PATCH', `/rest/metadata/viewGroups/${ex.id}`, { position: i, isVisible: true });
    }
    // Card fields: what a rep needs at a glance
    await setColumns(v, opp, ['amount', 'company', 'dealType', 'closeDate', 'pointOfContact', 'sapQuotationNo', 'sapSalesOrderNo'], ['createdBy'], allViewFields);
    log(`  ~ kanban "${v.name}" columns set to SAW stages`);
  }

  // 2. Main table columns
  for (const [name, cols] of Object.entries(TABLE_COLUMNS)) {
    const obj = objects[name];
    const main = views.filter((v) => v.objectMetadataId === obj.id && v.type === 'TABLE' && /^All\b/.test(v.name));
    for (const v of main) { await setColumns(v, obj, cols, HIDE[name], allViewFields); log(`  ~ ${v.name} columns`); }
  }

  // 3. Saved views
  for (const [objName, name, icon, filters, sort, cols] of SAVED_VIEWS) {
    const obj = objects[objName];
    if (views.some((v) => v.objectMetadataId === obj.id && v.name === name)) continue;
    const v = await twenty('POST', '/rest/metadata/views', {
      name, icon, objectMetadataId: obj.id, type: 'TABLE', visibility: 'WORKSPACE',
      position: 10 + views.filter((x) => x.objectMetadataId === obj.id).length,
    });
    const view = v.id ? v : rows(v)[0] || Object.values(v.data || {})[0];
    for (const [f, operand, value] of filters) {
      await twenty('POST', '/rest/metadata/viewFilters', { viewId: view.id, fieldMetadataId: fieldId(obj, f), operand, value });
    }
    if (sort) await twenty('POST', '/rest/metadata/viewSorts', { viewId: view.id, fieldMetadataId: fieldId(obj, sort[0]), direction: sort[1] });
    const fresh = (await list('viewFields'));
    await setColumns(view, obj, cols, HIDE[objName] || [], fresh);
    views = await list('views');
    log(`  + view "${name}"`);
  }
  log('views: done');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  applyViews().catch((e) => { console.error(e.message, e.body ? JSON.stringify(e.body).slice(0, 500) : ''); process.exit(1); });
}
