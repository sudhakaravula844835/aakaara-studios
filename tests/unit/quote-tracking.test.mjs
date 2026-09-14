import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteProjectPayload, trackQuote, hasQuoteChangedSinceLastSend } from '../../admin/quote-tracking.js';
const state={clientName:' Client ',clientEmail:'client@example.com',eventType:'Wedding',location:'New York',days:[{date:'2026-12-12',events:[{name:'Ceremony'},{name:'Reception'}]}]};
test('maps the quoted amount and all event dates without inventing a confirmed price',()=>{
 const p=quoteProjectPayload(state,{total:4500,totalHours:8});
 assert.equal(p.client_name,'Client');assert.equal(p.quoted_price,4500);assert.equal(p.events.length,2);assert.equal(p.events[1].event_date,'2026-12-12');assert.equal(p.confirmed_price,undefined);
});
test('rejects nonfinite or negative prices',()=>{for(const total of [NaN,Infinity,-1])assert.throws(()=>quoteProjectPayload(state,{total}));});
test('requires a Board session before writing',async()=>{await assert.rejects(trackQuote({auth:{getSession:async()=>({data:{session:null}})}},'id',state,{total:2}),/Sign in/);});
test('passes the same stable ID on retries and surfaces failed saves',async()=>{
 const calls=[];const client={auth:{getSession:async()=>({data:{session:{}}})},rpc:async(name,args)=>{calls.push(args);return {data:'project-id'};}};
 assert.equal(await trackQuote(client,'same-id',state,{total:2}),'project-id');await trackQuote(client,'same-id',state,{total:2});assert.equal(calls[0].p_quote_id,calls[1].p_quote_id);
 client.rpc=async()=>({error:{message:'offline'}});await assert.rejects(trackQuote(client,'same-id',state,{total:2}),/Could not save/);
});
test('does not flag a new quote as changed, so a first send keeps its ID',()=>{
 assert.equal(hasQuoteChangedSinceLastSend(null,state,{total:2}),false);
 assert.equal(hasQuoteChangedSinceLastSend(undefined,state,{total:2}),false);
});
test('does not flag an identical retry as changed',()=>{
 const snapshot=JSON.stringify(quoteProjectPayload(state,{total:4500,totalHours:8}));
 assert.equal(hasQuoteChangedSinceLastSend(snapshot,state,{total:4500,totalHours:8}),false);
});
test('flags a different client typed into the still-open form as changed, so it gets a fresh ID',()=>{
 const snapshot=JSON.stringify(quoteProjectPayload(state,{total:4500,totalHours:8}));
 const otherClient={...state,clientName:'Someone Else'};
 assert.equal(hasQuoteChangedSinceLastSend(snapshot,otherClient,{total:4500,totalHours:8}),true);
 assert.equal(hasQuoteChangedSinceLastSend(snapshot,state,{total:5000,totalHours:8}),true);
});
