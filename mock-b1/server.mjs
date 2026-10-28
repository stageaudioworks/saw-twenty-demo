// Mock SAP Business One Service Layer — just enough of /b1s/v1 for the Twenty demo.
// Same paths, verbs, session cookie and OData v3 response shapes as the real Service Layer,
// so the sync service runs unchanged against either. All data here is invented demo data.
//
// Also serves a small read-only "SAP B1 (mock)" page at / that shows business partners and
// documents, and lets you post an invoice against an order to see balances flow back.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { seed } from './seed.mjs';

const PORT = Number(process.env.PORT || 50000);
const DATA = process.env.B1_MOCK_DATA || '/data/b1-mock.json';
const COMPANY_DB = process.env.B1_COMPANY_DB || 'SBODEMO_SAW';
const USER = process.env.B1_USER || 'crm-sync';
const PASS = process.env.B1_PASSWORD || 'demo';

let db;
try { db = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch { db = seed(); save(); }
function save() { fs.mkdirSync(DATA.replace(/\/[^/]+$/, ''), { recursive: true }); fs.writeFileSync(DATA, JSON.stringify(db, null, 2)); }

const sessions = new Map();
const now = () => new Date();
const isoDate = (d = now()) => d.toISOString().slice(0, 10);
const isoTime = (d = now()) => d.toISOString().slice(11, 19);

// ---------- OData helpers ----------
function parseFilter(expr) {
  if (!expr) return () => true;
  // Supports: Field eq 'x' | Field eq 5 | Field ge 'date' | gt | le | lt, joined by "and"
  const parts = expr.split(/\s+and\s+/i).map((p) => {
    const m = p.trim().match(/^(\w+)\s+(eq|ne|ge|gt|le|lt)\s+(?:'((?:[^']|'')*)'|(-?\d+(?:\.\d+)?)|(null))$/i);
    if (!m) throw Object.assign(new Error(`Unsupported $filter: ${p}`), { code: -1000 });
    const [, field, op, str, num] = m;
    const val = str !== undefined ? str.replace(/''/g, "'") : num !== undefined ? Number(num) : null;
    return (row) => {
      const v = row[field];
      switch (op.toLowerCase()) {
        case 'eq': return v === val || String(v) === String(val);
        case 'ne': return v !== val;
        case 'ge': return v >= val; case 'gt': return v > val;
        case 'le': return v <= val; case 'lt': return v < val;
      }
    };
  });
  return (row) => parts.every((f) => f(row));
}
function project(row, select) {
  if (!select) return row;
  const keys = select.split(',').map((s) => s.trim());
  return Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]));
}
function collection(req, url, name, list) {
  const q = url.searchParams;
  let out = list.filter(parseFilter(q.get('$filter')));
  if (q.get('$orderby')) {
    const [k, dir] = q.get('$orderby').split(/\s+/);
    out = [...out].sort((a, b) => (a[k] > b[k] ? 1 : -1) * (dir === 'desc' ? -1 : 1));
  }
  const skip = Number(q.get('$skip') || 0);
  const pageSize = Number(req.headers.prefer?.match(/odata\.maxpagesize=(\d+)/)?.[1] || 20);
  const top = Number(q.get('$top') || pageSize);
  const page = out.slice(skip, skip + Math.min(top, pageSize));
  const body = { 'odata.metadata': `$metadata#${name}`, value: page.map((r) => project(r, q.get('$select'))) };
  if (skip + page.length < out.length && page.length === pageSize) {
    const next = new URLSearchParams(q); next.set('$skip', String(skip + page.length));
    body['odata.nextLink'] = `${name}?${next}`;
  }
  return body;
}

// ---------- domain ----------
const docLists = { Quotations: 'quotations', Orders: 'orders', Invoices: 'invoices' };
const objType = { Quotations: 23, Orders: 17, Invoices: 13 };
const nextNum = (k) => (db.counters[k] = (db.counters[k] ?? 1000) + 1);

