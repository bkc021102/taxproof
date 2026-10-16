import p from './packet.json';
import {initialState,applyAction,blockers,maskPacket} from './core.mjs';
const packet:any=p;
const dbPromise=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('taxproof-pages-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('state');r.result.createObjectStore('files')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
const read=async(store:string,key:string)=>{const db=await dbPromise;return new Promise<any>((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})};
async function writeState(revision:number,next:any,file?:{key:string,blob:File}){const db=await dbPromise;return new Promise<void>((resolve,reject)=>{const tx=db.transaction(['state','files'],'readwrite'),store=tx.objectStore('state');const r=store.get('workpaper');r.onsuccess=()=>{const old=r.result;if((old?.revision??0)!==revision){tx.abort();return}store.put(next,'workpaper');if(file)tx.objectStore('files').put(file.blob,file.key)};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(Error('Another tab saved changes. Refresh and retry.'));tx.onerror=()=>reject(Error('Browser storage could not save this change.'))})}
const json=(x:any,status=200)=>Response.json(x,{status});
export async function demoFetch(input:RequestInfo|URL,init:RequestInit={}){
 const url=new URL(String(input),window.location.href),headers=new Headers(init.headers),actor=[...packet.firm.staff,...packet.firm.client_users].find((x:any)=>x.id===(headers.get('x-demo-actor')||'st-01'));if(!actor)return json({error:'Unknown demo role'},403);
 try{const s=await read('state','workpaper')||initialState(packet);
 if(init.method==='POST'){
 let a:any,file:any;
 if(init.body instanceof FormData){const form=init.body,f=form.get('file') as File;if(!f||f.size>10*1024*1024)return json({error:'Choose a file under 10 MB'},400);if(actor.role==='client')return json({error:'Staff demo roles only'},403);const key=crypto.randomUUID();a={type:'attachment',name:f.name,size:f.size,storageKey:key,ref:String(form.get('ref')||''),revision:Number(form.get('revision'))};file={key,blob:f}}
 else a=JSON.parse(String(init.body));
 if(a.revision!==s.revision)return json({error:'Another tab saved changes. Refresh and retry.'},409);
 applyAction(s,packet,a,actor);s.revision++;await writeState(a.revision,s,file);return json({ok:true,revision:s.revision});
 }
 if(url.searchParams.has('attachment')){const a=s.attachments.find((a:any)=>a.id===url.searchParams.get('attachment'));if(!a||actor.role==='client')return json({error:'Attachment unavailable'},403);const blob=await read('files',a.storageKey);return blob?new Response(blob,{headers:{'Content-Type':'application/octet-stream'}}):json({error:'File not found'},404)}
 const reveal=url.searchParams.get('reveal')==='1';if(reveal&&!actor.sensitive_data_clearance)return json({error:'This demo role has no clearance'},403);
 if(reveal){s.localAccessLog??=[];s.localAccessLog.push({id:crypto.randomUUID(),at:new Date().toISOString(),actor:actor.id,action:'Unmasked browser-demo view'});const revision=s.revision;s.revision++;await writeState(revision,s)}
 let result:any={packet,state:s,blockers:blockers(s,packet),actor};
 if(actor.role==='client')result={packet:{packet:packet.packet,firm:{staff:[],client_users:packet.firm.client_users},return_versions:[{summary:packet.return_versions.at(-1).summary}]},state:{revision:s.revision,contentRevision:s.contentRevision,notes:s.notes.filter((n:any)=>n.kind==='question'),signoffs:s.signoffs,stage:s.stage},blockers:[],actor};
 if(!reveal)result=maskPacket({...packet,payload:result}).payload;
 if(actor.role==='firm_administrator')result.accessLogs=s.localAccessLog||[];
 if(url.searchParams.get('export')==='1'){if(actor.role==='client')return json({error:'Staff export only'},403);return json({...result,exported_at:new Date().toISOString(),limitations:['Static browser-only demo; not shared server state','All source data is fictional and publicly downloadable','Role controls and masking are UI demonstrations, not security boundaries','No real filing, legal signature, tax-engine recomputation or runtime AI']})}
 return json(result);
 }catch(e:any){return json({error:e.message},400)}
}
