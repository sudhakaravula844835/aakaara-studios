import { supabase } from './supabase-client.js';

export function parseReviewTimestamp(value) {
  if (!value.trim()) return null;
  if (!/^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(value.trim())) throw new Error('Use mm:ss or hh:mm:ss for the timestamp.');
  const seconds = value.trim().split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
  if (seconds > 86400) throw new Error('The timestamp must be within 24 hours.');
  return seconds;
}
const sessions = new WeakMap();
const labels = { comment: 'Feedback', changes_requested: 'Changes requested', approved: 'Draft approved' };
const el = (tag, className, text) => {
  const node = document.createElement(tag); if (className) node.className = className;
  if (text != null) node.textContent = text; return node;
};
const button = (text, handler) => { const node = el('button', 'review-button', text); node.type = 'button'; node.onclick = handler; return node; };
const dateText = value => new Date(value).toLocaleString(undefined, {dateStyle:'medium',timeStyle:'short'});

export function mountFilmReview(root, { projectId = null, token = null, staff = false, onChange = () => {} } = {}) {
  if (!root) return;
  const session = {}; sessions.set(root, session);
  const draft = {kind:'film',title:'',url:'',body:'',id:null};
  const responses = new Map();
  let data = null;
  let busy = false;
  let loadSequence = 0;
  const current = () => sessions.get(root) === session;
  const status = el('p', 'review-status'); status.setAttribute('role','status');
  const content = el('div', 'review-content');
  root.replaceChildren(el('h2', 'detail-section-title', staff ? 'Drafts & client review' : 'Your film, in the making'), status, content);
  root.classList.add('film-review');
  async function rpc(name,args) {
    try { const result = await supabase.rpc(name,args); if(result.error) throw result.error; return result.data; }
    catch(error) { throw new Error(error.message || 'Connection interrupted. Please try again.'); }
  }
  async function load() {
    const request = ++loadSequence;
    status.textContent = 'Loading film review…';
    try {
      const next = await rpc('get_film_review',{p_project_id:projectId,p_token:token});
      if (!current() || request !== loadSequence) return;
      data = next; status.textContent = ''; render();
    } catch(error) { if(current() && request === loadSequence) { status.textContent = 'Film review could not load. Your work is still here.'; if(!data) content.replaceChildren(button('Try again',load)); } }
  }
  async function mutate(name,args,success) {
    if(busy) return; busy=true;
    root.querySelectorAll('button').forEach(node=>node.disabled=true);
    status.textContent='Saving…';
    try {
      await rpc(name,args);
      if(!current()) return;
      success?.(); await load(); onChange();
    } catch(error) { if(current()) status.textContent = error.message; }
    finally { busy=false; if(current())root.querySelectorAll('button').forEach(node=>node.disabled=false); }
  }
  function field(form,labelText,tag,value,onInput,type='text') {
    const label=el('label','review-field',labelText); const input=el(tag,'form-input'); input.setAttribute('aria-label',labelText);
    if(tag==='input') input.type=type; input.value=value;
    if(tag==='textarea') { input.rows=3; input.maxLength=10000; }
    input.oninput=()=>onInput(input.value); label.append(input); form.append(label); return input;
  }
  function render() {
    content.replaceChildren();
    content.append(el('p','review-help',staff ? 'Prepare a draft or client message here. Only an owner or PM can share it with the client.' : 'Watch the latest draft, then share your thoughts. Earlier versions and feedback stay below.'),button('Refresh review',()=>{load();onChange();}));
    const films=data.items.filter(item=>item.kind==='film');
    const latestPublished=Math.max(0,...films.filter(item=>item.published_at).map(item=>item.version));
    if(!data.items.length)content.append(el('p','review-help',staff?'No drafts prepared yet.':'Your first film draft will appear here when the studio shares it.'));
    data.items.forEach(item=>{
      const card=el('details','review-card');
      card.open = item.kind==='film' && item.version===Math.max(0,...films.map(f=>f.version));
      if(item.kind==='message')card.open=true;
      const summary=el('summary','review-card-heading',`${item.kind==='film'?'Draft '+item.version:'Client message'} · ${item.title}`);card.append(summary);
      const body=el('div','review-card-body');card.append(body);
      body.append(el('p','review-badge',item.published_at?'Shared with client · '+dateText(item.published_at):'Private · Awaiting owner / PM review'));
      body.append(el('p','review-help',`Prepared by ${item.author_label}`));
      if(item.body)body.append(el('p','review-note',item.body));
      if(item.video_url && /^https:\/\//i.test(item.video_url)) {
        const link=el('a','review-button','Watch draft '+item.version+' ↗');link.href=item.video_url;link.target='_blank';link.rel='noopener noreferrer';body.append(link);
        if(/\.(mp4|webm)(?:\?|$)/i.test(item.video_url)) {
          const video=el('video','review-video');video.controls=true;video.preload='none';video.src=item.video_url;video.setAttribute('aria-label',`Draft ${item.version}: ${item.title}`);body.append(video);
        }
      }
      if(staff && !item.published_at) {
        const actions=el('div','review-actions');
        if(data.can_publish)actions.append(button('Share with client',()=>{
          if(window.confirm(`Share ${item.kind==='film'?'Draft '+item.version:'this message'} with the client?`))mutate('publish_film_review',{p_item_id:item.id});
        }));
        actions.append(button('Discard unpublished draft',()=>{
          if(window.confirm('Discard this unpublished draft?'))mutate('discard_film_review',{p_item_id:item.id});
        }));body.append(actions);
      }
      const feedback=data.feedback.filter(entry=>entry.item_id===item.id);
      const decision=[...feedback].reverse().find(entry=>entry.action!=='comment');
      if(decision)body.append(el('p','review-badge',labels[decision.action]+' · Draft '+item.version));
      feedback.forEach(entry=>{
        const note=el('div','review-feedback');
        const time=entry.at_seconds == null?'':` · ${Math.floor(entry.at_seconds/60)}:${String(entry.at_seconds%60).padStart(2,'0')}`;
        note.append(el('strong','',labels[entry.action]+time),el('p','review-note',entry.body),el('time','review-help',dateText(entry.created_at)));body.append(note);
      });
      if(!staff && item.kind==='film' && item.published_at) {
        if(item.version!==latestPublished)body.append(el('p','review-help','Earlier version · Approve or request changes on the latest draft.'));
        const saved=responses.get(item.id)||{body:'',timestamp:'',action:'comment',id:null};responses.set(item.id,saved);
        const form=el('form','review-form');
        field(form,'Feedback for this draft','textarea',saved.body,value=>saved.body=value);
        field(form,'Timestamp (optional, mm:ss)','input',saved.timestamp,value=>saved.timestamp=value);
        const action=field(form,'Response','select','',value=>saved.action=value);
        Object.entries(labels).forEach(([key,label])=>{if(key==='comment'||item.version===latestPublished){const option=el('option','',label);option.value=key;action.append(option);}});action.value=saved.action;
        const submit=button('Send response');submit.type='submit';form.append(submit);
        form.onsubmit=event=>{
          event.preventDefault();
          try {
            const seconds=parseReviewTimestamp(saved.timestamp);
            if(saved.action!=='approved'&&!saved.body.trim())throw new Error('Please add your feedback before sending.');
            if(saved.action==='approved'&&!window.confirm(`Approve Draft ${item.version}? This approves this version, not final project delivery.`))return;
            saved.id ||= crypto.randomUUID();
            mutate('respond_film_review',{p_token:token,p_item_id:item.id,p_id:saved.id,p_action:saved.action,p_seconds:seconds,p_body:saved.body.trim()},()=>responses.delete(item.id));
          }catch(error){status.textContent=error.message;}
        };body.append(form);
      }
      content.append(card);
    });
    if(staff) {
      const form=el('form','review-form review-prepare');form.append(el('h3','','Prepare something to share'));
      const kind=field(form,'Type','select','',value=>{draft.kind=value;render();});
      for(const [value,text]of [['film','Film draft'],['message','Message to client']]){const option=el('option','',text);option.value=value;kind.append(option);}kind.value=draft.kind;
      const title=field(form,'Title','input',draft.title,value=>draft.title=value);title.required=true;title.maxLength=200;
      if(draft.kind==='film'){const url=field(form,'Video or review link (HTTPS)','input',draft.url,value=>draft.url=value,'url');url.required=true;url.pattern='https://.*';}
      const note=field(form,draft.kind==='film'?'Note for the client (optional)':'Message to client','textarea',draft.body,value=>draft.body=value);note.required=draft.kind==='message';
      form.append(el('p','review-help','Saving prepares this for review. It does not send or share anything with the client.'));
      const submit=button('Save for owner / PM review');submit.type='submit';form.append(submit);
      form.onsubmit=event=>{event.preventDefault();draft.id ||= crypto.randomUUID();mutate('prepare_film_review',{p_project_id:projectId,p_id:draft.id,p_kind:draft.kind,p_title:draft.title.trim(),p_url:draft.url.trim()||null,p_body:draft.body.trim()},()=>Object.assign(draft,{title:'',url:'',body:'',id:null}));};
      content.append(form);
    }
  }
  load();
}
