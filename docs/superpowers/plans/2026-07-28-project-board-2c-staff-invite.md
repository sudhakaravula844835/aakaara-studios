# Project Board 2c — Staff Invite Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Owner create real PM/Editor accounts (email invite, self-service password), deactivate/reactivate them without losing history, change their role, and assign them to specific projects — the last piece blocking sub-projects 3 (client view) and 4 (Editor view), which both need real staff/assignment data to exist.

**Architecture:** One new Netlify Edge Function (`invite-staff.ts`) holds the Supabase service-role key and is the only privileged operation (creating an `auth.users` account). Everything else — listing staff, changing role, deactivating/reactivating, assigning PM/editors to a project — is a direct Supabase client call from the board UI, relying on RLS the Owner already has. A new `profiles.active` column, folded into `current_profile_role()`, is the entire deactivation mechanism: it makes every existing RLS policy in the codebase deny a deactivated user automatically, with zero other policy changes.

**Tech Stack:** Vanilla JS ES modules (browser), Supabase JS client v2, Postgres/RLS (Supabase), Netlify Edge Functions (Deno/TypeScript), Vitest (integration tests against the live Supabase project).

## Global Constraints

- No build step — plain ES modules loaded via `<script type="module">`, matching every existing `board/*.js` file.
- Only an Owner (`role = 'owner' and active = true`) may invite or manage staff — enforced in the UI (an `.owner-only` class, revealed only after a confirmed Owner profile fetch) AND server-side (`invite-staff.ts` returns 403 for anyone else; `profiles_all_owner` RLS already blocks direct writes from non-Owners).
- Deactivation must never delete data — `activity_log`, `project_editors`, and `projects.pm_id` history for a deactivated user must remain exactly as they were.
- The Supabase service-role key must never reach the browser. It is read only via `Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY')` inside `netlify/edge-functions/invite-staff.ts`, which runs server-side.
- Match existing conventions exactly: `showErrorToast` (from `board-shared.js`) for user-facing errors, the null-vs-`[]` fetch-failure distinction already used in `board.js`'s `fetchProjects`, no optimistic UI updates beyond what 2a/2b already established.
- Reuse existing `board.css` classes (`.list-table`, `.form-input`, `.modal-box`, `.view-toggle-btn`, `.modal-grid`) rather than introducing a new visual language.
- New migrations are applied to the live Supabase project via the `mcp__claude_ai_Supabase__apply_migration` MCP tool first, then reconciled into a byte-matching local file in `board/supabase/migrations/`, per the existing convention documented in `board/README.md` (Foundation had to redo this after an earlier filename-ordering mistake — apply first, then name the local file to match exactly what Supabase assigned).

---

### Task 1: Schema — `profiles.active` + deactivation RLS gating

**Files:**
- Create: `board/supabase/migrations/<version>_staff_deactivation.sql` (exact filename determined in Step 3 below — Supabase assigns the timestamp when the migration is applied, this file must match it exactly)
- Test: `board/test/staff-deactivation.test.js`

**Interfaces:**
- Consumes: `board/test/helpers.js`'s `createTestProfile(role)`, `deleteTestProfile(id)`, `createTestProject(overrides)`, `deleteTestProject(id)`, `adminClient` (all already exist, unchanged).
- Produces: `profiles.active boolean not null default true` column, and `current_profile_role()` redefined to return `null` for any user with `active = false`. Every later task and every existing RLS policy in the codebase depends on this — it is the sole mechanism deactivation uses.

- [ ] **Step 1: Write the failing test**

Create `board/test/staff-deactivation.test.js`:

```javascript
import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestProfile, deleteTestProfile,
  createTestProject, deleteTestProject,
  adminClient,
} from './helpers.js';

describe('staff deactivation', () => {
  let pm;
  let project;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (pm) await deleteTestProfile(pm.id);
    pm = null;
    project = null;
  });

  it('active PM can update projects (baseline)', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject({ stage: 'booked' });

    const { data, error } = await pm.client
      .from('projects')
      .update({ stage: 'shoot_completed' })
      .eq('id', project.id)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('deactivated PM loses all RLS-gated access immediately, without re-login', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject({ stage: 'booked' });

    const before = await pm.client.from('projects').select('id').eq('id', project.id);
    expect(before.data).toHaveLength(1);

    await adminClient.from('profiles').update({ active: false }).eq('id', pm.id);

    // Same already-signed-in client, no re-login -- current_profile_role()
    // is evaluated fresh on every RLS check, so deactivation must take
    // effect on the very next query, not just for a future session.
    const { data: reads } = await pm.client.from('projects').select('id').eq('id', project.id);
    expect(reads).toHaveLength(0);

    const { data: writes } = await pm.client
      .from('projects')
      .update({ stage: 'shoot_completed' })
      .eq('id', project.id)
      .select();
    expect(writes ?? []).toHaveLength(0);

    const { data: unchanged } = await adminClient.from('projects').select('stage').eq('id', project.id).single();
    expect(unchanged.stage).toBe('booked');
  });

  it('deactivated user can still read their own profile row', async () => {
    pm = await createTestProfile('pm');
    await adminClient.from('profiles').update({ active: false }).eq('id', pm.id);

    const { data, error } = await pm.client.from('profiles').select('active').eq('id', pm.id).single();
    expect(error).toBeNull();
    expect(data.active).toBe(false);
  });

  it('reactivating restores access without re-login', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject({ stage: 'booked' });
    await adminClient.from('profiles').update({ active: false }).eq('id', pm.id);
    await adminClient.from('profiles').update({ active: true }).eq('id', pm.id);

    const { data } = await pm.client.from('projects').select('id').eq('id', project.id);
    expect(data).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- board/test/staff-deactivation.test.js`
