// Loads demo records. Skips anything that already exists by name, so it is safe to rerun.
import { twenty, listAll, one, log, zar } from './lib.mjs';
import { COMPANIES, PEOPLE, OPPORTUNITIES, INSTALLED, SUPPORT, PROJECTS, helpers } from './seed-data.mjs';

const { day, date } = helpers;
const create = async (plural, data) => one(await twenty('POST', `/rest/${plural}`, data));
const byName = async (plural) => Object.fromEntries((await listAll(plural)).map((r) => [typeof r.name === 'string' ? r.name : `${r.name?.firstName} ${r.name?.lastName}`, r]));

export async function seed() {
  log('seed: companies');
  const haveCo = await byName('companies');
  const co = {};
  for (const c of COMPANIES) {
    if (haveCo[c.name]) { co[c.key] = haveCo[c.name]; continue; }
    const { key, existing, city, country, ...fields } = c;
    co[key] = await create('companies', {
      ...fields,
      address: { addressCity: city, addressCountry: country },
      sapSyncStatus: c.sapCardCode ? 'LINKED' : 'NOT_LINKED',
    });
  }

  log('seed: people');
  const havePe = await byName('people');
  const person = {};
  for (const [k, first, last, title, jobRole, decisionRole] of PEOPLE) {
    const full = `${first} ${last}`;
    person[`${k}:${first}`] = havePe[full] || await create('people', {
      name: { firstName: first, lastName: last }, jobTitle: title, jobRole, decisionRole, companyId: co[k].id,
      emails: { primaryEmail: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com' },
    });
  }

  log('seed: opportunities');
  const haveOp = await byName('opportunities');
  for (const o of OPPORTUNITIES) {
    if (haveOp[o.name]) continue;
    await create('opportunities', {
      name: o.name, stage: o.stage, amount: zar(o.amount), closeDate: day(o.close),
      companyId: co[o.company].id, pointOfContactId: person[`${o.company}:${o.contact}`]?.id,
      dealType: o.dealType, serviceLines: o.serviceLines, brands: o.brands, market: o.market,
      venue: o.venue, expectedInstallDate: o.install ? date(o.install) : null, marginPercent: o.margin,
      biddingEntity: o.entity, tenderReference: o.tenderReference || null,
      tenderClosingDate: o.tenderClosing ? day(o.tenderClosing) : null, lossReason: o.lossReason || null,
      sapSyncStatus: 'NOT_LINKED',
    });
  }

  log('seed: projects');
  const havePr = await byName('projects');
  const proj = {};
  for (const p of PROJECTS) {
    proj[p.name] = havePr[p.name] || await create('projects', {
      name: p.name, status: p.status, sowStatus: p.sowStatus, handoverDate: p.handoverDate, companyId: co[p.company].id,
    });
  }

  log('seed: installed systems');
  const haveIs = await byName('installedSystems');
  const sys = {};
  for (const s of INSTALLED) {
    const project = PROJECTS.find((p) => p.systems?.includes(s.key));
    sys[s.key] = haveIs[s.name] || await create('installedSystems', {
      name: s.name, category: s.category, brand: s.brand, model: s.model || null,
      installDate: s.installDate || null, warrantyExpiry: s.warrantyExpiry || null,
      companyId: co[s.company].id, projectId: project ? proj[project.name].id : null,
    });
  }

  log('seed: support cases');
  const haveSc = await byName('supportCases');
  for (const s of SUPPORT) {
    if (haveSc[s.name]) continue;
    await create('supportCases', {
      name: s.name, caseType: s.caseType, status: s.status, priority: s.priority, branch: s.branch, details: s.details,
      companyId: co[s.company].id, installedSystemId: sys[s.system].id,
    });
  }
  log('seed: done');
}

// Removes the demo records listed in seed-data.mjs (by name). Leaves everything else alone.
export async function removeDemo() {
  const names = {
    supportCases: SUPPORT.map((s) => s.name), installedSystems: INSTALLED.map((s) => s.name),
    projects: [...PROJECTS.map((p) => p.name), ...OPPORTUNITIES.map((o) => o.name)],
    opportunities: OPPORTUNITIES.map((o) => o.name), people: PEOPLE.map((p) => `${p[1]} ${p[2]}`),
    companies: COMPANIES.map((c) => c.name),
  };
  for (const [plural, list] of Object.entries(names)) {
    const have = await byName(plural);
    let n = 0;
    for (const name of list) if (have[name]) { await twenty('DELETE', `/rest/${plural}/${have[name].id}`); n++; }
    log(`removed ${n} demo ${plural}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fn = process.argv[2] === 'remove' ? removeDemo : seed;
  fn().catch((e) => { console.error(e.message, e.body ? JSON.stringify(e.body).slice(0, 500) : ''); process.exit(1); });
}
