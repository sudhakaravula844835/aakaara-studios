const {test,expect}=require('@playwright/test');
const stub=`
window.quoteCalls=[];
export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'test'}}}})},rpc:async(name,args)=>{window.quoteCalls.push(args);return window.failQuote?{error:{message:'offline'}}:{data:'project-id'};}};
`;
test('send tracks once per click, retains ID on retry, and reports failed saves',async({page})=>{
 await page.route('https://**',r=>r.abort());
 await page.route('**/board/supabase-client.js',r=>r.fulfill({contentType:'text/javascript',body:stub}));
 await page.addInitScript(()=>{window.open=()=>null;});
 await page.goto('/admin/quote-generator.html');
 await page.locator('#clientName').fill('Tracking QA');
 await page.locator('#clientEmail').fill('qa@example.com');
 await page.locator('#eventType').selectOption('Wedding');
 await page.locator('#previewBtn').click();
 await page.locator('#confirmSendBtn').click();
 await expect(page.locator('#quoteTrackingStatus')).toContainText('Saved to Board');
 const first=await page.evaluate(()=>window.quoteCalls[0]);
 expect(first.p_quote.client_name).toBe('Tracking QA');
 await page.evaluate(()=>window.failQuote=true);
 await page.locator('#confirmSendBtn').click();
 await expect(page.locator('#quoteTrackingStatus')).toContainText('Could not save');
 expect(await page.evaluate(()=>window.quoteCalls[1].p_quote_id)).toBe(first.p_quote_id);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('aakaaraQuoteDraft:v2')).quoteTrackingId)).toBe(first.p_quote_id);
 await page.evaluate(()=>window.failQuote=false);
 await page.locator('#confirmSendBtn').click();
 await expect(page.locator('#quoteTrackingStatus')).toContainText('Saved to Board');
});
test('editing the still-open form for a new client after a successful send gets its own Board record',async({page})=>{
 await page.route('https://**',r=>r.abort());
 await page.route('**/board/supabase-client.js',r=>r.fulfill({contentType:'text/javascript',body:stub}));
 await page.addInitScript(()=>{window.open=()=>null;});
 await page.goto('/admin/quote-generator.html');
 await page.locator('#clientName').fill('Client A');
 await page.locator('#clientEmail').fill('a@example.com');
 await page.locator('#eventType').selectOption('Wedding');
 await page.locator('#previewBtn').click();
 await page.locator('#confirmSendBtn').click();
 await expect(page.locator('#quoteTrackingStatus')).toContainText('Saved to Board');
 const first=await page.evaluate(()=>window.quoteCalls[0]);
 // Without touching Reset/New Quote, close the preview and start quoting
 // someone else in the same still-open form.
 await page.locator('#closePreviewBtn').click();
 await page.locator('#clientName').fill('Client B');
 await page.locator('#clientEmail').fill('b@example.com');
 await page.locator('#previewBtn').click();
 await page.locator('#confirmSendBtn').click();
 await expect(page.locator('#quoteTrackingStatus')).toContainText('Saved to Board');
 expect(await page.evaluate(()=>window.quoteCalls.length)).toBe(2);
 const second=await page.evaluate(()=>window.quoteCalls[1]);
 expect(second.p_quote.client_name).toBe('Client B');
 expect(second.p_quote_id).not.toBe(first.p_quote_id);
});
for(const width of [390,1440])test(`dashboard quote confirmation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('https://**',r=>r.abort());
 await page.route('**/board/supabase-client.js',r=>r.fulfill({contentType:'text/javascript',body:`
 const project={id:'p1',source_quote_id:'q1',client_name:'Quote Client',stage:'quote_sent',quoted_price:4500,confirmed_price:null,sub_events:[]};
 window.updates=[];
 export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},channel:()=>({on(){return this},subscribe(){return this}}),from(table){let updated=false;let single=false;const q={select(){return q},eq(){return q},in(){return q},order(){return q},single(){single=true;return q},update(fields){window.updates.push(fields);Object.assign(project,fields);updated=true;return q},then(resolve){return Promise.resolve({data:table==='profiles'?(single?{role:'owner',active:true,full_name:'QA'}:[]):table==='projects'?[project]:[],error:null}).then(resolve)}};return q}};
 `}));
 await page.goto('/board/index.html');
 await expect(page.locator('.dash-card')).toContainText('Quote sent');
 await page.evaluate(async()=>{const {openProjectModal}=await import('/board/project-modal.js');await openProjectModal({id:'p1',source_quote_id:'q1',client_name:'Quote Client',stage:'quote_sent',quoted_price:4500,confirmed_price:null,sub_events:[]});});
 await expect(page.locator('#fQuotedPrice')).toHaveAttribute('readonly','');
 await page.locator('#fProjectStage').selectOption('booked');
 await page.locator('#projectForm').evaluate(f=>f.requestSubmit());
 await expect(page.locator('#toastContainer')).toContainText('Enter the agreed price');
 expect(await page.evaluate(()=>window.updates.length)).toBe(0);
 await page.locator('#fConfirmedPrice').fill('4200');
 await page.locator('#projectForm').evaluate(f=>f.requestSubmit());
 await expect.poll(()=>page.evaluate(()=>window.updates.length)).toBeGreaterThan(0);
 const update=await page.evaluate(()=>window.updates[0]);expect(update.stage).toBe('booked');expect(update.confirmed_price).toBe(4200);expect(update.quoted_price).toBeUndefined();
 await page.screenshot({path:`/tmp/quote-tracking-${width}.png`});
});
