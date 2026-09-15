// Isolated PostgreSQL (PGlite). No network or Supabase credentials are used.
// PGLITE_MODULE may point to a temporary installation of @electric-sql/pglite.
const { PGlite } = require(process.env.PGLITE_MODULE || '/tmp/aakaara-review-db/node_modules/@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const { randomUUID: uuid } = require('node:crypto');
const assert = require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
 for(const file of ['20260727061021_schema.sql','20260727061442_rls_owner_pm.sql','20260727061945_editor_access.sql','20260727062631_client_rpc.sql','20260729012603_staff_deactivation.sql','20260729193248_editor_deactivation_null_safe_role_checks.sql'])await db.exec(readFileSync('board/supabase/migrations/'+file,'utf8'));
 await db.exec('alter table comments add column internal boolean not null default false; alter table projects add column expected_delivery_date date, add column contract_uploaded_at timestamptz, add column quote_uploaded_at timestamptz;');
 for(const file of ['20260915120000_client_portal_selections.sql','20260915140000_film_review.sql'])await db.exec(readFileSync('board/supabase/migrations/'+file,'utf8'));
 const owner=uuid(),editor=uuid(),outsider=uuid(),project=uuid(),other=uuid(),token=uuid(),otherToken=uuid();
 for(const [id,role]of [[owner,'owner'],[editor,'editor'],[outsider,'editor']]){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into profiles(id,role,full_name,email) values($1,$2,$2,$3)',[id,role,role+'@example.com']);}
 await db.query('insert into projects(id,client_name,client_access_token) values($1,$2,$3),($4,$5,$6)',[project,'Sample project',token,other,'Other project',otherToken]);
 await db.query('insert into project_editors(project_id,editor_id) values($1,$2)',[project,editor]);
 async function as(user,fn){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec(user?'set role authenticated':'set role anon');try{return await fn();}finally{await db.exec('reset role');}}
 const rpc=(name,args)=>db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args).then(r=>r.rows[0].result);
 const draft=uuid();
 await assert.rejects(as(outsider,()=>rpc('prepare_film_review',[project,uuid(),'film','Draft','https://example.com/draft',''])),/not assigned/);
 await as(editor,()=>rpc('prepare_film_review',[project,draft,'film','Wedding film','https://example.com/draft','Please review the pacing.']));
 await as(editor,()=>rpc('prepare_film_review',[project,draft,'film','Wedding film','https://example.com/draft','Please review the pacing.']));
 assert.equal((await db.query('select count(*)::int n from film_review_items')).rows[0].n,1);
 assert.equal((await as(null,()=>rpc('get_film_review',[null,token]))).items.length,0);
 await assert.rejects(as(null,()=>db.query('select * from film_review_items')),/permission denied/);
 await assert.rejects(as(editor,()=>rpc('publish_film_review',[draft])),/only owner or PM/);
 await db.query('update profiles set active=false where id=$1',[editor]);
 await assert.rejects(as(editor,()=>rpc('get_film_review',[project,null])),/not an editor/);
 await db.query('update profiles set active=true where id=$1',[editor]);
 await as(owner,()=>rpc('publish_film_review',[draft]));
 assert.equal((await as(null,()=>rpc('get_film_review',[null,token]))).items.length,1);
 assert.equal((await db.query('select video_editing_substatus from projects where id=$1',[project])).rows[0].video_editing_substatus,'client_review');
 const feedback=uuid();
 await assert.rejects(as(null,()=>rpc('respond_film_review',[otherToken,draft,uuid(),'comment',134,'Wrong client'])),/shared draft not found/);
 await as(null,()=>rpc('respond_film_review',[token,draft,feedback,'changes_requested',134,'Please replace this shot.']));
 await as(null,()=>rpc('respond_film_review',[token,draft,feedback,'changes_requested',134,'Please replace this shot.']));
 assert.equal((await db.query('select count(*)::int n from film_review_feedback')).rows[0].n,1);
 assert.equal((await db.query('select video_editing_substatus from projects where id=$1',[project])).rows[0].video_editing_substatus,'revisions');
 const draft2=uuid();await as(editor,()=>rpc('prepare_film_review',[project,draft2,'film','Wedding film revision','https://example.com/draft2','Updated.']));await as(owner,()=>rpc('publish_film_review',[draft2]));
 await assert.rejects(as(null,()=>rpc('respond_film_review',[token,draft,uuid(),'approved',null,''])),/latest draft/);
 await as(null,()=>rpc('respond_film_review',[token,draft2,uuid(),'approved',null,'Looks great.']));
 assert.equal((await db.query('select stage from projects where id=$1',[project])).rows[0].stage,'video_editing');
 await assert.rejects(as(owner,()=>rpc('discard_film_review',[draft])),/history cannot/);
 const message=uuid();await as(editor,()=>rpc('prepare_film_review',[project,message,'message','An update',null,'We adjusted the opening scene.']));
 assert.equal((await db.query('select count(*)::int n from comments where internal=false')).rows[0].n,0);
 await as(editor,()=>rpc('post_comment',[project,'Team-only note']));
 assert.equal((await db.query('select internal from comments')).rows[0].internal,true);
 await as(owner,()=>rpc('publish_film_review',[message]));await as(owner,()=>rpc('publish_film_review',[message]));
 assert.equal((await db.query('select count(*)::int n from comments where internal=false')).rows[0].n,1);
 const clientData=await as(null,()=>rpc('get_project_by_token',[token]));assert.equal(clientData.comments.length,1);
 assert.equal((await as(null,()=>rpc('get_film_review',[null,token]))).items.length,2);
 await db.query('update projects set token_revoked=true where id=$1',[project]);await assert.rejects(as(null,()=>rpc('get_film_review',[null,token])),/invalid or revoked/);await db.query('update projects set token_revoked=false where id=$1',[project]);
 // Also verify the previously prepared atomic selection migration.
 const event=uuid();await db.query('insert into sub_events(id,project_id,name) values($1,$2,$3)',[event,project,'Wedding']);
 await as(null,()=>rpc('save_client_photo_selection',[token,event,['001','001','002']]));
 assert.equal((await db.query('select photo_selected_count from sub_events where id=$1',[event])).rows[0].photo_selected_count,2);
 await db.exec("create function reject_test_comment() returns trigger language plpgsql as $$ begin raise exception 'simulated comment failure'; end $$; create trigger fail_comment before insert on comments for each row execute function reject_test_comment();");
 await assert.rejects(as(null,()=>rpc('save_client_photo_selection',[token,event,['003']])),/simulated comment failure/);
 assert.equal((await db.query('select photo_selected_count from sub_events where id=$1',[event])).rows[0].photo_selected_count,2);
 await db.exec('drop trigger fail_comment on comments');
 const song=uuid();await as(null,()=>rpc('save_client_song',[token,song,null,'Our song',null]));await as(null,()=>rpc('save_client_song',[token,song,null,'Our song',null]));assert.equal((await db.query('select count(*)::int n from songs')).rows[0].n,1);
 console.log('PASS: both migrations executed in isolated PostgreSQL; assignment/deactivation, private drafts, direct table denial, owner publishing, token isolation/revocation, version history, approvals/revisions, idempotent retries, internal notes, atomic photo rollback, song retry.');
 await db.close();
})().catch(error=>{console.error(error);process.exit(1);});
