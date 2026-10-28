// SAW sync service: Twenty CRM ⇄ SAP Business One Service Layer.
//
// Twenty → B1 (on webhook, with a sweep as a safety net)
//   • Opportunity reaches Proposal sent / Negotiation → create the business partner if the company
//     has none, then a sales quotation. Quotation number written back to the opportunity.
//   • Opportunity reaches Won → sales order copied from the quotation; a Project is created in Twenty.
//   • Opportunity moves to Lost → its open quotation is closed.
//   • Company set to "Pending push" → business partner created, card code written back.
// B1 → Twenty (every SYNC_INTERVAL_SEC)
//   • Balance, credit limit, payment terms and open invoice count on every linked company.
//   • Sales order status (Open / Invoiced / Closed) on won opportunities.
//   • Items and warehouse stock into the Product object (every ITEM_SYNC_INTERVAL_SEC).
//
// Every B1 document carries the Twenty record id in U_CRM_ID, so retries find the existing
// document instead of creating a duplicate. On a real B1 company database, create the UDF
// U_CRM_ID (alphanumeric, 50) on OCRD, OQUT, ORDR and OINV first.
import http from 'node:http';
import crypto from 'node:crypto';
import { twenty, listAll, one, log as baseLog, zar } from '../setup/lib.mjs';
import { b1, b1All, q, enc } from './b1.mjs';
import { BRANDS } from '../setup/saw-model.mjs';
import { toValue } from '../setup/lib.mjs';

const PORT = Number(process.env.PORT || 8088);
const SECRET = process.env.WEBHOOK_SECRET || '';
const SYNC_MS = 1000 * Number(process.env.SYNC_INTERVAL_SEC || 60);
const ITEM_MS = 1000 * Number(process.env.ITEM_SYNC_INTERVAL_SEC || 300);
const LUMP_SUM_ITEM = process.env.B1_LUMP_SUM_ITEM || 'PRJ-LUMPSUM';
const WRITE_ENABLED = process.env.B1_WRITE_ENABLED !== 'false'; // set false to run read-only against a live B1

const recent = [];
const log = (...a) => { baseLog(...a); recent.unshift(`${new Date().toISOString().slice(0, 19)} ${a.join(' ')}`); recent.length = Math.min(recent.length, 200); };

// ---------- serialise work per record so a webhook and the sweep never race ----------
const locks = new Map();
function serial(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn).catch((e) => log(`ERROR ${key}: ${e.message}`));
  locks.set(key, next.finally(() => { if (locks.get(key) === next) locks.delete(key); }));
  return next;
}

// ---------- Twenty helpers ----------
const get = async (plural, id, depth = 1) => one(await twenty('GET', `/rest/${plural}/${id}?depth=${depth}`));
const patch = (plural, id, data) => twenty('PATCH', `/rest/${plural}/${id}`, data);
const create = async (plural, data) => one(await twenty('POST', `/rest/${plural}`, data));
const rand = (c) => (c?.amountMicros ? c.amountMicros / 1e6 : 0);

async function note(targetField, targetId, title, markdown) {
  try {
    const n = await create('notes', { title, bodyV2: { markdown } });
    await create('noteTargets', { noteId: n.id, [targetField]: targetId });
  } catch (e) { log(`note skipped: ${e.message}`); }
}

// ---------- B1 helpers ----------
const findBy = async (entity, field, value, select) =>
  (await b1('GET', `${entity}?$filter=${enc(`${field} eq ${q(value)}`)}${select ? `&$select=${select}` : ''}`)).value?.[0];

let termsCache;
async function termsName(code) {
  termsCache ||= Object.fromEntries((await b1All('PaymentTermsTypes')).map((t) => [t.GroupNumber, t.PaymentTermsGroupName]));
  return termsCache[code] || String(code ?? '');
}

