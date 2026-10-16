export function makeIssues(p,standards=p.firm.starter_standards){
 const v=p.return_versions.at(-1), ev=Object.fromEntries(p.extracted_values.map(e=>[e.id,e]));
 const issues=v.diagnostics.map((d,i)=>({id:'engine-'+i,title:d.code.replaceAll('_',' '),detail:d.message,refs:d.refs,severity:d.severity==='warning'?'high':'info',kind:'Engine diagnostic',status:'open'}));
 const interest=v.lines.filter(l=>l.form==='SchB'&&l.label.includes('Northlake')&&l.value===1840);
 if(interest.length>1)issues.unshift({id:'duplicate-interest',title:'Same bank interest appears twice',detail:'D28 and D29 both identify the Northlake Bank sweep program, account 7731, with $1,840 interest. Two Schedule B lines include the amount. Confirm duplication before adjusting.',refs:['ev-0492','ev-0538',...interest.map(l=>l.key)],severity:'high',kind:'Independent reconciliation',status:'open'});
 const lots=p.extracted_values.filter(e=>e.document_id==='D31'&&/^M\d+_proceeds$/.test(e.field));
 const summary=p.extracted_values.find(e=>e.document_id==='D31'&&e.field==='b_summary_proceeds');
 const total=lots.reduce((s,e)=>s+Math.round(e.value*100),0)/100;
 if(summary&&summary.value!==total)issues.unshift({id:'missing-lot',title:'A transaction is missing from extracted detail',detail:`D31 summary ${summary.value.toFixed(2)} minus extracted proceeds ${total.toFixed(2)} = ${(summary.value-total).toFixed(2)}. Page 32 lists M18: $250 proceeds, $310 basis. Review and add the missing detail; do not equate proceeds with taxable gain.`,refs:[summary.id,'doc:D31#page32'],severity:'high',kind:'Independent reconciliation',status:'open'});
 issues.push({id:'donation-evidence',title:'Donation amount needs confirmation',detail:'D64 prints $?,500.00; first digit may be 1 or 7. The model selected $1,500. Request supporting evidence; do not guess.',refs:['ev-1049'],severity:'high',kind:'Evidence quality',status:'open'});
 const py=p.prior_years.return_2024.lines;
 for(const l of v.lines.filter(l=>l.form==='F1040')) {const old=py[l.key];if(typeof old==='number'&&typeof l.value==='number'&&Math.abs(l.value-old)>standards.variance_review.and_over_amount&&Math.abs(l.value-old)>Math.abs(old)*standards.variance_review.flag_if_change_over_percent/100)issues.push({id:'variance-'+l.key,title:l.label+' changed since 2024',detail:`Prior: ${old}; current: ${l.value}; difference: ${l.value-old}. Explain the movement and attach evidence.`,refs:[l.key,'py:/return_2024/lines/'+l.key],severity:'medium',kind:'Prior-year variance',status:'open'});}
 return issues;
}
export function initialState(p){return {revision:0,contentRevision:0,issues:makeIssues(p),adjustments:[],verifications:[],decisions:[],signoffs:[],events:[],notes:[],tasks:[],attachments:[],time:[],checks:{},dispositions:{},standards:p.firm.starter_standards,stage:'In preparation',snapshots:[],branch:'2025 original',preparers:['st-01'],notifications:[],scenario:null,carryforward:null};}
export function blockers(s,p){return [
 ...s.issues.filter(i=>i.status==='open'&&i.severity!=='info').map(i=>'Issue: '+i.title),
 ...s.notes.filter(n=>n.blocking&&n.status==='open').map(n=>'Review note: '+n.text),
 ...p.documents.filter(d=>d.id!=='D72'&&!s.dispositions[d.id]).map(d=>'Document not accounted for: '+d.id),
 ...s.standards.required_steps.slice(0,9).filter(k=>!s.checks[k]).map(k=>'Checklist: '+k),
 ...['reviewer','partner','client'].filter(role=>!s.signoffs.some(x=>x.role===role&&x.revision===s.contentRevision)).map(role=>'Current '+role+' approval required')];}
