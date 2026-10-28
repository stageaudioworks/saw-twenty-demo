// Creates the first admin user, the "Stage Audio Works" workspace and an API key,
// using the same GraphQL calls Twenty's own sign-up screens make.
// Skipped when TWENTY_API_KEY is set or a key is already saved in the state file.
//
// Tested against twentycrm/twenty:latest built 2026-10-27. If a future release changes
// the sign-up flow, create the admin in the browser instead, make an API key under
// Settings → APIs & Webhooks, put it in .env as TWENTY_API_KEY and rerun setup.
import { TWENTY_URL, log, readState, writeState } from './lib.mjs';

const PUBLIC_ORIGIN = (process.env.SERVER_URL || 'http://localhost:3000').replace(/\/$/, '');

async function gql(query, variables, token) {
  const res = await fetch(`${TWENTY_URL}/metadata`, {
    method: 'POST',
    // No Origin header: this is a server-to-server call, and Twenty only issues session
    // cookies to browser origins it recognises.
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

export async function bootstrap() {
  if (process.env.TWENTY_API_KEY) {
    log('bootstrap: TWENTY_API_KEY set in .env, skipping');
    return;
  }
  const saved = readState().apiKey;
  if (saved) {
    // A saved key from a previous install is useless after the database was wiped.
    const res = await fetch(`${TWENTY_URL}/rest/metadata/objects?limit=1`, { headers: { Authorization: `Bearer ${saved}` } });
    if (res.ok) { log('bootstrap: saved API key works, skipping'); return; }
    log('bootstrap: saved API key no longer valid (fresh database?), creating a new one');
    writeState({ apiKey: null, workspaceId: null });
  }
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');

  // Sign up, or sign in if a previous run already created the admin (setup is resumable).
  log(`bootstrap: creating admin ${email}`);
  let workspaceAgnosticToken;
  let loginToken;
  let workspaceId;
  try {
    const d = await gql(
      `mutation($e:String!,$p:String!){ signUp(email:$e,password:$p){ tokens{ accessOrWorkspaceAgnosticToken{ token } } } }`,
      { e: email, p: password });
    workspaceAgnosticToken = d.signUp.tokens.accessOrWorkspaceAgnosticToken.token;
  } catch (e) {
    if (!/already exists/i.test(e.message)) throw new Error(`Sign-up failed: ${e.message}`);
    log('bootstrap: admin exists, signing in');
    const d = await gql(
      `mutation($e:String!,$p:String!){ signIn(email:$e,password:$p){
         tokens{ accessOrWorkspaceAgnosticToken{ token } }
         availableWorkspaces{ availableWorkspacesForSignIn{ id loginToken } } } }`,
      { e: email, p: password }).catch((err) => {
        throw new Error(`Admin ${email} exists but sign-in failed (${err.message}). Create an API key in the UI and set TWENTY_API_KEY.`);
      });
    workspaceAgnosticToken = d.signIn.tokens.accessOrWorkspaceAgnosticToken.token;
    const existing = d.signIn.availableWorkspaces.availableWorkspacesForSignIn?.[0];
    if (existing?.loginToken) { loginToken = existing.loginToken; workspaceId = existing.id; }
  }

  if (!loginToken) {
    log(`bootstrap: creating workspace "${process.env.WORKSPACE_NAME || 'Stage Audio Works'}"`);
    const ws = await gql(
      `mutation($n:String){ signUpInNewWorkspace(input:{displayName:$n}){ loginToken{ token } workspace{ id } } }`,
      { n: process.env.WORKSPACE_NAME || 'Stage Audio Works' }, workspaceAgnosticToken);
    loginToken = ws.signUpInNewWorkspace.loginToken.token;
    workspaceId = ws.signUpInNewWorkspace.workspace.id;
  }

  const tokens = await gql(
    `mutation($t:String!,$o:String!){ getAuthTokensFromLoginToken(loginToken:$t, origin:$o){ tokens{ accessOrWorkspaceAgnosticToken{ token } } } }`,
    { t: loginToken, o: PUBLIC_ORIGIN });
  const access = tokens.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;

  try {
    await gql(`mutation($n:String){ activateWorkspace(data:{displayName:$n}){ id activationStatus } }`,
      { n: process.env.WORKSPACE_NAME || 'Stage Audio Works' }, access);
  } catch (e) {
    if (!/already|active/i.test(e.message)) throw e; // resumed run: workspace already active
  }

  // Give the workspace a moment to finish creating its schema.
  let roleId;
  for (let i = 0; i < 30 && !roleId; i++) {
    const r = await gql(`{ getApiKeyRoles { id label } }`, {}, access);
    roleId = r.getApiKeyRoles.find((x) => x.label === 'Admin')?.id;
    if (!roleId) await new Promise((res) => setTimeout(res, 2000));
  }
  if (!roleId) throw new Error('Admin role for API keys not found');

  const expiresAt = new Date(Date.now() + 2 * 365 * 864e5).toISOString();
  const key = await gql(
    `mutation($n:String!,$x:String!,$r:UUID!){ createApiKey(input:{name:$n, expiresAt:$x, roleId:$r}){ id } }`,
    { n: 'saw-setup-and-sync', x: expiresAt, r: roleId }, access);
  const tok = await gql(
    `mutation($id:UUID!,$x:String!){ generateApiKeyToken(apiKeyId:$id, expiresAt:$x){ token } }`,
    { id: key.createApiKey.id, x: expiresAt }, access);

  writeState({ apiKey: tok.generateApiKeyToken.token, workspaceId });
  log('bootstrap: API key saved to state file');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap().catch((e) => { console.error(e.message); process.exit(1); });
}