async function ensureBusinessPartner(company) {
  if (company.sapCardCode) return company.sapCardCode;
  const existing = await findBy('BusinessPartners', 'U_CRM_ID', company.id, 'CardCode');
  let cardCode = existing?.CardCode;
  if (!cardCode) {
    if (!WRITE_ENABLED) throw new Error(`B1 writes disabled; ${company.name} has no card code`);
    const people = await listAll('people', { filter: `companyId[eq]:"${company.id}"` });
    const bp = await b1('POST', 'BusinessPartners', {
      CardName: company.name, CardType: 'cCustomer', U_CRM_ID: company.id,
      FederalTaxID: company.vatNumber || undefined,
      Website: company.domainName?.primaryLinkUrl || undefined,
      Notes: 'Created from Twenty CRM',
      ContactEmployees: people.slice(0, 10).map((p) => ({
        Name: `${p.name?.firstName || ''} ${p.name?.lastName || ''}`.trim(),
        E_Mail: p.emails?.primaryEmail || undefined,
        Phone1: p.phones?.primaryPhoneNumber || undefined,
        Position: p.jobTitle || undefined,
      })),
    });
    cardCode = bp.CardCode;
    log(`B1 business partner ${cardCode} created for ${company.name}`);
    await note('targetCompanyId', company.id, `SAP B1: business partner ${cardCode} created`,
      `Created in SAP Business One by the CRM sync with ${people.length} contact(s).`);
  }
  await patch('companies', company.id, { sapCardCode: cardCode, sapSyncStatus: 'LINKED', sapLastSync: new Date().toISOString() });
  company.sapCardCode = cardCode;
  return cardCode;
}

function quoteLines(opp) {
  // The CRM holds the proposal value, not the BOQ. One lump-sum line carries it; in production the
  // BOQ lines come from the proposal (or sales builds the quotation in B1 and links it here).
  return [{ ItemCode: LUMP_SUM_ITEM, ItemDescription: `${opp.name} — per proposal`.slice(0, 100), Quantity: 1, UnitPrice: rand(opp.amount) }];
}

async function ensureQuotation(opp, cardCode) {
  let qt = await findBy('Quotations', 'U_CRM_ID', opp.id, 'DocEntry,DocNum,DocumentStatus');
  if (!qt) {
    if (!WRITE_ENABLED) return null;
    qt = await b1('POST', 'Quotations', {
      CardCode: cardCode, U_CRM_ID: opp.id, NumAtCard: opp.tenderReference || undefined,
      Comments: `From Twenty CRM: ${opp.name}`.slice(0, 254),
      DocDueDate: (opp.closeDate || new Date().toISOString()).slice(0, 10),
      DocumentLines: quoteLines(opp),
    });
    log(`B1 quotation ${qt.DocNum} created for "${opp.name}"`);
    await note('targetOpportunityId', opp.id, `SAP B1: quotation ${qt.DocNum}`, `Sales quotation ${qt.DocNum} created for ${cardCode}, R ${rand(opp.amount).toLocaleString('en-ZA')} excl. VAT.`);
  }
  if (opp.sapQuotationNo !== String(qt.DocNum)) await patch('opportunities', opp.id, { sapQuotationNo: String(qt.DocNum), sapSyncStatus: 'LINKED' });
  return qt;
}

async function processOpportunity(id) {
  const opp = await get('opportunities', id);
  if (!opp?.id) return;
  const stage = opp.stage;
  if (!['PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'].includes(stage)) return;
  if (stage === 'LOST') {
    const qt = opp.sapQuotationNo && await findBy('Quotations', 'U_CRM_ID', opp.id, 'DocEntry,DocNum,DocumentStatus');
    if (qt?.DocumentStatus === 'bost_Open' && WRITE_ENABLED) {
      await b1('POST', `Quotations(${qt.DocEntry})/Close`);
      log(`B1 quotation ${qt.DocNum} closed ("${opp.name}" lost)`);
      await patch('opportunities', opp.id, { sapOrderStatus: 'Quotation closed' });
    }
    return;
  }
  if (!opp.companyId) { await patch('opportunities', id, { sapSyncStatus: 'SYNC_ERROR' }); log(`"${opp.name}" has no company; skipped`); return; }
  if (stage !== 'WON' && opp.sapQuotationNo) return; // already quoted
  if (stage === 'WON' && opp.sapSalesOrderNo) return; // already ordered

  try {
    const company = await get('companies', opp.companyId, 0);
    const cardCode = await ensureBusinessPartner(company);
    const qt = await ensureQuotation(opp, cardCode);
    if (stage !== 'WON' || !qt) return;

    let order = await findBy('Orders', 'U_CRM_ID', opp.id, 'DocEntry,DocNum,DocumentStatus');
    if (!order) {
      const full = await b1('GET', `Quotations(${qt.DocEntry})`);
      order = await b1('POST', 'Orders', {
        CardCode: cardCode, U_CRM_ID: opp.id, NumAtCard: opp.tenderReference || undefined,
        Comments: `Won in Twenty CRM: ${opp.name}`.slice(0, 254),
        DocDueDate: (opp.expectedInstallDate || opp.closeDate || new Date().toISOString()).slice(0, 10),
        DocumentLines: full.DocumentLines.map((l) => ({ BaseType: 23, BaseEntry: qt.DocEntry, BaseLine: l.LineNum })),
      });
      log(`B1 sales order ${order.DocNum} created for "${opp.name}"`);
      await note('targetOpportunityId', opp.id, `SAP B1: sales order ${order.DocNum}`, `Sales order ${order.DocNum} created from quotation ${qt.DocNum}.`);
    }
    await patch('opportunities', opp.id, { sapSalesOrderNo: String(order.DocNum), sapOrderStatus: 'Open', sapSyncStatus: 'LINKED' });

    // Hand over to delivery: one Project per won project-type deal.
    const projects = await listAll('projects', { filter: `opportunityId[eq]:"${opp.id}"` });
    if (!projects.length && ['PROJECT_SUPPLY_AND_INSTALL', 'TENDER'].includes(opp.dealType)) {
      const p = await create('projects', {
        name: opp.name, status: 'PLANNING', sowStatus: 'DRAFT', contractValue: opp.amount,
        companyId: opp.companyId, opportunityId: opp.id, startDate: opp.expectedInstallDate || null,
      });
      log(`Project created in Twenty for "${opp.name}" (${p.id})`);
    }
  } catch (e) {
    await patch('opportunities', id, { sapSyncStatus: 'SYNC_ERROR' }).catch(() => {});
    throw e;
  }
}

