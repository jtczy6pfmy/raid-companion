import {loadCloudPlans,saveCloudPlan} from './cloud.js?v=20261012-3';
import {STAT_FIELDS,statsFor,championRef,resolveChampion,compareStats,targetProgress,runSummary,sessionEstimate,duration,numberOrNull} from './companion-model.js?v=20261012-3';

const key='raid-companion-tools-v1';
export function initCompanion(roster){
 const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 let records=[],rows=roster.getChampions(),syncing=false,loading=false,ready=false,buildId=null,teamId=null;
 try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))records=saved.filter(validRecord);}catch{}
 function validRecord(r){
  if(!r||typeof r.id!=='string'||!['build','team','run'].includes(r.kind)||!r.payload||typeof r.payload!=='object'||Array.isArray(r.payload))return false;
  const p=r.payload;
  if(r.kind==='run')return typeof p.dungeon==='string'&&['Victory','Defeat'].includes(p.result)&&Number.isFinite(p.seconds)&&p.seconds>0&&Number.isFinite(p.energy)&&p.energy>=0&&typeof p.recordedAt==='string'&&Number.isFinite(Date.parse(p.recordedAt));
  if(typeof p.name!=='string')return false;
  return r.kind==='team'?Array.isArray(p.members)&&p.members.length<=6:!!p.champion&&typeof p.champion==='object';
 }
 const active=kind=>records.filter(r=>r.kind===kind&&!r.deleted);
 function status(message){$('toolsStatus').textContent=message;}
 function persist(){try{localStorage.setItem(key,JSON.stringify(records));return true;}catch{status('Device storage unavailable. Export your data before closing this page.');return false;}}
 function summary(){const n=records.filter(r=>r.pending).length;status(syncing?'Saving companion plans to cloud…':n?`${n} companion change${n===1?'':'s'} saved on this device · cloud sync pending.`:ready?'Builds, teams and battle log synced with your private cloud session.':'Companion tools saved on this device · connecting to cloud.');}
 async function sync(){
  if(syncing||loading||!ready)return;syncing=true;summary();let failed=false;
  try{for(const record of records.filter(r=>r.pending)){
   const revision=record.updated_at,result=await saveCloudPlan(structuredClone(record));
   if(!result.saved){failed=true;status('Companion changes saved on this device · '+result.reason);break;}
   if(record.updated_at===revision)record.pending=false;
   if(!persist()){failed=true;break;}
  }}catch{failed=true;status('Companion changes saved on this device · retry cloud sync when connected.');}
  finally{syncing=false;renderSaved();if(!failed){summary();if(records.some(r=>r.pending))queueMicrotask(()=>void sync());}}
 }
 async function connectCloud(){
  if(loading)return;loading=true;const result=await loadCloudPlans();loading=false;
  if(!result.loaded){ready=false;status('Companion tools saved on this device · '+result.reason);return;}
  ready=true;
  for(const remote of result.plans.filter(validRecord)){const local=records.find(r=>r.id===remote.id);if(!local)records.push({...remote,pending:false});else if(!local.pending)Object.assign(local,remote,{pending:false});}
  if(!persist())return;renderSaved();summary();await sync();
 }
 function saveRecord(kind,payload,id){
  const before=structuredClone(records);let record=records.find(r=>r.id===id);
  if(!record){record={id:crypto.randomUUID(),kind};records.push(record);}
  const nextTime=Math.max(Date.now(),(Date.parse(record.updated_at)||0)+1);
  Object.assign(record,{payload:structuredClone(payload),deleted:false,pending:true,updated_at:new Date(nextTime).toISOString()});
  if(!persist()){records=before;return null;}renderSaved();summary();void sync();return record.id;
 }
 function removeRecord(record){if(!confirm('Remove '+(record.payload.name||record.payload.dungeon+' run')+'?'))return;
  const before=structuredClone(records);record.deleted=true;record.pending=true;record.updated_at=new Date().toISOString();
  if(!persist()){records=before;return;}if(record.id===buildId)resetBuild();if(record.id===teamId)resetTeam();renderSaved();summary();void sync();
 }
 function labels(){const counts=new Map(),copies=new Map();for(const row of rows){counts.set(row.name,(counts.get(row.name)||0)+1);copies.set(row.id,counts.get(row.name));}return row=>row.name+(counts.get(row.name)>1?' (copy '+copies.get(row.id)+')':'');}
 function populate(select,allowEmpty=false){
  const previous=select.value,label=labels();select.replaceChildren();if(allowEmpty){const option=el('option','Choose champion');option.value='';select.append(option);}
  for(const row of rows){const option=el('option',label(row));option.value=row.id;select.append(option);}
  if([...select.options].some(o=>o.value===previous))select.value=previous;
 }
 const rowFor=id=>rows.find(r=>r.id===$(id).value);
 function renderFilters(){
  for(const [id,column] of [['filterRarity','Rarity'],['filterAffinity','Affinity'],['filterFaction','Faction']]){
   const previous=$(id).value;$(id).replaceChildren();const all=el('option','All '+column.toLowerCase());all.value='';$(id).append(all);
   for(const value of [...new Set(rows.map(r=>r.import_data?.values?.[column]).filter(Boolean))].sort()){const option=el('option',value);option.value=value;$(id).append(option);}
   if([...$(id).options].some(o=>o.value===previous))$(id).value=previous;
  }
 }
 function refreshRoster(){rows=roster.getChampions();renderFilters();for(const id of ['compareA','compareB','buildChampion',...Array.from({length:6},(_,i)=>'teamSlot'+i)])populate($(id),id.startsWith('teamSlot'));renderCompare();renderBuild();renderTeam();}
 function appendRow(body,values){const tr=el('tr');for(const value of values)tr.append(el('td',value));body.append(tr);}
 function format(value){return value===null||value===undefined?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:2});}
 function renderCompare(){
  const a=rowFor('compareA'),b=rowFor('compareB');$('compareRows').replaceChildren();
  for(const stat of compareStats(statsFor(a),statsFor(b)))appendRow($('compareRows'),[stat.label,format(stat.left),format(stat.right),stat.delta===null?'—':(stat.delta>0?'+':'')+format(stat.delta)]);
  $('compareSource').textContent='Saved snapshots only. Positive differences mean higher values, not necessarily a better champion for a particular role.';
 }
 for(const id of ['compareA','compareB'])$(id).onchange=renderCompare;
 for(const [stat,label] of STAT_FIELDS){
  for(const [prefix,container] of [['target','buildTargets'],['candidate','buildCandidate']]){
   const wrap=el('div'),title=el('label',label),input=el('input');input.id=prefix+'_'+stat;input.type='number';input.min='0';input.max='10000000';input.step='any';input.placeholder='Not set';title.htmlFor=input.id;input.oninput=renderBuild;wrap.append(title,input);$(container).append(wrap);
  }
 }
 function buildValues(prefix){return Object.fromEntries(STAT_FIELDS.map(([stat])=>[stat,numberOrNull($(prefix+'_'+stat).value)]));}
 function renderBuild(){
  const current=statsFor(rowFor('buildChampion')),candidate=buildValues('candidate'),targets=buildValues('target');
  const proposed=Object.fromEntries(STAT_FIELDS.map(([stat])=>[stat,candidate[stat]===null?current[stat]:candidate[stat]]));
  $('buildResults').replaceChildren();for(const item of targetProgress(proposed,targets))appendRow($('buildResults'),[item.label,format(current[item.key]),format(proposed[item.key]),format(item.target),item.current===null?'Stat unavailable':item.met?'Target met':format(item.gap)+' short']);
  if(!$('buildResults').childElementCount){for(const [stat,label] of STAT_FIELDS)appendRow($('buildResults'),[label,format(current[stat]),format(proposed[stat]),'Not set','Set a target to compare']);}
 }
 $('buildChampion').onchange=renderBuild;
 function resetBuild(){buildId=null;$('buildForm').reset();$('buildMessage').textContent='';$('saveBuild').textContent='Save build plan';renderBuild();}
 $('newBuild').onclick=resetBuild;
 $('buildForm').onsubmit=event=>{event.preventDefault();const row=rowFor('buildChampion');if(!row){$('buildMessage').textContent='Choose a champion.';return;}
  const id=saveRecord('build',{name:$('buildName').value.trim(),champion:championRef(row),role:$('buildRole').value,sets:$('buildSets').value.trim(),notes:$('buildNotes').value,targets:buildValues('target'),candidate:buildValues('candidate')},buildId);
  if(id){buildId=id;$('buildMessage').textContent='Build plan saved on this device.';$('saveBuild').textContent='Update build plan';}
 };
 function loadBuild(record){buildId=record.id;const p=record.payload,row=resolveChampion(p.champion,rows);$('buildName').value=p.name||'';if(row)$('buildChampion').value=row.id;
  $('buildRole').value=p.role||'Custom';$('buildSets').value=p.sets||'';$('buildNotes').value=p.notes||'';
  for(const [stat] of STAT_FIELDS){$('target_'+stat).value=p.targets?.[stat]??'';$('candidate_'+stat).value=p.candidate?.[stat]??'';}
  $('buildMessage').textContent=row?'Loaded saved build plan.':'Champion is missing from your roster. Choose a replacement before saving.';$('saveBuild').textContent='Update build plan';renderBuild();
 }
 for(let i=0;i<6;i++){
  const wrap=el('div'),label=el('label',i===0?'Leader':'Slot '+(i+1)),select=el('select');select.id='teamSlot'+i;label.htmlFor=select.id;select.onchange=renderTeam;wrap.append(label,select);$('teamSlots').append(wrap);
 }
 function selectedTeam(){return Array.from({length:6},(_,i)=>rowFor('teamSlot'+i)).filter(Boolean);}
 function renderTeam(){
  const chosen=selectedTeam(),label=labels();$('teamOrder').replaceChildren();
  const sorted=[...chosen].sort((a,b)=>(statsFor(b).spd??-1)-(statsFor(a).spd??-1));
  for(const row of sorted){const values=row.import_data?.values||{};$('teamOrder').append(el('li',label(row)+' · SPD '+format(statsFor(row).spd)+' · '+(values.Affinity||'Affinity unknown')));}
  if(!chosen.length)$('teamOrder').append(el('li','Choose champions from your roster.'));
  $('teamCoverage').textContent=chosen.length+' champion'+(chosen.length===1?'':'s')+' selected. Order uses snapshot speed only; auras, buffs and turn-meter effects are not simulated.';
 }
 function resetTeam(){teamId=null;$('teamForm').reset();$('teamMessage').textContent='';$('saveTeam').textContent='Save team';renderTeam();}
 $('newTeam').onclick=resetTeam;
 $('teamForm').onsubmit=event=>{event.preventDefault();const chosen=selectedTeam();if(!chosen.length){$('teamMessage').textContent='Choose at least one champion.';return;}
  if(new Set(chosen.map(r=>r.id)).size!==chosen.length){$('teamMessage').textContent='The same champion copy cannot occupy two slots.';return;}
  const members=Array.from({length:6},(_,i)=>championRef(rowFor('teamSlot'+i)));
  const id=saveRecord('team',{name:$('teamName').value.trim(),area:$('teamArea').value,notes:$('teamNotes').value,members},teamId);
  if(id){teamId=id;$('teamMessage').textContent='Team saved on this device.';$('saveTeam').textContent='Update team';}
 };
 function loadTeam(record){teamId=record.id;const p=record.payload;$('teamName').value=p.name||'';$('teamArea').value=p.area||'Dragon';$('teamNotes').value=p.notes||'';
  let missing=false;for(let i=0;i<6;i++){const ref=p.members?.[i],row=resolveChampion(ref,rows);$('teamSlot'+i).value=row?.id||'';if(ref&&!row)missing=true;}
  $('teamMessage').textContent=missing?'One or more champions are missing. Review the slots before saving.':'Loaded saved team.';$('saveTeam').textContent='Update team';renderTeam();
 }
 $('runForm').onsubmit=event=>{event.preventDefault();const seconds=Number($('runSeconds').value),energy=Number($('runEnergy').value),stage=Number($('runStage').value);
  if(!Number.isFinite(seconds)||seconds<=0||seconds>86400||!Number.isInteger(stage)||stage<1||stage>100||!Number.isFinite(energy)||energy<0){$('runMessage').textContent='Check stage, duration and energy.';return;}
  const team=records.find(r=>r.id===$('runTeam').value&&!r.deleted&&r.kind==='team');
  const id=saveRecord('run',{dungeon:$('runDungeon').value,stage,seconds,energy,result:$('runResult').value,notes:$('runNotes').value,recordedAt:new Date().toISOString(),team:team?{id:team.id,name:team.payload.name,members:team.payload.members}:null});
  if(id){$('runMessage').textContent='Battle recorded.';$('runNotes').value='';}
 };
 function renderRuns(){
  const filter=$('runFilter').value,runs=active('run').filter(r=>!filter||r.payload.dungeon===filter).sort((a,b)=>b.payload.recordedAt.localeCompare(a.payload.recordedAt));
  const summary=runSummary(runs.map(r=>r.payload));$('runMetrics').replaceChildren();
  for(const [label,value] of [['Runs',summary.count],['Win rate',summary.winRate===null?'—':Math.round(summary.winRate)+'%'],['Average victory',duration(summary.average)],['Best victory',duration(summary.best)],['Energy recorded',summary.energy]]){
   const card=el('div',undefined,'stat');card.append(el('small',label),el('strong',value));$('runMetrics').append(card);
  }
  $('runRows').replaceChildren();for(const record of runs){const p=record.payload,tr=el('tr');for(const text of [new Date(p.recordedAt).toLocaleString(),p.dungeon+' '+p.stage,p.result,duration(p.seconds),p.energy,p.team?.name||'—',p.notes||''])tr.append(el('td',text));
   const cell=el('td'),remove=el('button','Remove','roster-secondary');remove.type='button';remove.onclick=()=>removeRecord(record);cell.append(remove);tr.append(cell);$('runRows').append(tr);
  }
  if(!runs.length)appendRow($('runRows'),['No manually logged battles yet.']);
 }
 $('runFilter').onchange=renderRuns;
 function renderSaved(){
  for(const [kind,container,load] of [['build','savedBuilds',loadBuild],['team','savedTeams',loadTeam]]){
   $(container).replaceChildren();for(const record of active(kind)){
    const card=el('div',undefined,'tool-card'),p=record.payload;card.append(el('h3',p.name),el('p',kind==='build'?(p.champion?.name||'Champion')+' · '+p.role:p.area),el('small',record.pending?'Saved on device · sync pending':'Cloud saved'));
    const buttons=el('div',undefined,'roster-buttons'),open=el('button','Load '+kind,'roster-secondary'),remove=el('button','Remove','roster-secondary');open.type=remove.type='button';open.onclick=()=>load(record);remove.onclick=()=>removeRecord(record);buttons.append(open,remove);card.append(buttons);$(container).append(card);
   }
   if(!$(container).childElementCount)$(container).append(el('p','No saved '+kind+' plans yet.','muted'));
  }
  const previous=$('runTeam').value;$('runTeam').replaceChildren();const empty=el('option','No saved team');empty.value='';$('runTeam').append(empty);
  for(const record of active('team')){const option=el('option',record.payload.name);option.value=record.id;$('runTeam').append(option);}if([...$('runTeam').options].some(o=>o.value===previous))$('runTeam').value=previous;
  renderRuns();window.dispatchEvent(new Event('raid-plans-change'));
 }
 function renderSession(){try{const plan=sessionEstimate(Number($('sessionRuns').value),Number($('sessionEnergy').value),Number($('sessionSeconds').value));$('sessionResult').textContent=plan.energy.toLocaleString()+' energy · '+duration(plan.seconds)+' total estimated time.';}catch(error){$('sessionResult').textContent=error.message;}}
 for(const id of ['sessionRuns','sessionEnergy','sessionSeconds'])$(id).oninput=renderSession;
 $('retryTools').onclick=()=>window.dispatchEvent(new Event('raid-reconnect'));
 window.addEventListener('raid-roster-change',refreshRoster);
 refreshRoster();if(rows.length>1)$('compareB').value=rows[1].id;renderCompare();renderSaved();renderSession();summary();
 return {connectCloud,setOffline(){ready=false;status('Companion tools saved on this device · cloud unavailable.');},exportData:()=>({version:1,records:structuredClone(records)})};
}
