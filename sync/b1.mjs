// Minimal SAP Business One Service Layer client (works against the real Service Layer and the mock).
// Session cookie login, automatic re-login on 401, OData paging via odata.nextLink.
if (process.env.B1_TLS_INSECURE === 'true') {
  // Real Service Layer installs often use a self-signed certificate. Prefer NODE_EXTRA_CA_CERTS
  // pointing at the B1 server's CA; this switch is a last resort for a LAN-only demo.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const BASE = (process.env.B1_URL || 'http://mock-b1:50000/b1s/v1').replace(/\/$/, '');
let cookie = null;

async function login() {
  const res = await fetch(`${BASE}/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ CompanyDB: process.env.B1_COMPANY_DB, UserName: process.env.B1_USER, Password: process.env.B1_PASSWORD }),
  });
  if (!res.ok) throw new Error(`B1 login failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const set = res.headers.getSetCookie?.() || [res.headers.get('set-cookie')];
  cookie = set.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

export async function b1(method, path, body, { retry = true } = {}) {
  if (!cookie) await login();
  const res = await fetch(path.startsWith('http') ? path : `${BASE}/${path.replace(/^\//, '')}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Prefer: 'odata.maxpagesize=100' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && retry) { cookie = null; return b1(method, path, body, { retry: false }); }
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(`B1 ${method} ${path} → ${res.status}: ${json?.error?.message?.value || text.slice(0, 200)}`);
    err.status = res.status; err.code = json?.error?.code;
    throw err;
  }
  return json;
}

export async function b1All(path) {
  const out = [];
  let next = path;
  while (next) {
    const json = await b1('GET', next);
    out.push(...(json.value || []));
    next = json['odata.nextLink'] || json['@odata.nextLink'] || null;
  }
  return out;
}

export const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
export const enc = encodeURIComponent;