async function pushCompany(id) {
  const c = await get('companies', id, 0);
  if (c?.sapSyncStatus === 'PENDING_PUSH' && !c.sapCardCode) await ensureBusinessPartner(c);
}

// ---------- B1 → Twenty ----------
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function pullCompanies() {
  const companies = await listAll('companies', { filter: 'sapCardCode[is]:NOT_NULL' });
  let changed = 0;
  for (const c of companies) {
    if (!c.sapCardCode) continue;
    const bp = await b1('GET', `BusinessPartners(${q(c.sapCardCode)})?$select=CardCode,CurrentAccountBalance,CreditLimit,PayTermsGrpCode`).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!bp) { await patch('companies', c.id, { sapSyncStatus: 'SYNC_ERROR' }); log(`card code ${c.sapCardCode} not found in B1 (${c.name})`); continue; }
    const open = await b1All(`Invoices?$filter=${enc(`CardCode eq ${q(c.sapCardCode)} and DocumentStatus eq 'bost_Open'`)}&$select=DocEntry`);
    const next = {
      sapBalance: zar(bp.CurrentAccountBalance || 0), sapCreditLimit: zar(bp.CreditLimit || 0),
      sapPaymentTerms: await termsName(bp.PayTermsGrpCode), sapOpenInvoices: open.length, sapSyncStatus: 'LINKED',
    };
    const cur = { sapBalance: c.sapBalance && { amountMicros: Number(c.sapBalance.amountMicros), currencyCode: c.sapBalance.currencyCode },
      sapCreditLimit: c.sapCreditLimit && { amountMicros: Number(c.sapCreditLimit.amountMicros), currencyCode: c.sapCreditLimit.currencyCode },
      sapPaymentTerms: c.sapPaymentTerms, sapOpenInvoices: c.sapOpenInvoices, sapSyncStatus: c.sapSyncStatus };
    if (!same(cur, next)) { await patch('companies', c.id, { ...next, sapLastSync: new Date().toISOString() }); changed++; }
  }
  if (changed) log(`B1 → Twenty: ${changed} company balance(s) updated`);
}

async function pullOrderStatus() {
  const opps = await listAll('opportunities', { filter: 'sapSalesOrderNo[is]:NOT_NULL' });
  for (const o of opps) {
    if (!o.sapSalesOrderNo) continue; // text fields can hold '' rather than null
    const order = await findBy('Orders', 'U_CRM_ID', o.id, 'DocEntry,DocNum,DocumentStatus,Cancelled');
    if (!order) continue;
    const inv = await b1All(`Invoices?$filter=${enc(`U_CRM_ID eq ${q(o.id)}`)}&$select=DocNum,DocumentStatus`);
    const status = order.Cancelled === 'tYES' ? 'Cancelled'
      : inv.length && inv.every((i) => i.DocumentStatus === 'bost_Close') ? `Paid (invoice ${inv.map((i) => i.DocNum).join(', ')})`
      : inv.length ? `Invoiced (${inv.map((i) => i.DocNum).join(', ')})`
      : order.DocumentStatus === 'bost_Open' ? 'Open' : 'Closed';
    if (status !== o.sapOrderStatus) { await patch('opportunities', o.id, { sapOrderStatus: status }); log(`order ${order.DocNum}: ${status}`); }
  }
}