Expected: FAIL — `profiles.active` does not exist yet, so `adminClient.from('profiles').update({ active: false })` errors, causing the deactivation-dependent assertions to fail.

- [ ] **Step 3: Apply the migration to the live Supabase project**

Call the `mcp__claude_ai_Supabase__apply_migration` MCP tool with `name: "staff_deactivation"` and this SQL:

```sql
alter table profiles add column active boolean not null default true;

create or replace function current_profile_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid() and active = true;
$$;
```

Then call `mcp__claude_ai_Supabase__list_migrations` and note the exact `version` Supabase assigned to this migration (a timestamp like `20260728120000`).

- [ ] **Step 4: Create the matching local migration file**

Create `board/supabase/migrations/<version>_staff_deactivation.sql` (using the exact version from Step 3) with the exact same SQL shown in Step 3 — this keeps the local migration history byte-identical to `supabase_migrations.schema_migrations`, the same reconciliation Foundation's migrations already follow.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- board/test/staff-deactivation.test.js`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add board/supabase/migrations/*_staff_deactivation.sql board/test/staff-deactivation.test.js
git commit -m "feat(board): add profiles.active deactivation flag, gated in current_profile_role()"
```

---

### Task 2: Invite Edge Function

**Files:**
- Create: `netlify/edge-functions/invite-staff.ts`
- Modify: `netlify.toml`
- Modify: `vitest.config.js`
- Test: `board/test/invite-staff-function.test.js`

**Interfaces:**
- Consumes: `profiles.active` column and gated `current_profile_role()` from Task 1 (used implicitly — the caller-verification query checks `role = 'owner' and active = true` directly, not through `current_profile_role()`, since this runs with the service-role client which bypasses RLS entirely).
- Produces: a `POST /board/api/invite-staff` endpoint. Request: `Authorization: Bearer <supabase session JWT>`, JSON body `{ email: string, full_name: string, role: 'pm' | 'editor' }`. Response: `200 { id, email, full_name, role }` on success; `401`/`403`/`400`/`500 { error: string }` on failure. Task 3's `board/staff.js` calls this exact endpoint/contract via `fetch()`.

This task also verified, empirically, that Vitest can import and directly test a Netlify Edge Function's `.ts` module: the file's `import type { Config } from "https://edge.netlify.com"` is erased entirely by esbuild's TypeScript transform (never resolved at runtime), and aliasing the `https://esm.sh/@supabase/supabase-js@2` specifier to the already-installed npm package (added to `vitest.config.js` below) lets the real `createClient` run under Node. Global `Request`/`Response` are already available under this project's Vitest+jsdom setup — no polyfill needed.

- [ ] **Step 1: Add the module alias to `vitest.config.js`**

Modify `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.spec.js', '**/.claude/**'],
    setupFiles: ['./board/test/vitest.setup.js'],
  },
  resolve: {
    alias: {
      // invite-staff.ts (a Deno/Netlify Edge Function) imports supabase-js by
      // URL -- the only way Deno resolves bare ESM imports. Under Vitest/Node,
      // alias that exact specifier to the already-installed npm package so
      // board/test/invite-staff-function.test.js can import the edge
      // function module directly, instead of needing a Deno/netlify-dev
      // process just to exercise its logic.
      'https://esm.sh/@supabase/supabase-js@2': '@supabase/supabase-js',
    },
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `board/test/invite-staff-function.test.js`:

```javascript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createTestProfile, deleteTestProfile, adminClient } from './helpers.js';

let handler;

beforeAll(async () => {
  // The edge function reads its secrets via Netlify.env.get() -- a global
  // only present in the deployed/netlify-dev runtime. Stub it here so the
  // module's exported handler behaves the same way under Vitest, sourced
  // from the same board/.env values board/test/helpers.js already requires.
  globalThis.Netlify = { env: { get: (name) => process.env[name] } };
  ({ default: handler } = await import('../../netlify/edge-functions/invite-staff.ts'));
});