export function applyAction(s,p,a,user){
 const now=new Date().toISOString(),id=crypto.randomUUID(),staff=user.role!=='client',edit=['preparer','reviewer','partner'].includes(user.role);
 const ensure=(ok,msg)=>{if(!ok)throw Error(msg)};
 const mutable=!s.stage.includes('frozen');
 const substantive=['adjust','resolve','verify','decision','disposition','check','scenario','undo','note','reply','attachment','standards'];
 if(substantive.includes(a.type)) ensure(mutable,'Filed records are frozen. Create an amendment first.');
 let detail=a.type;
 if(a.type==='adjust'){
 ensure(edit,'This role cannot adjust values.');ensure(a.reason?.trim()&&a.source?.trim(),'A reason and evidence reference are required.');
 const line=p.return_versions.at(-1).lines.find(l=>l.key===a.key);ensure(line&&typeof line.value==='number','Choose a numeric return line.');ensure(Number.isFinite(Number(a.value)),'Enter a finite amount.');
 const original=s.adjustments.filter(x=>x.key===a.key&&!x.undone).at(-1)?.value??line.value;
 const rate=p.return_versions.at(-1).tax_effect_rates[a.category];ensure(rate,'Choose a supported tax-effect category.');
 const delta=(Math.round(Number(a.value)*100)-Math.round(original*100))/100;
 const fed=Math.round(delta*rate.federal_per_dollar*100)/100,ca=Math.round(delta*rate.california_per_dollar*100)/100;
 s.adjustments.push({id,key:a.key,original,value:Number(a.value),reason:a.reason,source:a.source,category:a.category,delta,fed,ca,by:user.id,at:now,branch:s.branch});
 if(!s.preparers.includes(user.id))s.preparers.push(user.id);detail=`Adjusted ${a.key}: ${original} → ${a.value}. ${a.reason}`;
 }else if(a.type==='undo'){
 ensure(edit,'This role cannot undo adjustments.');const x=s.adjustments.find(x=>x.id===a.id);ensure(x&&!x.undone&&x.branch===s.branch,'Adjustment cannot be undone on this branch.');ensure(!s.adjustments.some(y=>y.key===x.key&&!y.undone&&y.at>x.at),'Undo newer adjustments to this line first.');x.undone=true;detail='Undo adjustment '+x.key;
 }else if(a.type==='resolve'){
 ensure(edit,'This role cannot resolve issues.');ensure(a.reason?.trim()&&a.authority?.trim(),'Record a conclusion and evidence/authority.');const targets=s.issues.filter(i=>a.ids.includes(i.id));ensure(targets.length,'Select issues.');for(const i of targets){i.status=a.reopen?'open':'resolved';i.resolution=a.reason;i.authority=a.authority;i.by=user.id;}detail=`${a.reopen?'Reopened':'Resolved'} ${targets.length} issue(s): ${a.reason}`;
 }else if(a.type==='verify'){
 ensure(edit,'This role cannot verify records.');ensure(s.standards.verification_types.includes(a.method),'Choose a verification method.');ensure(a.ref&&a.reason?.trim(),'Reference and verification notes are required.');s.verifications.push({id,...a,by:user.id,at:now});
 }else if(a.type==='decision'){
 ensure(edit,'This role cannot record decisions.');ensure(a.reason?.trim()&&a.authority?.trim(),'Reason and authority are required.');s.decisions.push({id,...a,by:user.id,at:now});
 }else if(a.type==='disposition'){
 ensure(edit,'This role cannot account for documents.');ensure(a.reason?.trim(),'Record why the document is used, excluded or pending.');for(const doc of a.ids){ensure(p.documents.some(d=>d.id===doc),'Unknown document');s.dispositions[doc]={status:a.status,reason:a.reason,by:user.id,at:now};}
 }else if(a.type==='check'){
 ensure(edit,'This role cannot complete preparation checks.');ensure(a.reason?.trim(),'Record evidence for this check.');s.checks[a.key]=a.done?{by:user.id,at:now,reason:a.reason}:null;
 }else if(a.type==='note'){
 ensure(staff||a.kind==='question','Clients can only add questions.');ensure(a.text?.trim(),'Write a note.');s.notes.push({id,text:a.text,ref:a.ref,blocking:!!a.blocking,kind:a.kind||'note',status:'open',by:user.id,at:now,replies:[]});
 }else if(a.type==='reply'){
 const n=s.notes.find(n=>n.id===a.id);ensure(n,'Note not found');ensure(a.text?.trim(),'Write a reply.');n.replies.push({text:a.text,by:user.id,at:now});if(a.resolve){ensure(edit,'Only preparation/review roles can resolve a note.');n.status='resolved';}
 }else if(a.type==='task'){
 ensure(staff,'Only staff assign work.');ensure(a.text&&a.owner&&a.due,'Task, owner and due date required.');s.tasks.push({id,...a,status:'open',by:user.id,at:now});
 }else if(a.type==='taskDone'){
 ensure(staff,'Staff only');const t=s.tasks.find(t=>t.id===a.id);ensure(t,'Task not found');t.status=t.status==='done'?'open':'done';
 }else if(a.type==='sign'){
 ensure(['reviewer','partner','client'].includes(user.role),'Switch to an eligible reviewer, partner or client.');ensure(!s.preparers.includes(user.id),'You cannot sign work you prepared.');
 if(user.role==='client')ensure(s.signoffs.some(x=>x.role==='partner'&&x.revision===s.contentRevision),'Partner approval required before client authorization.');
 ensure(a.reason?.trim(),'Enter your approval statement.');s.signoffs.push({id,role:user.role,by:user.id,revision:s.contentRevision,at:now,statement:a.reason,simulated:true});detail='Recorded simulated '+user.role+' approval';
 }else if(a.type==='scenario'){ensure(edit,'Staff preparation role required');ensure(p.what_if.alternatives.some(x=>x.id===a.id)||a.id===null,'Unknown scenario');s.scenario=a.id;detail='Scenario comparison selected; computed return unchanged';
 }else if(a.type==='time'){ensure(staff,'Staff only');ensure(Number(a.hours)>0&&Number(a.hours)<=24,'Enter hours from 0 to 24');s.time.push({id,area:a.area,hours:Number(a.hours),by:user.id,at:now});
 }else if(a.type==='standards'){ensure(user.role==='firm_administrator','Administrator role required');ensure(Number(a.percent)>=0&&Number(a.amount)>=0,'Thresholds must be positive');s.standards.variance_review.flag_if_change_over_percent=Number(a.percent);s.standards.variance_review.and_over_amount=Number(a.amount);s.standards.note=a.reason||s.standards.note; const previous=new Map(s.issues.map(i=>[i.id,i]));s.issues=makeIssues(p,s.standards).map(i=>previous.get(i.id)||i);
 }else if(a.type==='file'){
 ensure(user.role==='partner','Partner role required');ensure(mutable,'Already frozen');ensure(blockers(s,p).length===0,'Filing blocked: complete issues, evidence checklist and approvals.');
 const snapshot=JSON.parse(JSON.stringify({...s,snapshots:[]}));s.snapshots.push({id,at:now,by:user.id,state:snapshot});s.stage='Filed / frozen';detail='Simulated filing: immutable snapshot created';
 }else if(a.type==='amend'){
 ensure(user.role==='partner','Partner role required');ensure(!mutable,'File and freeze the original first');s.branch='2025 amendment '+(s.snapshots.length);s.stage='Amendment in preparation';s.signoffs=[];s.checks={};s.contentRevision++;
 }else if(a.type==='filingStatus'){
 ensure(user.role==='partner','Partner role required');ensure(!mutable,'Freeze a filing first');ensure(['Rejected / frozen','Accepted / frozen'].includes(a.status),'Unsupported status');s.stage=a.status;detail='Simulated agency status: '+a.status;
 }else if(a.type==='carryforward'){
 ensure(staff,'Staff only');s.carryforward={created_at:now,source_branch:s.branch,carryovers:p.return_versions.at(-1).carryovers_out,basis:p.prior_years.basis_records,open_items:s.issues.filter(i=>i.status==='open'),planning:p.planning_reference_2026,warning:'Imported engine carryovers; adjustments require recomputation and review.'};
 }else if(a.type==='attachment'){
 ensure(a.name&&a.storageKey,'File metadata required');s.attachments.push({id,name:a.name,storageKey:a.storageKey,size:a.size,ref:a.ref,by:user.id,at:now});
 }else throw Error('Unsupported action');
 if(substantive.includes(a.type)){s.contentRevision++;s.notifications.unshift({id,at:now,text:'Review changed. Existing approvals are stale until reviewed again.',revision:s.contentRevision});}
 s.events.push({id,at:now,actor:user.id,role:user.role,action:a.type,detail});return s;
}
export function maskPacket(p){
 const secrets=new Set();
 for(const e of p.extracted_values)if(['ssn','ein','account_number'].includes(e.value_type)||/pin|routing|account_number/i.test(e.field)){if(e.value)secrets.add(String(e.value));if(e.text_as_read)secrets.add(e.text_as_read);}
 function collect(o){if(!o||typeof o!=='object')return;for(const [k,v]of Object.entries(o)){if(/ssn|ip_pin|ero_pin|efin|routing|account_number|ptin/i.test(k)&&['string','number'].includes(typeof v))secrets.add(String(v));else collect(v);}}collect(p.household);collect(p.firm);
 const values=[...secrets].filter(x=>x.length>=4).sort((a,b)=>b.length-a.length);
 function scrub(o,key=''){if(o===null)return null;if(typeof o==='string'){let s=o.replace(/\b\d{3}-\d{2}-\d{4}\b/g,'•••-••-••••');for(const v of values)s=s.split(v).join('••••');return s;}if(Array.isArray(o))return o.map(x=>scrub(x));if(typeof o==='object'&&o.document_id&&(['ssn','ein','account_number'].includes(o.value_type)||/pin|routing|account_number/i.test(o.field)))return {...o,value:'••••',text_as_read:'••••'};if(typeof o==='object')return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,/ssn|ip_pin|ero_pin|efin|routing|account_number|ptin/i.test(k)?'••••':scrub(v,k)]));return o;}return scrub(p);
}
