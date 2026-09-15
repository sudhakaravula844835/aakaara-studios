const {chromium}=require('playwright');const {readFileSync}=require('node:fs');const assert=require('node:assert/strict');
const base=process.env.PORTAL_TEST_URL||'http://127.0.0.1:8766';
(async()=>{const browser=await chromium.launch();
for(const width of [375,1440])for(const role of ['editor','owner','client']){
 const page=await browser.newPage({viewport:{width,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/board/supabase-client.js',r=>r.fulfill({contentType:'text/javascript',body:readFileSync('tests/fixtures/film-review-mock.js','utf8')}));
 await page.route('**/board/review-test.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="board.css"></head><body class="client-portal"><main class="client-portal-main"><section id="review"></section></main><script>window.reviewRole='${role}'</script><script type="module">import {mountFilmReview} from './film-review.js';mountFilmReview(document.getElementById('review'),${role==='client'?"{token:'sample'}":"{projectId:'project',staff:true}"});</script></body></html>`}));
 await page.goto(base+'/board/review-test.html');await page.locator('.review-card').first().waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 if(role==='editor'){
   assert.equal(await page.getByRole('button',{name:'Share with client',exact:true}).count(),0);
   await page.getByLabel('Title',{exact:true}).fill('A new cut');await page.getByLabel('Video or review link (HTTPS)').fill('https://example.com/new');await page.getByLabel('Note for the client (optional)').fill('An updated ending.');
   await page.evaluate(()=>window.reviewFailNext=true);await page.getByRole('button',{name:'Save for owner / PM review'}).click();
   assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'A new cut');await page.getByRole('button',{name:'Save for owner / PM review'}).click();
   await page.getByText('Draft 3 · A new cut',{exact:true}).waitFor();
   const calls=await page.evaluate(()=>window.reviewCalls.filter(c=>c.name==='prepare_film_review'));assert.equal(calls[0].args.p_id,calls[1].args.p_id);
   await page.getByLabel('Type',{exact:true}).selectOption('message');await page.getByLabel('Title',{exact:true}).fill('Music update');await page.getByLabel('Message to client',{exact:true}).fill('We adjusted the soundtrack.');await page.getByRole('button',{name:'Save for owner / PM review'}).click();await page.getByText('Client message · Music update',{exact:true}).waitFor();
 }else if(role==='owner'){
   await page.getByRole('button',{name:'Share with client',exact:true}).click();await page.waitForFunction(()=>!document.body.textContent.includes('Awaiting owner / PM review'));
 }else{
   assert.equal(await page.locator('.review-card').count(),1);assert.equal(await page.locator('.review-prepare').count(),0);
   await page.getByLabel('Feedback for this draft').fill('Please hold this shot longer.');await page.getByLabel('Timestamp (optional, mm:ss)').fill('02:14');await page.getByLabel('Response',{exact:true}).selectOption('changes_requested');
   await page.evaluate(()=>window.reviewFailNext=true);await page.getByRole('button',{name:'Send response'}).click();assert.equal(await page.getByLabel('Feedback for this draft').inputValue(),'Please hold this shot longer.');await page.getByRole('button',{name:'Send response'}).click();await page.getByText('Please hold this shot longer.',{exact:true}).waitFor();
   const calls=await page.evaluate(()=>window.reviewCalls.filter(c=>c.name==='respond_film_review'));assert.equal(calls[0].args.p_seconds,134);assert.equal(calls[0].args.p_id,calls[1].args.p_id);
 }
 assert.deepEqual(errors,[]);await page.screenshot({path:`/tmp/film-review-${role}-${width}.png`,fullPage:true});console.log(`PASS ${role} ${width}px: review controls, visibility, interaction and overflow`);await page.close();
}await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