function inviteRequest(jwt, body) {
  return new Request('https://example.com/board/api/invite-staff', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(jwt ? { authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('invite-staff edge function', () => {
  let owner;
  let pm;
  let invitedId;

  afterEach(async () => {
    if (invitedId) await deleteTestProfile(invitedId);
    if (owner) await deleteTestProfile(owner.id);
    if (pm) await deleteTestProfile(pm.id);
    owner = null;
    pm = null;
    invitedId = null;
  });

  it('rejects a request with no authorization header', async () => {
    const res = await handler(inviteRequest(null, { email: 'x@example.com', full_name: 'X', role: 'pm' }));
    expect(res.status).toBe(401);
  });

  it('rejects a non-Owner caller (PM) with 403 and creates no account', async () => {
    pm = await createTestProfile('pm');
    const { data: session } = await pm.client.auth.getSession();
    const email = `blocked-${Date.now()}@example.com`;
    const res = await handler(inviteRequest(session.session.access_token, {
      email, full_name: 'Blocked', role: 'editor',
    }));
    expect(res.status).toBe(403);

    const { data: rows } = await adminClient.from('profiles').select('id').eq('email', email);
    expect(rows).toHaveLength(0);
  });

  it('rejects a deactivated Owner even with a validly signed token', async () => {
    owner = await createTestProfile('owner');
    await adminClient.from('profiles').update({ active: false }).eq('id', owner.id);
    const { data: session } = await owner.client.auth.getSession();
    const res = await handler(inviteRequest(session.session.access_token, {
      email: `blocked-${Date.now()}@example.com`, full_name: 'Blocked', role: 'editor',
    }));
    expect(res.status).toBe(403);
  });

  it('a valid Owner invite creates both the auth account and the profiles row', async () => {
    owner = await createTestProfile('owner');
    const { data: session } = await owner.client.auth.getSession();
    const email = `invited-${Date.now()}@example.com`;

    const res = await handler(inviteRequest(session.session.access_token, {
      email, full_name: 'New Editor', role: 'editor',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    invitedId = json.id;

    const { data: profile } = await adminClient.from('profiles').select('*').eq('id', invitedId).single();
    expect(profile.role).toBe('editor');
    expect(profile.full_name).toBe('New Editor');
    expect(profile.active).toBe(true);
  });

  it('rejects an invalid role', async () => {
    owner = await createTestProfile('owner');
    const { data: session } = await owner.client.auth.getSession();
    const res = await handler(inviteRequest(session.session.access_token, {
      email: `bad-${Date.now()}@example.com`, full_name: 'Bad Role', role: 'owner',
    }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:unit -- board/test/invite-staff-function.test.js`
Expected: FAIL — `netlify/edge-functions/invite-staff.ts` does not exist yet, so the dynamic `import()` in `beforeAll` throws.

- [ ] **Step 4: Write the edge function**

Create `netlify/edge-functions/invite-staff.ts`:

```typescript
import type { Config } from "https://edge.netlify.com";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function env(name: string): string {
  return Netlify.env.get(name)?.trim() || "";
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const VALID_ROLES = ["pm", "editor"];

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Staff invites are not configured." }, 503);
  }

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) {
    return jsonResponse({ error: "Missing authorization." }, 401);
  }

  let body: { email?: string; full_name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const email = (body.email || "").trim();
  const fullName = (body.full_name || "").trim();
  const role = body.role || "";

  if (!email || !fullName || !VALID_ROLES.includes(role)) {
    return jsonResponse({ error: "email, full_name, and a valid role (pm or editor) are required." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Trust boundary: getUser() validates the JWT's signature and expiry
  // against Supabase Auth itself. Decoding the token's payload directly,
  // without this call, would let anyone forge a token claiming an
  // arbitrary `sub` and skip straight to the profiles lookup below.
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return jsonResponse({ error: "Invalid or expired session." }, 401);
  }

  const { data: callerProfile, error: profileError } = await admin
    .from("profiles")
    .select("role, active")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !callerProfile || callerProfile.role !== "owner" || !callerProfile.active) {
    return jsonResponse({ error: "Only the Owner can invite staff." }, 403);
  }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError || !inviteData?.user) {
    return jsonResponse({ error: inviteError?.message || "Could not send invite." }, 400);
  }

  const { error: insertError } = await admin.from("profiles").insert({
    id: inviteData.user.id,
    role,
    full_name: fullName,
    email,
    active: true,
  });

  if (insertError) {
    // The auth.users account now exists but has no matching profiles row --
    // clean it up so a failed invite doesn't leave an orphaned, roleless
    // account that can technically authenticate but has no board access,
    // and that would block a retry with the same email.
    await admin.auth.admin.deleteUser(inviteData.user.id);
    return jsonResponse({ error: "Could not create staff profile — please try again." }, 500);
  }

  return jsonResponse({ id: inviteData.user.id, email, full_name: fullName, role }, 200);
};

export const config: Config = {
  path: "/board/api/invite-staff",
  onError: "fail",
};
```

- [ ] **Step 5: Register the edge function in `netlify.toml`**

Modify `netlify.toml`, adding a second `[[edge_functions]]` block after the existing `/admin/*` one:

```toml
[[edge_functions]]
  path = "/admin/*"
  function = "admin-auth"

[[edge_functions]]
  path = "/board/api/invite-staff"
  function = "invite-staff"
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test:unit -- board/test/invite-staff-function.test.js`
Expected: PASS (5 tests)

- [ ] **Step 7: Smoke-test under the real Netlify Edge runtime**

The Vitest tests above prove the handler's *logic* is correct, but they run under Node, not Deno — a syntax or API construct valid in Node/esbuild's TS transform but invalid under Netlify's actual Deno runtime would still pass Step 6 and only surface after deploying. Catch that now:

```bash
# Root .env for netlify dev (NOT board/.env -- this one is read by the
# Netlify CLI itself, gitignored the same way board/.env already is).
printf 'SUPABASE_URL=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\n' \
  "$(grep SUPABASE_URL board/.env | cut -d= -f2)" \
  "$(grep SUPABASE_SERVICE_ROLE_KEY board/.env | cut -d= -f2)" > .env
netlify dev --port 8888 &
sleep 5
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8888/board/api/invite-staff \
  -H 'content-type: application/json' -d '{}'
# Expected: 401 (no authorization header) -- confirms Deno loaded and ran
# the function without a syntax/runtime error, distinct from a 404 (route
# not registered) or 500 (the function itself crashed on load).
kill %1
rm .env
```

Expected: `401`. If instead a `404` or connection error, the `netlify.toml` edge function registration is wrong; if `500`, check `netlify dev`'s terminal output for a Deno-level error in `invite-staff.ts`.

- [ ] **Step 8: Commit**

```bash
git add netlify/edge-functions/invite-staff.ts netlify.toml vitest.config.js board/test/invite-staff-function.test.js
git commit -m "feat(board): add invite-staff Netlify Edge Function"
```

**Deployment note (flag to the user, do not attempt yourself):** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be set as real environment variables on the Netlify site (Site configuration → Environment variables) before this works in production — this is a dashboard action outside what a migration or code change can do, in the same category as the two Supabase Auth dashboard toggles already flagged from Foundation.

---

### Task 3: Staff Page UI

**Files:**
- Create: `board/staff.js`
- Modify: `board/index.html`
- Modify: `board/board.js`
- Modify: `board/board.css`

**Interfaces:**
- Consumes: `POST /board/api/invite-staff` from Task 2. `profiles.active` from Task 1.
- Produces: `renderStaffView()` exported from `board/staff.js` (async, no args — reads/writes `#staffTableWrap`). Wired into `board.js` as the 4th `currentView` value `'staff'`. The `.owner-only` / `.owner-visible` CSS/JS convention this task introduces for gating the Staff nav button is local to this task — no later task depends on it.

- [ ] **Step 1: Add the Staff nav button, view container, and Invite modal to `board/index.html`**

Modify the `#viewToggle` block:

```html
<div class="view-toggle" id="viewToggle" role="group" aria-label="Board view">
  <button class="view-toggle-btn active" data-view="kanban" type="button">Kanban</button>
  <button class="view-toggle-btn" data-view="list" type="button">List</button>
  <button class="view-toggle-btn" data-view="calendar" type="button">Calendar</button>
  <button class="view-toggle-btn owner-only" data-view="staff" type="button" id="staffToggleBtn">Staff</button>
</div>
```

Modify `<main class="board-main">`:

```html
<main class="board-main">
  <div class="board-columns view-active" id="boardColumns"></div>
  <div class="list-view-container" id="listViewContainer"></div>
  <div class="calendar-view-container" id="calendarViewContainer"></div>
  <div class="staff-view-container" id="staffViewContainer">
    <div class="staff-view-header">
      <button class="btn-invite-staff owner-only owner-visible" id="inviteStaffBtn" type="button">+ Invite Staff</button>
    </div>
    <div id="staffTableWrap"></div>
  </div>
</main>
```

(`inviteStaffBtn` gets both `owner-only` and `owner-visible` because it lives inside `#staffViewContainer`, which is itself only reachable by clicking the already-gated `#staffToggleBtn` — but since `.owner-only` defaults to `display:none` globally, it needs `owner-visible` too so it isn't invisible *inside* the one view where it's supposed to always show. `#staffToggleBtn` does NOT get `owner-visible` by default — board.js's init() adds it only after confirming the signed-in profile is actually an Owner.)

Add the Invite Staff modal, as a sibling of the other modal-backdrop divs (e.g. right after the Sub-Event modal, before the closing script tags):

```html
<!-- Invite Staff Modal -->
<div class="modal-backdrop" id="inviteModalBackdrop">
  <div class="modal-box modal-box-small" role="dialog" aria-modal="true" aria-labelledby="inviteModalTitle">
    <div class="modal-header">
      <div class="modal-title" id="inviteModalTitle">Invite Staff</div>
      <button class="modal-close" id="inviteModalClose" aria-label="Close">&times;</button>
    </div>
    <form class="modal-form" id="inviteForm" novalidate>
      <div class="modal-grid modal-grid-single">
        <div class="form-group">
          <label class="form-label" for="iFullName">Full Name</label>
          <input class="form-input" type="text" id="iFullName" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="iEmail">Email</label>
          <input class="form-input" type="email" id="iEmail" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="iRole">Role</label>
          <select class="form-input" id="iRole">
            <option value="pm">PM</option>
            <option value="editor">Editor</option>
          </select>
        </div>
        <div class="form-error" id="inviteError"></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-modal-cancel" id="inviteModalCancel">Cancel</button>
        <button type="submit" class="btn-modal-save">Send Invite</button>
      </div>
    </form>
  </div>
</div>
```

Add the new script tag, alongside the other view scripts:

```html
<script type="module" src="project-modal.js"></script>
<script type="module" src="list-view.js"></script>
<script type="module" src="calendar-view.js"></script>
<script type="module" src="staff.js"></script>
<script type="module" src="board.js"></script>
```

- [ ] **Step 2: Write `board/staff.js`**

Create `board/staff.js`:

```javascript
import { supabase } from './supabase-client.js';
import { showErrorToast } from './board-shared.js';

export async function renderStaffView() {
  const wrap = document.getElementById('staffTableWrap');
  wrap.innerHTML = '';

  const [{ data: staffData, error }, { data: userData }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, active').order('full_name', { ascending: true }),
    supabase.auth.getUser(),
  ]);

  if (error) {
    showErrorToast('Could not load staff.');
    return;
  }

  const currentUserId = userData.user?.id;

  const table = document.createElement('table');
  table.className = 'list-table staff-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Name', 'Email', 'Role', 'Status'].forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  if (staffData.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 4;
    emptyCell.className = 'list-empty';
    emptyCell.textContent = 'No staff yet.';
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  } else {
    staffData.forEach(staff => tbody.appendChild(renderStaffRow(staff, currentUserId)));
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
}

function renderStaffRow(staff, currentUserId) {
  const row = document.createElement('tr');
  row.className = 'list-row staff-row';

  const isSelf = staff.id === currentUserId;
  const isOwnerRow = staff.role === 'owner';

  const nameCell = document.createElement('td');
  nameCell.textContent = staff.full_name;
  row.appendChild(nameCell);

  const emailCell = document.createElement('td');
  emailCell.textContent = staff.email;
  row.appendChild(emailCell);

  const roleCell = document.createElement('td');
  if (isOwnerRow || isSelf) {
    roleCell.textContent = staff.role === 'owner' ? 'Owner' : (staff.role === 'pm' ? 'PM' : 'Editor');
  } else {
    const select = document.createElement('select');
    select.className = 'list-stage-select';
    [['pm', 'PM'], ['editor', 'Editor']].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      if (value === staff.role) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', async () => {
      const newRole = select.value;
      const previousRole = staff.role;
      select.disabled = true;
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', staff.id);
      select.disabled = false;
      if (error) {
        select.value = previousRole;
        showErrorToast('Could not update role — please try again.');
        return;
      }
      await renderStaffView();
    });
    roleCell.appendChild(select);
  }
  row.appendChild(roleCell);

  const statusCell = document.createElement('td');
  const statusBadge = document.createElement('span');
  statusBadge.className = 'staff-status-badge' + (staff.active ? ' staff-status-active' : ' staff-status-inactive');
  statusBadge.textContent = staff.active ? 'Active' : 'Deactivated';
  statusCell.appendChild(statusBadge);

  if (!isOwnerRow && !isSelf) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'staff-status-toggle';
    toggleBtn.textContent = staff.active ? 'Deactivate' : 'Reactivate';
    toggleBtn.addEventListener('click', async () => {
      toggleBtn.disabled = true;
      const { error } = await supabase.from('profiles').update({ active: !staff.active }).eq('id', staff.id);
      toggleBtn.disabled = false;
      if (error) {
        showErrorToast('Could not update status — please try again.');
        return;
      }
      await renderStaffView();
    });
    statusCell.appendChild(toggleBtn);
  }
  row.appendChild(statusCell);

  return row;
}

function openInviteModal() {
  document.getElementById('inviteForm').reset();
  document.getElementById('inviteError').textContent = '';
  document.getElementById('inviteModalBackdrop').classList.add('open');
  document.getElementById('iFullName').focus();
}

function closeInviteModal() {
  document.getElementById('inviteModalBackdrop').classList.remove('open');
}

async function handleInviteFormSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById('inviteError');
  errorEl.textContent = '';

  const fullName = document.getElementById('iFullName').value.trim();
  const email = document.getElementById('iEmail').value.trim();
  const role = document.getElementById('iRole').value;

  if (!fullName || !email) {
    errorEl.textContent = 'Name and email are required.';
    return;
  }

  const submitBtn = document.querySelector('#inviteForm button[type="submit"]');
  submitBtn.disabled = true;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    submitBtn.disabled = false;
    errorEl.textContent = 'Your session has expired — please log in again.';
    return;
  }

  try {
    const res = await fetch('/board/api/invite-staff', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email, full_name: fullName, role }),
    });
    const json = await res.json();
    submitBtn.disabled = false;

    if (!res.ok) {
      errorEl.textContent = json.error || 'Could not send invite — please try again.';
      return;
    }

    closeInviteModal();
    await renderStaffView();
  } catch {
    submitBtn.disabled = false;
    errorEl.textContent = 'Could not reach the server — please try again.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('inviteStaffBtn').addEventListener('click', openInviteModal);
  document.getElementById('inviteForm').addEventListener('submit', handleInviteFormSubmit);
  document.getElementById('inviteModalClose').addEventListener('click', closeInviteModal);
  document.getElementById('inviteModalCancel').addEventListener('click', closeInviteModal);
  document.getElementById('inviteModalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'inviteModalBackdrop') closeInviteModal();
  });
});
```

- [ ] **Step 3: Wire the Staff view into `board/board.js`**

Modify the import block at the top of `board/board.js`:

```javascript
import { renderListView } from './list-view.js';
import { renderCalendarView } from './calendar-view.js';
import { renderStaffView } from './staff.js';
```

Modify `renderActiveView()`:

```javascript
function renderActiveView() {
  if (currentView === 'kanban') renderBoard();
  else if (currentView === 'list') renderListView(currentProjects);
  else if (currentView === 'calendar') renderCalendarView(currentProjects);
  else if (currentView === 'staff') renderStaffView();
}
```

Modify `setActiveView()`:

```javascript
function setActiveView(view) {
  currentView = view;
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.getElementById('boardColumns').classList.toggle('view-active', view === 'kanban');
  document.getElementById('listViewContainer').classList.toggle('view-active', view === 'list');
  document.getElementById('calendarViewContainer').classList.toggle('view-active', view === 'calendar');
  document.getElementById('staffViewContainer').classList.toggle('view-active', view === 'staff');
  renderActiveView();
}
```

Modify `init()` — reveal `.owner-only` elements only after a confirmed Owner profile, right after the existing `fetchProfile` call:

```javascript
  const profile = await fetchProfile(user.id);
  if (profile) {
    setCurrentProfile(profile);
    if (profile.role === 'owner') {
      document.querySelectorAll('.owner-only').forEach(el => el.classList.add('owner-visible'));
    }
  }
```

(This replaces the existing two-line `if (profile) setCurrentProfile(profile);` block.)

- [ ] **Step 4: Add Staff view + owner-only styles to `board/board.css`**

Append to `board/board.css`:

```css
/* Owner-only visibility -- hidden by default; board.js reveals it only
   after confirming the signed-in profile's role is 'owner'. */
.owner-only { display: none; }
.owner-only.owner-visible { display: inline-block; }

/* Staff view */
.staff-view-container { display: none; padding: 1.5rem 2rem; overflow-x: auto; }
.staff-view-container.view-active { display: block; }
.staff-view-header { display: flex; justify-content: flex-end; margin-bottom: 1rem; }
.btn-invite-staff {
  padding: 0.5rem 1rem; border-radius: 6px; font-family: var(--font-body);
  font-size: 0.7rem; letter-spacing: 0.08em; cursor: pointer; transition: background 0.2s var(--ease);
  background: rgba(201,149,107,0.12); border: 1px solid rgba(201,149,107,0.35); color: var(--rose);
}
.btn-invite-staff:hover { background: rgba(201,149,107,0.22); }
.staff-table th { cursor: default; }
.staff-status-badge {
  display: inline-block; padding: 0.2rem 0.6rem; border-radius: 12px;
  font-size: 0.65rem; letter-spacing: 0.05em; text-transform: uppercase; margin-right: 0.6rem;
}
.staff-status-active { background: rgba(120,190,120,0.12); border: 1px solid rgba(120,190,120,0.3); color: #8fd98f; }
.staff-status-inactive { background: rgba(224,112,112,0.12); border: 1px solid rgba(224,112,112,0.3); color: #e07070; }
.staff-status-toggle {
  background: none; border: 1px solid rgba(201,149,107,0.15); color: rgba(250,246,241,0.5);
  border-radius: 4px; padding: 0.3rem 0.6rem; font-size: 0.65rem; cursor: pointer;
  transition: all 0.15s var(--ease);
}
.staff-status-toggle:hover { border-color: rgba(201,149,107,0.3); color: var(--ivory); }
```

- [ ] **Step 5: Run the full unit suite to confirm no regression**

Run: `npm run test:unit`
Expected: PASS, all existing + new tests green (this task adds no new pure functions/unit tests of its own — it's DOM wiring, verified for real in Task 6's manual pass).

- [ ] **Step 6: Commit**

```bash
git add board/staff.js board/index.html board/board.js board/board.css
git commit -m "feat(board): add Owner-only Staff page (list, invite, role change, deactivate)"
```

---

### Task 4: PM/Editor Assignment Picker

**Files:**
- Modify: `board/project-modal.js`
- Modify: `board/index.html`
- Modify: `board/board.css`

**Interfaces:**
- Consumes: `profiles.active` from Task 1. Does not depend on Task 2 or 3.
- Produces: `openProjectModal(project)` becomes `async` (was synchronous) — its two existing call sites (`board.js`'s `addProjectBtn` click handler, `project-modal.js`'s own `detailEditBtn` click handler) already call it as a fire-and-forget from a click handler, so this is not a breaking change to either caller.

- [ ] **Step 1: Add the assignment fields to the project modal in `board/index.html`**

Modify the `.modal-grid` inside `#projectForm`, adding these two `form-group` blocks (placed after the existing Package Tier field, before Hours Booked — order is cosmetic, any position inside the grid works):

```html
<div class="form-group">
  <label class="form-label" for="fPmId">Project Manager</label>
  <select class="form-input" id="fPmId"></select>
</div>
<div class="form-group form-full">
  <label class="form-label" for="fEditorIds">Editors</label>
  <select class="form-input form-multiselect" id="fEditorIds" multiple></select>
</div>
```

- [ ] **Step 2: Add multi-select sizing to `board/board.css`**

Append to `board/board.css`:

```css
.form-group .form-input.form-multiselect { min-height: 100px; padding: 0.4rem; }
```

- [ ] **Step 3: Add assignment loading/saving to `board/project-modal.js`**

Add these two new functions (place them above `openProjectModal`):

```javascript
async function loadStaffOptions() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['pm', 'editor'])
    .eq('active', true)
    .order('full_name', { ascending: true });
  if (error) {
    showErrorToast('Could not load staff for assignment.');
    return { pms: [], editors: [] };
  }
  return {
    pms: data.filter(p => p.role === 'pm'),
    editors: data.filter(p => p.role === 'editor'),
  };
}

async function populateAssignmentFields(project) {
  const { pms, editors } = await loadStaffOptions();

  const pmSelect = document.getElementById('fPmId');
  pmSelect.innerHTML = '';
  const unassignedOption = document.createElement('option');
  unassignedOption.value = '';
  unassignedOption.textContent = 'Unassigned';
  pmSelect.appendChild(unassignedOption);
  pms.forEach(pm => {
    const option = document.createElement('option');
    option.value = pm.id;
    option.textContent = pm.full_name;
    if (project && project.pm_id === pm.id) option.selected = true;
    pmSelect.appendChild(option);
  });

  let assignedEditorIds = [];
  if (project) {
    const { data } = await supabase.from('project_editors').select('editor_id').eq('project_id', project.id);
    assignedEditorIds = (data || []).map(row => row.editor_id);
  }

  const editorSelect = document.getElementById('fEditorIds');
  editorSelect.innerHTML = '';
  editors.forEach(editor => {
    const option = document.createElement('option');
    option.value = editor.id;
    option.textContent = editor.full_name;
    if (assignedEditorIds.includes(editor.id)) option.selected = true;
    editorSelect.appendChild(option);
  });
}

async function saveEditorAssignments(projectId) {
  const editorSelect = document.getElementById('fEditorIds');
  const selectedIds = Array.from(editorSelect.selectedOptions).map(o => o.value);

  const { error: deleteError } = await supabase.from('project_editors').delete().eq('project_id', projectId);
  if (deleteError) return deleteError;

  if (selectedIds.length === 0) return null;

  const { error: insertError } = await supabase.from('project_editors').insert(
    selectedIds.map(editorId => ({ project_id: projectId, editor_id: editorId }))
  );
  return insertError;
}
```

- [ ] **Step 4: Wire assignment fields into `openProjectModal` and `handleProjectFormSubmit`**

Modify `openProjectModal` — change its signature to `async` and add a call to `populateAssignmentFields` before opening the backdrop:

```javascript
export async function openProjectModal(project) {
  const backdrop = document.getElementById('projectModalBackdrop');
  const form = document.getElementById('projectForm');
  form.reset();
  document.getElementById('fClientNameError').textContent = '';
  document.getElementById('projectModalTitle').textContent = project ? 'Edit Project' : 'New Project';

  document.getElementById('fId').value = project ? project.id : '';
  document.getElementById('fClientName').value = project ? project.client_name : '';
  document.getElementById('fClientEmail').value = project ? (project.client_email || '') : '';
  document.getElementById('fClientPhone').value = project ? (project.client_phone || '') : '';
  document.getElementById('fPackageTier').value = project ? (project.package_tier || '') : '';
  document.getElementById('fHoursBooked').value = project ? (project.hours_booked ?? '') : '';
  document.getElementById('fQuotedPrice').value = project ? (project.quoted_price ?? '') : '';
  document.getElementById('fConfirmedPrice').value = project ? (project.confirmed_price ?? '') : '';
  document.getElementById('fDepositPaid').checked = project ? !!project.deposit_paid : false;
  document.getElementById('fBalancePaid').checked = project ? !!project.balance_paid : false;
  document.getElementById('fContractUrl').value = project ? (project.contract_url || '') : '';
  document.getElementById('fQuotePdfUrl').value = project ? (project.quote_pdf_url || '') : '';

  await populateAssignmentFields(project);

  backdrop.classList.add('open');
  document.getElementById('fClientName').focus();
}
```

Modify `handleProjectFormSubmit` — add `pm_id` to `fields`, and replace the existing insert/update + error-handling block:

```javascript
async function handleProjectFormSubmit(e) {
  e.preventDefault();

  const fields = {
    client_name: document.getElementById('fClientName').value.trim(),
    client_email: document.getElementById('fClientEmail').value.trim() || null,
    client_phone: document.getElementById('fClientPhone').value.trim() || null,
    package_tier: document.getElementById('fPackageTier').value.trim() || null,
    hours_booked: document.getElementById('fHoursBooked').value ? Number(document.getElementById('fHoursBooked').value) : null,
    quoted_price: document.getElementById('fQuotedPrice').value ? Number(document.getElementById('fQuotedPrice').value) : null,
    confirmed_price: document.getElementById('fConfirmedPrice').value ? Number(document.getElementById('fConfirmedPrice').value) : null,
    deposit_paid: document.getElementById('fDepositPaid').checked,
    balance_paid: document.getElementById('fBalancePaid').checked,
    contract_url: document.getElementById('fContractUrl').value.trim() || null,
    quote_pdf_url: document.getElementById('fQuotePdfUrl').value.trim() || null,
    pm_id: document.getElementById('fPmId').value || null,
  };

  const { valid, errors } = validateProjectForm(fields);
  if (!valid) {
    document.getElementById('fClientNameError').textContent = errors.client_name || '';
    return;
  }

  const editId = document.getElementById('fId').value;
  let projectId = editId;
  let error;
  if (editId) {
    ({ error } = await supabase.from('projects').update(fields).eq('id', editId));
  } else {
    const insertResult = await supabase.from('projects').insert(fields).select().single();
    error = insertResult.error;
    projectId = insertResult.data?.id;
  }

  if (error) {
    showErrorToast('Could not save project — please try again.');
    return;
  }

  const assignError = await saveEditorAssignments(projectId);
  if (assignError) {
    showErrorToast('Project saved, but editor assignment could not be updated — please try again.');
  }

  // If the detail panel is open for the project we just edited, refresh its
  // in-memory snapshot too — otherwise re-opening Edit from the still-open
  // panel (without closing/reopening it) would show stale pre-edit values,
  // even though the save itself succeeded.
  if (editId && currentDetailProject && currentDetailProject.id === editId) {
    currentDetailProject = { ...currentDetailProject, ...fields };
    document.getElementById('detailClientName').textContent = currentDetailProject.client_name;
  }

  closeProjectModal();
  // Don't rely solely on the realtime redraw — if realtime is ever silently
  // down (this exact failure mode happened once before the publication was
  // fixed), a user clicking Save should still see the project appear.
  // refreshProjects() (not just re-rendering) since the underlying data
  // changed and whichever view is active needs the new snapshot.
  await refreshProjects();
}
```

- [ ] **Step 5: Run the full unit suite to confirm no regression**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add board/project-modal.js board/index.html board/board.css
git commit -m "feat(board): add PM/Editor assignment picker to the project modal"
```

---

### Task 5: Login-Time Deactivation Check

**Files:**
- Modify: `board/login.js`

**Interfaces:**
- Consumes: `profiles.active` from Task 1.
- Produces: nothing consumed by later tasks — this is a leaf UX improvement. The real security boundary is Task 1's RLS gating, which already blocks a deactivated user regardless of whether this check runs.

- [ ] **Step 1: Add the active check to `board/login.js`**

Replace the full contents of `board/login.js`:

```javascript
import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) window.location.href = 'index.html';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const email = document.getElementById('lEmail').value.trim();
    const password = document.getElementById('lPassword').value;

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = 'Incorrect email or password.';
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('active')
      .eq('id', signInData.user.id)
      .single();

    // A failed profile fetch here doesn't block login -- this check is a UX
    // nicety on top of the real boundary (current_profile_role() returning
    // null for a deactivated user), which already blocks every RLS-gated
    // read/write regardless of whether this check ever runs.
    if (!profileError && profile && profile.active === false) {
      await supabase.auth.signOut();
      errorEl.textContent = 'Your access has been revoked. Contact the studio owner.';
      return;
    }

    window.location.href = 'index.html';
  });
});
```

- [ ] **Step 2: Run the full unit suite to confirm no regression**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add board/login.js
git commit -m "feat(board): block login for deactivated staff with a clear message"
```

---

### Task 6: Full Manual Verification Pass

**Files:** none (verification only — use the `run` skill for the browser-driving parts of this task).

**Interfaces:**
- Consumes: everything from Tasks 1-5.

- [ ] **Step 1: Start the local server stack**

```bash
printf 'SUPABASE_URL=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\n' \
  "$(grep SUPABASE_URL board/.env | cut -d= -f2)" \
  "$(grep SUPABASE_SERVICE_ROLE_KEY board/.env | cut -d= -f2)" > .env
netlify dev --port 8888 &
```

(`netlify dev` serves the static site AND runs `invite-staff.ts` locally — plain `npx serve .` is not enough for this task since it can't run edge functions.)

- [ ] **Step 2: Owner-only visibility**

Using the `run` skill, log in as the seeded Owner account at `http://localhost:8888/board/login.html`. Confirm the "Staff" nav button and "+ Invite Staff" button are both visible. If a non-Owner (PM or Editor) test account exists, log in as that role in a separate session and confirm the Staff nav button is entirely absent.

- [ ] **Step 3: Invite, role change, deactivate, reactivate**

Still as Owner: click "+ Invite Staff", submit a real test email (e.g. one you control) with role Editor. Confirm the modal closes and the new row appears in the Staff table as Active/Editor. Change its role to PM via the dropdown, refresh the page, confirm the change persisted. Click Deactivate, confirm the status badge flips to "Deactivated" and the button now reads "Reactivate". If you have credentials for that test account (via the invite email, if delivery is configured), confirm login is blocked with "Your access has been revoked." Click Reactivate and confirm the badge flips back and (if tested) login works again.

- [ ] **Step 4: Assignment picker**

Open "+ New Project" (or edit an existing test project). Confirm the Project Manager dropdown and Editors multi-select are populated with active staff only — the account deactivated in Step 3, while still deactivated, must NOT appear in either list. Select a PM and one or more editors, save, reopen the same project's Edit modal, and confirm the same PM/editors are still selected.

- [ ] **Step 5: Clean up test data**

Delete the test staff account created in Step 3 using the service-role client (matching the cleanup pattern in `board/test/helpers.js`'s `deleteTestProfile`) — either via a one-off script or the Supabase dashboard. Delete any test project created in Step 4 if it isn't otherwise needed.

- [ ] **Step 6: Stop the local server and run the full suite one more time**

```bash
kill %1
rm -f .env
npm run test:unit
```

Expected: PASS, full suite green.

- [ ] **Step 7: Commit anything left uncommitted**

If Step 1-6 required no code changes (expected — this task is verification only), there is nothing to commit. If any issue surfaced a real bug, fix it, re-run the relevant task's tests, and commit the fix with a message describing what Step caught it.
