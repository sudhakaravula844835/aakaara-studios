const { PGlite } = require(process.env.PGLITE_MODULE || '/tmp/aakaara-review-db/node_modules/@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  await db.exec(`create table projects(stage text constraint projects_stage_check check(stage in ('quote_sent','booked')), source_quote_id uuid, confirmed_price numeric, constraint projects_quote_confirmation_price_check check(source_quote_id is null or stage='quote_sent' or confirmed_price is not null));
  insert into projects values('quote_sent','11111111-1111-1111-1111-111111111111',null);`);
  const sql = fs.readFileSync('board/supabase/migrations/20260918120000_declined_quotes.sql','utf8');
  await db.exec(sql);
  await db.exec(sql);
  await db.exec("update projects set stage='declined'");
  assert.equal((await db.query('select stage from projects')).rows[0].stage, 'declined');
  await assert.rejects(db.exec("update projects set stage='booked'"), /projects_quote_confirmation_price_check/);
  await db.exec("update projects set stage='quote_sent'");
  await db.exec("update projects set stage='booked',confirmed_price=2500");
  await assert.rejects(db.exec("update projects set stage='unknown'"), /projects_stage_check/);
  await db.close();
  console.log('PASS: decline with no agreed price, reopen, confirmation guard, valid confirmation, unknown stage rejected, repeat migration.');
})().catch(error=>{console.error(error);process.exit(1)});