function itemPrice(code) {
  const it = db.items.find((i) => i.ItemCode === code);
  return it?.ItemPrices?.find((p) => p.PriceList === 1)?.Price ?? 0;
}
function buildDoc(kind, body) {
  const bp = db.businessPartners.find((b) => b.CardCode === body.CardCode);
  if (!bp) throw Object.assign(new Error(`Invalid BP code '${body.CardCode}'`), { code: -10, status: 400 });
  const lines = (body.DocumentLines || []).map((l, i) => {
    let base = {};
    if (l.BaseType && l.BaseEntry !== undefined) {
      const src = db[docLists[Object.keys(objType).find((k) => objType[k] === l.BaseType)]]
        .find((d) => d.DocEntry === l.BaseEntry);
      if (!src) throw Object.assign(new Error('Base document not found'), { code: -2028, status: 400 });
      base = src.DocumentLines[l.BaseLine ?? i] || {};
    }
    const ItemCode = l.ItemCode || base.ItemCode;
    const Quantity = l.Quantity ?? base.Quantity ?? 1;
    const UnitPrice = l.UnitPrice ?? l.Price ?? base.UnitPrice ?? itemPrice(ItemCode);
    const ItemDescription = l.ItemDescription || base.ItemDescription || db.items.find((x) => x.ItemCode === ItemCode)?.ItemName || 'Service';
    return { LineNum: i, ItemCode, ItemDescription, Quantity, UnitPrice, LineTotal: +(Quantity * UnitPrice).toFixed(2),
      BaseType: l.BaseType ?? -1, BaseEntry: l.BaseEntry ?? null, BaseLine: l.BaseLine ?? null, LineStatus: 'bost_Open' };
  });
  const DocTotal = +(lines.reduce((s, l) => s + l.LineTotal, 0) * 1.15).toFixed(2); // 15% VAT
  const DocEntry = nextNum(`${kind}Entry`);
  return {
    DocEntry, DocNum: nextNum(`${kind}Num`) + 100000 * Object.keys(objType).indexOf(kind),
    DocType: 'dDocument_Items', DocDate: isoDate(), DocDueDate: body.DocDueDate || isoDate(new Date(Date.now() + 30 * 864e5)),
    CardCode: bp.CardCode, CardName: bp.CardName, NumAtCard: body.NumAtCard || null, Comments: body.Comments || null,
    DocCurrency: 'ZAR', DocTotal, VatSum: +(DocTotal - DocTotal / 1.15).toFixed(2), DocumentStatus: 'bost_Open', Cancelled: 'tNO',
    UpdateDate: isoDate(), UpdateTime: isoTime(), DocumentLines: lines, U_CRM_ID: body.U_CRM_ID || null,
  };
}
function closeBaseLines(doc) {
  for (const l of doc.DocumentLines) {
    if (l.BaseType < 0) continue;
    const list = db[docLists[Object.keys(objType).find((k) => objType[k] === l.BaseType)]];
    const src = list.find((d) => d.DocEntry === l.BaseEntry);
    if (src) { src.DocumentStatus = 'bost_Close'; src.UpdateDate = isoDate(); src.UpdateTime = isoTime(); }
  }
}
function recalcBalances() {
  for (const bp of db.businessPartners) {
    const open = db.invoices.filter((i) => i.CardCode === bp.CardCode && i.DocumentStatus === 'bost_Open');
    const bal = +(bp.OpeningBalance + open.reduce((s, i) => s + i.DocTotal, 0)).toFixed(2);
    if (bal !== bp.CurrentAccountBalance) { bp.CurrentAccountBalance = bal; bp.UpdateDate = isoDate(); bp.UpdateTime = isoTime(); }
    bp.OpenInvoicesCount = open.length;
  }
}

// ---------- HTTP ----------
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json;odata=minimalmetadata;charset=utf-8', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const b1error = (res, status, code, message) =>
  send(res, status, { error: { code, message: { lang: 'en-us', value: message } } });
