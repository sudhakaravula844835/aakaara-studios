const {chromium}=require('playwright');const {readFileSync}=require('node:fs');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();
for(const role of ['editor','owner']){
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(role=>window.reviewRole=role,role);
 const mock=readFileSync('tests/fixtures/film-review-mock.js','utf8').replace('export const supabase={rpc:reviewRpc};',`const project={id:'project',client_name:'Sample Couple',stage:'video_editing',video_editing_substatus:'in_progress',sub_events:[]};
 export const supabase={rpc:reviewRpc,auth:{getSession:async()=>({data:{session:{user:{id:'user'}}}}),getUser:async()=>({data:{user:{id:'user'}}})},from:(table)=>{const q={select:()=>q,eq:()=>q,order:()=>q,single:async()=>({data:table==='profiles'?{id:'user',full_name:'Sample staff',role:window.reviewRole,active:true}:project}),then:(resolve)=>resolve({data:['projects','editor_project_view'].includes(table)?[project]:[]})};return q;},channel:()=>{const c={on:()=>c,subscribe:()=>c};return c;}};`);
 await page.route('**/board/supabase-client.js',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await page.goto('http://127.0.0.1:8766/board/'+(role==='editor'?'editor.html':'index.html'));
 await page.getByText('Sample Couple',{exact:true}).first().click();await page.locator('#staffFilmReview .review-card').first().waitFor();
 assert.equal(await page.locator('#staffFilmReview .review-prepare').count(),1);
 assert.equal(await page.getByRole('button',{name:'Share with client',exact:true}).count(),role==='owner'?1:0);
 if(role==='editor')assert.equal(await page.getByRole('button',{name:'Post internal note'}).count(),1);
 assert.deepEqual(errors,[]);console.log('PASS '+role+' actual project detail mounts review module');await page.close();
}await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
