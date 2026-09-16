// Isolated PostgreSQL permission regression: no Supabase credentials or live writes.
const {PGlite}=require(process.env.PGLITE_MODULE||'/tmp/aakaara-review-db/node_modules/@electric-sql/pglite');
const fs=require('node:fs');const assert=require('node:assert/strict');const {randomUUID:uuid}=require('node:crypto');
(async()=>{const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;`);
for(const f of ['20260727061021_schema.sql','20260727061442_rls_owner_pm.sql','20260727061945_editor_access.sql','20260727062631_client_rpc.sql','20260729012603_staff_deactivation.sql','20260729193248_editor_deactivation_null_safe_role_checks.sql'])await db.exec(fs.readFileSync('board/supabase/migrations/'+f,'utf8'));
await db.exec('grant select on all tables in schema public to authenticated;');
const migration=fs.readFileSync('board/supabase/migrations/20260916120000_editor_view_security_invoker.sql','utf8');await db.exec(migration);await db.exec(migration);
const editor=uuid(),otherEditor=uuid(),owner=uuid(),p1=uuid(),p2=uuid();
for(const[id,role]of [[editor,'editor'],[otherEditor,'editor'],[owner,'owner']]){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into profiles(id,role,full_name,email) values($1,$2,$2,$3)',[id,role,id+'@example.com']);}
await db.query("insert into projects(id,client_name,confirmed_price) values($1,'Assigned',5000),($2,'Unassigned',6000)",[p1,p2]);await db.query('insert into project_editors(project_id,editor_id) values($1,$2),($3,$4)',[p1,editor,p2,otherEditor]);await db.query("insert into sub_events(project_id,name) values($1,'Wedding'),($2,'Other wedding')",[p1,p2]);
async function as(user,fn){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec(user?'set role authenticated':'set role anon');try{return await fn();}finally{await db.exec('reset role');}}
const rows=await as(editor,()=>db.query('select * from public.editor_project_view'));
assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].id,p1);assert.equal(Object.keys(rows.rows[0]).length,13);
for(const key of ['confirmed_price','quoted_price','deposit_paid','balance_paid','client_access_token'])assert(!Object.hasOwn(rows.rows[0],key));
await assert.rejects(as(editor,()=>db.query('select confirmed_price from public.editor_project_view')),/does not exist/);
assert.equal((await as(editor,()=>db.query('select * from public.projects'))).rows.length,0);
const nested=await as(editor,()=>db.query('select e.id,s.name from public.editor_project_view e cross join lateral public.sub_events(e) s'));
assert.equal(nested.rows.length,1);assert.equal(nested.rows[0].name,'Wedding');
// Crafted composite values cannot bypass sub-event RLS.
assert.equal((await as(editor,()=>db.query("select * from public.sub_events(jsonb_populate_record(null::public.editor_project_view,jsonb_build_object('id',$1::uuid)))",[p2]))).rows.length,0);
assert.equal((await as(editor,()=>db.query('select * from public.editor_project_view where id=$1',[p2]))).rows.length,0);
await assert.rejects(as(null,()=>db.query('select * from public.editor_project_view')),/permission denied/);
await assert.rejects(as(null,()=>db.query('select * from editor_private.assigned_editor_projects()')),/permission denied/);
await db.query('update profiles set active=false where id=$1',[editor]);assert.equal((await as(editor,()=>db.query('select * from public.editor_project_view'))).rows.length,0);
assert.equal((await as(owner,()=>db.query('select * from public.editor_project_view'))).rows.length,0);
assert.equal((await as(owner,()=>db.query('select confirmed_price from projects'))).rows.length,2);
const options=(await db.query("select reloptions from pg_class where oid='public.editor_project_view'::regclass")).rows[0].reloptions;assert(options.includes('security_invoker=true'));
assert.equal((await db.query("select proconfig from pg_proc where oid='editor_private.assigned_editor_projects()'::regprocedure")).rows[0].proconfig[0],'search_path=""');
console.log('PASS: invoker view; 13 safe columns; assigned-project access; financial/token exclusion; direct projects blocked; sub-event embedding and forged-ID RLS; anon denial; inactive editor denial; owner finances unchanged; idempotent migration.');await db.close();})().catch(e=>{console.error(e);process.exit(1)});
