// Demo/test data only. This module never connects to Supabase.
const initial = {items:[
{id:'draft-2',kind:'film',version:2,title:'Wedding film · revised opening',video_url:'https://example.com/draft-2',body:'The opening is tighter, with more family moments. Ready for studio review.',author_label:'Sample Editor',created_at:'2026-09-15T16:00:00Z',published_at:null},
{id:'draft-1',kind:'film',version:1,title:'Wedding film',video_url:'https://example.com/draft-1',body:'Here is your first cut. We would love your thoughts on the music and pacing.',author_label:'Sample Editor',created_at:'2026-09-14T16:00:00Z',published_at:'2026-09-14T17:00:00Z'}
],feedback:[{id:'feedback-1',item_id:'draft-1',action:'changes_requested',at_seconds:134,body:'Please include a longer shot of our parents here.',created_at:'2026-09-14T18:00:00Z'}]};
let state=initial;
if(window.reviewPersist){try{state=JSON.parse(localStorage.getItem('aakaara-film-review-demo'))||initial;}catch{}}
window.reviewCalls=[];
export async function reviewRpc(name,args){
 if(window.reviewPersist){try{state=JSON.parse(localStorage.getItem('aakaara-film-review-demo'))||initial;}catch{}}
 window.reviewCalls.push({name,args});
 if(window.reviewFailNext){window.reviewFailNext=false;return {error:{message:'Connection interrupted. Please try again.'}};}
 const role=window.reviewRole||'client';
 if(name==='get_film_review')return {data:{can_publish:role==='owner',items:state.items.filter(i=>role!=='client'||(i.kind==='film'&&i.published_at)),feedback:state.feedback}};
 if(name==='prepare_film_review'&&!state.items.some(i=>i.id===args.p_id))state.items.unshift({id:args.p_id,kind:args.p_kind,title:args.p_title,video_url:args.p_url,body:args.p_body,version:args.p_kind==='film'?Math.max(0,...state.items.map(i=>i.version||0))+1:null,author_label:'Sample Editor',created_at:new Date().toISOString(),published_at:null});
 if(name==='publish_film_review'){if(role!=='owner')return {error:{message:'Only owner or PM may share.'}};state.items.find(i=>i.id===args.p_item_id).published_at=new Date().toISOString();}
 if(name==='discard_film_review')state.items=state.items.filter(i=>i.id!==args.p_item_id);
 if(name==='respond_film_review'&&!state.feedback.some(f=>f.id===args.p_id))state.feedback.push({id:args.p_id,item_id:args.p_item_id,action:args.p_action,at_seconds:args.p_seconds,body:args.p_body,created_at:new Date().toISOString()});
 if(window.reviewPersist)localStorage.setItem('aakaara-film-review-demo',JSON.stringify(state));
 return {data:null,error:null};
}
export const supabase={rpc:reviewRpc};