const brandValues = new Set(BRANDS.map(toValue));
async function pullItems() {
  // Stock items only: service and lump-sum items stay in B1.
  const items = await b1All(`Items?$filter=${enc("InventoryItem eq 'tYES'")}&$select=ItemCode,ItemName,ItemsGroupCode,U_Brand,ItemPrices,ItemWarehouseInfoCollection`);
  const existing = Object.fromEntries((await listAll('products')).map((p) => [p.itemCode, p]));
  const groups = { 101: 'Loudspeakers', 102: 'Amplification', 103: 'Mixing & processing', 104: 'Video', 105: 'Networking & I/O', 106: 'Services' };
  let n = 0;
  for (const it of items) {
    const wh = Object.fromEntries((it.ItemWarehouseInfoCollection || []).map((w) => [w.WarehouseCode, w]));
    const brand = toValue(it.U_Brand || 'Other');
    const data = {
      name: it.ItemName, itemCode: it.ItemCode, itemGroup: groups[it.ItemsGroupCode] || String(it.ItemsGroupCode ?? ''),
      brand: brandValues.has(brand) ? brand : 'OTHER',
      listPrice: zar(it.ItemPrices?.find((p) => p.PriceList === 1)?.Price || 0),
      stockMidrand: wh.MID01?.InStock ?? 0, stockWindhoek: wh.WHK01?.InStock ?? 0,
      onOrder: Object.values(wh).reduce((s, w) => s + (w.Ordered || 0), 0),
    };
    const ex = existing[it.ItemCode];
    if (!ex) { await create('products', { ...data, sapLastSync: new Date().toISOString() }); n++; continue; }
    const diff = ['name', 'itemGroup', 'brand', 'stockMidrand', 'stockWindhoek', 'onOrder'].some((k) => ex[k] !== data[k])
      || Number(ex.listPrice?.amountMicros) !== data.listPrice.amountMicros;
    if (diff) { await patch('products', ex.id, { ...data, sapLastSync: new Date().toISOString() }); n++; }
  }
  if (n) log(`B1 → Twenty: ${n} product(s) created or updated`);
}

// ---------- sweep ----------
async function sweep() {
  const opps = await listAll('opportunities', { filter: 'stage[in]:[PROPOSAL_SENT,NEGOTIATION,WON,LOST]' });
  for (const o of opps) {
    const needs = (o.stage === 'WON' && !o.sapSalesOrderNo) || (['PROPOSAL_SENT', 'NEGOTIATION'].includes(o.stage) && !o.sapQuotationNo)
      || (o.stage === 'LOST' && o.sapQuotationNo && o.sapOrderStatus !== 'Quotation closed');
    if (needs) await serial(`opp:${o.id}`, () => processOpportunity(o.id));
  }
  const pending = await listAll('companies', { filter: 'sapSyncStatus[eq]:PENDING_PUSH' });
  for (const c of pending) await serial(`co:${c.id}`, () => pushCompany(c.id));
  await pullCompanies();
  await pullOrderStatus();
}

function loop(name, fn, ms) {
  let busy = false;
  const run = async () => {
    if (busy) return; busy = true;
    try { await fn(); } catch (e) { log(`ERROR ${name}: ${e.message}`); } finally { busy = false; }
  };
  setTimeout(run, 3000); setInterval(run, ms);
}

// ---------- webhook receiver ----------
function verify(req, raw) {
  if (!SECRET) return true;
  const ts = req.headers['x-twenty-webhook-timestamp'];
  const sig = req.headers['x-twenty-webhook-signature'];
  if (!ts || !sig) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(`${ts}:${raw}`).digest('hex');
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/status')) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(`SAW sync service — B1 writes ${WRITE_ENABLED ? 'on' : 'OFF (read-only)'}\n\n${recent.join('\n')}\n`);
  }
  if (req.method === 'POST' && req.url.startsWith('/webhooks/twenty')) {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (!verify(req, raw)) { res.writeHead(401); return res.end('bad signature'); }
      res.writeHead(200); res.end('ok');
      let body; try { body = JSON.parse(raw); } catch { return; }
      const event = body.eventName || '';
      const id = body.record?.id || body.recordId || body.data?.record?.id || body.data?.id;
      if (!id) return;
      if (event.startsWith('opportunity.')) serial(`opp:${id}`, () => processOpportunity(id));
      if (event.startsWith('company.')) serial(`co:${id}`, () => pushCompany(id));
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORT, () => {
  log(`sync service on :${PORT} → B1 ${process.env.B1_URL} (${process.env.B1_COMPANY_DB}); writes ${WRITE_ENABLED ? 'on' : 'off'}`);
  loop('sweep', sweep, SYNC_MS);
  loop('items', pullItems, ITEM_MS);
});