const readBody = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { ok({}); } }); });
const keyOf = (seg) => { const m = seg.match(/^(\w+)\((?:'((?:[^']|'')*)'|(\d+))\)$/); return m ? { name: m[1], key: m[2] !== undefined ? m[2].replace(/''/g, "'") : Number(m[3]) } : { name: seg }; };

async function serviceLayer(req, res, url) {
  const segs = url.pathname.replace(/^\/b1s\/v1\/?/, '').split('/').filter(Boolean);
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};

  if (segs[0] === 'Login' && req.method === 'POST') {
    if (body.CompanyDB !== COMPANY_DB || body.UserName !== USER || body.Password !== PASS)
      return b1error(res, 401, 100000027, 'Fail to get DB Credentials from SLD');
    const SessionId = crypto.randomUUID();
    sessions.set(SessionId, Date.now());
    return send(res, 200, { 'odata.metadata': '$metadata#B1Sessions/@Element', SessionId, Version: '1000260', SessionTimeout: 30 },
      { 'Set-Cookie': [`B1SESSION=${SessionId}; HttpOnly`, 'ROUTEID=.node1; path=/b1s'] });
  }
  const sid = (req.headers.cookie || '').match(/B1SESSION=([\w-]+)/)?.[1];
  if (!sid || !sessions.has(sid) || Date.now() - sessions.get(sid) > 30 * 60e3)
    return b1error(res, 401, 301, 'Invalid session or session already timeout.');
  sessions.set(sid, Date.now());
  if (segs[0] === 'Logout') { sessions.delete(sid); return send(res, 204); }

  const { name, key } = keyOf(segs[0] || '');
  const action = segs[1];

  if (name === 'BusinessPartners') {
    const list = db.businessPartners;
    if (key === undefined && req.method === 'GET') return send(res, 200, collection(req, url, name, list));
    if (key === undefined && req.method === 'POST') {
      const CardCode = body.CardCode || `C${String(nextNum('bp')).padStart(5, '0')}`;
      if (list.some((b) => b.CardCode === CardCode)) return b1error(res, 400, -10, `This entry already exists in the following tables (ODBC -2035)`);
      const bp = { CardCode, CardName: body.CardName, CardType: body.CardType || 'cCustomer', GroupCode: body.GroupCode || 100,
        FederalTaxID: body.FederalTaxID || null, EmailAddress: body.EmailAddress || null, Phone1: body.Phone1 || null,
        Website: body.Website || null, PayTermsGrpCode: body.PayTermsGrpCode ?? 1, PriceListNum: body.PriceListNum ?? 1,
        CreditLimit: body.CreditLimit ?? 0, OpeningBalance: 0, CurrentAccountBalance: 0, OpenInvoicesCount: 0,
        Notes: body.Notes || 'Created from Twenty CRM', U_CRM_ID: body.U_CRM_ID || null,
        ContactEmployees: (body.ContactEmployees || []).map((c, i) => ({ InternalCode: nextNum('cnt'), CardCode, Name: c.Name, E_Mail: c.E_Mail || null, Phone1: c.Phone1 || null, Position: c.Position || null })),
        UpdateDate: isoDate(), UpdateTime: isoTime(), CreateDate: isoDate() };
      list.push(bp); save();
      log(`BP created ${CardCode} ${bp.CardName}`);
      return send(res, 201, bp);
    }
    const bp = list.find((b) => b.CardCode === key);
    if (!bp) return b1error(res, 404, -2028, 'No matching records found (ODBC -2028)');
    if (req.method === 'GET') return send(res, 200, project(bp, url.searchParams.get('$select')));
    if (req.method === 'PATCH') {
      const { ContactEmployees, CardCode, CurrentAccountBalance, ...rest } = body;
      Object.assign(bp, rest, { UpdateDate: isoDate(), UpdateTime: isoTime() });
      for (const c of ContactEmployees || []) {
        const ex = bp.ContactEmployees.find((x) => x.InternalCode === c.InternalCode || x.Name === c.Name);
        if (ex) Object.assign(ex, c); else bp.ContactEmployees.push({ InternalCode: nextNum('cnt'), CardCode: bp.CardCode, ...c });
      }
      save(); return send(res, 204);
    }
  }

  if (docLists[name]) {
    const list = db[docLists[name]];
    if (key === undefined && req.method === 'GET') return send(res, 200, collection(req, url, name, list));
    if (key === undefined && req.method === 'POST') {
      const doc = buildDoc(name, body);
      list.push(doc); closeBaseLines(doc); recalcBalances(); save();
      log(`${name} ${doc.DocNum} for ${doc.CardCode} R${doc.DocTotal}`);
      return send(res, 201, doc);
    }
    const doc = list.find((d) => d.DocEntry === key);
    if (!doc) return b1error(res, 404, -2028, 'No matching records found (ODBC -2028)');
    if (req.method === 'GET' && !action) return send(res, 200, project(doc, url.searchParams.get('$select')));
    if (req.method === 'PATCH') { const { DocumentLines, DocEntry, DocNum, ...rest } = body; Object.assign(doc, rest, { UpdateDate: isoDate(), UpdateTime: isoTime() }); save(); return send(res, 204); }
    if (req.method === 'POST' && (action === 'Close' || action === 'Cancel')) {
      doc.DocumentStatus = 'bost_Close'; if (action === 'Cancel') doc.Cancelled = 'tYES';
      doc.UpdateDate = isoDate(); doc.UpdateTime = isoTime(); recalcBalances(); save(); return send(res, 204);
    }
  }

  if (name === 'Items') {
    if (key === undefined && req.method === 'GET') return send(res, 200, collection(req, url, name, db.items));
    const it = db.items.find((i) => i.ItemCode === key);
    if (it && req.method === 'GET') return send(res, 200, project(it, url.searchParams.get('$select')));
  }
  if (name === 'PaymentTermsTypes') {
    if (key === undefined) return send(res, 200, collection(req, url, name, db.paymentTerms));
    const t = db.paymentTerms.find((p) => p.GroupNumber === key);
    if (t) return send(res, 200, t);
  }
  return b1error(res, 404, -1000, `Resource not found for the segment '${segs[0]}'`);
}

