# Twenty CRM demo for Stage Audio Works

A self-hosted [Twenty](https://twenty.com) CRM set up for how SAW sells, with a mock SAP Business One
Service Layer and a sync service that links the two. One command installs it on a Proxmox LXC or VM.

| Part | What it is | Address |
| --- | --- | --- |
| Twenty | CRM with SAW's objects, fields, stages, views and demo data | `SERVER_URL` (port 3000) |
| Mock SAP B1 | Fake Service Layer at `/b1s/v1` plus a page showing BPs, quotes, orders, invoices | port 50000 |
| Sync service | Twenty ⇄ B1: quotes, orders, BPs, balances, stock | status page on port 8088 |

Everything in the demo data is invented except the customer names and installed systems, which come
from SAW's published case studies. All B1 figures (balances, prices, stock) are made up.

## 1. Create the container on Proxmox

A Debian 12 LXC is enough for the demo. On the Proxmox host:

```bash
# 4 cores, 8 GB RAM, 40 GB disk. Docker in an LXC needs nesting and keyctl.
pct create 220 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname saw-crm --cores 4 --memory 8192 --swap 1024 \
  --rootfs local-lvm:40 --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --features nesting=1,keyctl=1 --unprivileged 1 --onboot 1
pct start 220 && pct enter 220
apt update && apt install -y curl openssl git
```

Use a VM instead if you prefer a hard boundary; the steps after this are the same.
Put it on the same Proxmox server as SAP B1 later, or anywhere that can reach the B1 server on port 50000.

## 2. Install

Copy this folder into the container (for example to `/opt/saw-twenty-demo`), then:

```bash
cd /opt/saw-twenty-demo
./install.sh                                   # local only: http://<container-ip>:3000
./install.sh https://crm.stageaudioworks.com   # or with the public hostname you will use
```

The script installs Docker if needed, writes `.env` with fresh secrets, starts everything, and runs setup:

1. **bootstrap**: creates the admin (`ADMIN_EMAIL`), the *Stage Audio Works* workspace and an API key (saved in `state/twenty.json`)
2. **schema**: SAW fields on Companies, People and Opportunities, plus Projects, Installed systems, Support cases and Products, and the SAW pipeline stages
3. **views**: kanban columns, table columns, and the *Tenders*, *Won — in SAP*, *SAP B1 accounts* and *Warranty ending soonest* views
4. **seed**: demo accounts, contacts, deals, installed base and support cases
5. **webhook**: Twenty → sync service, HMAC-signed

The admin password is printed at the end and stored in `.env`. Sign in, click through Twenty's short
onboarding (name, skip invites), then change the password under Settings.

Setup is safe to rerun: `docker compose run --rm setup`. To run a single step: `docker compose run --rm setup node setup/run-all.mjs views`.

### Publishing through Cloudflare Tunnel

Same pattern as Postiz. In Cloudflare Zero Trust, create a tunnel, add a public hostname
(e.g. `crm.stageaudioworks.com`) pointing to `http://server:3000`, and copy the token. Then:

```bash
sed -i 's|^SERVER_URL=.*|SERVER_URL=https://crm.stageaudioworks.com|' .env
sed -i 's|^CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=<token>|' .env
docker compose --profile tunnel up -d
```

`SERVER_URL` must match the address people use, or sign-in links and email sync break. Publish only Twenty;
leave the mock B1 page and the sync status page on the LAN. Consider Cloudflare Access in front during the trial.

## 3. Running the demo

Open three tabs: Twenty, the mock SAP B1 page (`http://<ip>:50000`) and the sync status page (`http://<ip>:8088`).

1. **Pipeline.** Opportunities → *By Stage*. SAW's stages, deal types and brands on every card. Deals already at
   Proposal sent or Negotiation have SAP quotation numbers: the sync raised them in the mock B1 at startup.
2. **Account context from SAP.** Companies → *SAP B1 accounts*. Balance, credit limit, payment terms and open
   invoices come from B1. Christian Family Church and Gearworx have open invoices.
3. **Won deal becomes a sales order.** Drag *KSL rental inventory* (Highveld, Negotiation) to **Won**. Within a
   few seconds: the card shows an SAP sales order number, the mock B1 page lists the order, and the deal's
   timeline has a note for each B1 document.
4. **Hand-over to delivery.** Drag a project-type deal to Won (e.g. *Plenary hall tender*): a Project appears
   under Projects, linked to the account and the deal, status Planning.
5. **Finance acts in SAP, sales sees it.** On the mock B1 page, click *Post A/R invoice* on that order. Within a
   minute the deal's *SAP order status* reads *Invoiced* and the customer's balance rises. Click *Mark paid* and
   it drops again.
6. **New customer.** Create a company, set *SAP sync status* to *Pending push*: a business partner is created in B1
   and the card code is written back. A brand-new prospect reaching Proposal sent does the same automatically.
7. **Lost deal.** Move a quoted deal to Lost with a loss reason: its B1 quotation is closed.
8. **Installed base and stock.** Installed systems (from the case studies), Support cases, and Products with
   stock per warehouse, mirrored from B1.

To reset to a clean demo: `docker compose down -v && ./install.sh` (removes all data, including the mock B1).

## 4. Moving to the real SAP B1 (phase 3)

Do this against a **copy** of the company database first.

1. **Service Layer.** B1 10.0 or later on MS SQL includes it. Install it with the SAP Business One
   Component Wizard if it isn't already there; check `https://<b1-server>:50000/b1s/v1/` answers.
2. **B1 user.** Create a dedicated user (e.g. `crm-sync`) with access to business partners, sales quotations,
   sales orders, A/R invoices (read) and items (read).
3. **UDF.** Create the user-defined field `U_CRM_ID` (alphanumeric, 50) on *Business Partners* (OCRD), *Sales
   Quotations* (OQUT), *Sales Orders* (ORDR) and *A/R Invoices* (OINV). The sync uses it to find documents it
   created, so retries never duplicate.
4. **Lump-sum item.** Create a non-inventory item for CRM quotations (default code `PRJ-LUMPSUM`), or set
   `B1_LUMP_SUM_ITEM` to an existing one.
5. **Item brand.** The product sync reads brand from `U_Brand` on items; map it to your own field if it differs
   (`pullItems` in `sync/server.mjs`), and adjust the warehouse codes `MID01` / `WHK01`.
6. **Point the sync at it.** In `.env`:
   ```
   B1_URL=https://<b1-server>:50000/b1s/v1
   B1_COMPANY_DB=<company database>
   B1_USER=crm-sync
   B1_PASSWORD=<password>
   B1_HOST_ALLOWLIST=<b1-server hostname or IP>
   B1_WRITE_ENABLED=false     # start read-only: balances, stock, order status only
   ```
   For a self-signed certificate, mount the B1 CA into the `saw-sync` container and set `NODE_EXTRA_CA_CERTS`
   (or `B1_TLS_INSECURE=true` on a LAN-only test).
7. **Clean out demo data** before importing real accounts: `docker compose run --rm setup node setup/seed.mjs remove`,
   set `SEED_DEMO_DATA=false`, remove the `mock-b1` service, and `docker compose up -d`.
8. **Link existing customers** by putting each account's B1 card code in *SAP card code*; balances fill in on the
   next sweep. Turn on `B1_WRITE_ENABLED=true` once finance has checked a batch of quotations by hand.

## Files

```
docker-compose.yml     Twenty (server, worker, Postgres, Redis), mock B1, sync, setup, optional cloudflared
install.sh             one-command install
.env.example           all settings, documented
setup/saw-model.mjs    SAW data model: fields, options, stages, custom objects, relations  ← edit here
setup/views.mjs        kanban columns, table columns, saved views
setup/seed-data.mjs    demo records
setup/*.mjs            bootstrap, schema, seed, run-all, Twenty API helper
sync/server.mjs        sync service (webhook receiver + sweeps)
sync/b1.mjs            Service Layer client (session login, paging)
mock-b1/               mock Service Layer and its seed data
state/                 created at install: API key (keep private)
```

## Notes and limits

- Tested on `twentycrm/twenty:latest` built 27 Oct 2026. Twenty moves quickly; once the pilot starts, set
  `TWENTY_TAG` to that version in `.env` and test upgrades on a copy first. If a future release changes sign-up,
  create the admin and an API key in the UI, put the key in `TWENTY_API_KEY`, and rerun setup.
- Quotations from the CRM carry one lump-sum line at the deal value. The BOQ lines belong in the proposal; a
  later step can post them from the presales proposal output instead.
- The sync sweeps every 60 s (`SYNC_INTERVAL_SEC`) and refreshes products every 5 min. Webhooks make
  Twenty → B1 changes near-instant.
- Microsoft 365 mail and calendar sync needs an Azure app registration; fill the `AUTH_MICROSOFT_*` values and
  set `AUTH_MICROSOFT_ENABLED=true`.