// ---------- mock admin page ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const R = (n) => 'R ' + Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function page() {
  const docs = (kind, list, extra = () => '') => `<h2>${kind}</h2><table><tr><th>DocNum</th><th>Date</th><th>Customer</th><th>Total incl. VAT</th><th>Status</th><th>From CRM</th><th></th></tr>${
    [...list].reverse().map((d) => `<tr><td>${d.DocNum}</td><td>${d.DocDate}</td><td>${esc(d.CardCode)} · ${esc(d.CardName)}</td><td class=n>${R(d.DocTotal)}</td><td>${d.DocumentStatus === 'bost_Open' ? 'Open' : 'Closed'}</td><td>${d.U_CRM_ID ? 'yes' : ''}</td><td>${extra(d)}</td></tr>`).join('') || '<tr><td colspan=7 class=q>None yet</td></tr>'}</table>`;
  return `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>SAP B1 (mock)</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;color:#1d2433;background:#f6f7f9}h1{font-size:20px;margin:0}h2{font-size:15px;margin:28px 0 8px}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #dde1e7}td,th{padding:6px 10px;border-bottom:1px solid #eef0f3;text-align:left;vertical-align:top}
th{background:#f0f2f5;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em}.n{text-align:right;font-variant-numeric:tabular-nums}.q{color:#7a8396}
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.tag{background:#ffe9a8;padding:2px 8px;border-radius:4px;font-size:12px}
button{font:inherit;padding:3px 10px;border:1px solid #9aa4b5;border-radius:4px;background:#fff;cursor:pointer}</style>
<div class=bar><h1>SAP Business One — mock Service Layer</h1><span class=tag>Demo data · company DB ${esc(COMPANY_DB)} · refreshes every 10 s</span></div>
<h2>Business partners</h2><table><tr><th>Card code</th><th>Name</th><th>Payment terms</th><th class=n>Credit limit</th><th class=n>Balance</th><th>Open invoices</th><th>Source</th></tr>${
  [...db.businessPartners].sort((a, b) => (b.CreateDate + b.CardCode).localeCompare(a.CreateDate + a.CardCode)).map((b) => `<tr><td>${esc(b.CardCode)}</td><td>${esc(b.CardName)}</td><td>${esc(db.paymentTerms.find((p) => p.GroupNumber === b.PayTermsGrpCode)?.PaymentTermsGroupName)}</td><td class=n>${R(b.CreditLimit)}</td><td class=n>${R(b.CurrentAccountBalance)}</td><td>${b.OpenInvoicesCount || 0}</td><td class=q>${b.U_CRM_ID ? 'Twenty CRM' : 'SAP'}</td></tr>`).join('')}</table>
${docs('Sales quotations', db.quotations)}
${docs('Sales orders', db.orders, (d) => d.DocumentStatus === 'bost_Open' ? `<form method=post action="/mock/invoice/${d.DocEntry}"><button>Post A/R invoice</button></form>` : '')}
${docs('A/R invoices', db.invoices, (d) => d.DocumentStatus === 'bost_Open' ? `<form method=post action="/mock/pay/${d.DocEntry}"><button>Mark paid</button></form>` : '')}
<script>setTimeout(()=>location.reload(),10000)</script>`;
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/b1s/v1')) return await serviceLayer(req, res, url);
    if (url.pathname === '/' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(page()); }
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    const inv = url.pathname.match(/^\/mock\/invoice\/(\d+)$/);
    if (inv && req.method === 'POST') {
      const order = db.orders.find((o) => o.DocEntry === Number(inv[1]));
      if (order && order.DocumentStatus === 'bost_Open') {
        const doc = buildDoc('Invoices', { CardCode: order.CardCode, U_CRM_ID: order.U_CRM_ID, Comments: `Based on sales order ${order.DocNum}`,
          DocumentLines: order.DocumentLines.map((l, i) => ({ BaseType: 17, BaseEntry: order.DocEntry, BaseLine: i })) });
        db.invoices.push(doc); closeBaseLines(doc); recalcBalances(); save(); log(`Invoice ${doc.DocNum} posted from order ${order.DocNum}`);
      }
      res.writeHead(303, { Location: '/' }); return res.end();
    }
    const pay = url.pathname.match(/^\/mock\/pay\/(\d+)$/);
    if (pay && req.method === 'POST') {
      const i = db.invoices.find((x) => x.DocEntry === Number(pay[1]));
      if (i) { i.DocumentStatus = 'bost_Close'; i.UpdateDate = isoDate(); i.UpdateTime = isoTime(); recalcBalances(); save(); log(`Invoice ${i.DocNum} paid`); }
      res.writeHead(303, { Location: '/' }); return res.end();
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    b1error(res, e.status || 400, e.code || -1, e.message);
  }
}).listen(PORT, () => log(`mock Service Layer on :${PORT}/b1s/v1 (company DB ${COMPANY_DB})`));
