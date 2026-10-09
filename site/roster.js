import { saveCloudChampion } from './cloud.js';

const storageKey = 'raid-roster-v1';
const starters = [
 {name:'Cheshire Cat',rank:5,level:50,ascension:1,notes:''},
 {name:'Dorothy',rank:5,level:50,ascension:0,notes:'Minotaur leader; ascension unverified'},
 {name:'Kael',rank:6,level:60,ascension:0,notes:'Minotaur damage dealer; ascension unverified'},
 {name:'Vallyarn',rank:5,level:50,ascension:0,notes:'Minotaur team; ascension unverified'},
 {name:'Skathix',rank:5,level:50,ascension:0,notes:'Minotaur team; ascension unverified'}
];

export function initRoster() {
 const $ = id => document.getElementById(id);
 let rows, editingId=null, syncing=false, cloudReady=false, storageError=false;
 try { rows=JSON.parse(localStorage.getItem(storageKey)||'null'); } catch {}
 if(!Array.isArray(rows) || !rows.length || rows.some(r=>!r.id || typeof r.name!=='string' || !Number.isInteger(r.rank) || !Number.isInteger(r.level))) {
  rows=starters.map(r=>({...r,id:crypto.randomUUID(),cloudId:null,starter:true,starterName:r.name,pending:false,revision:0}));
  rows[0].notes=localStorage.getItem('raid-notes-v1')||'';
  rows[0].legacyNotes=localStorage.getItem('raid-notes-v1')!==null;
 }
 const status = message => { $('rosterStatus').textContent=message; };
 function persist() {
  try {localStorage.setItem(storageKey,JSON.stringify(rows));storageError=false;return true;}
  catch {storageError=true;status('Device storage is full or unavailable. Export your data before closing this page.');return false;}
 }
 function summary() {
  if(storageError){status('Device storage is unavailable. Export your data before closing this page.');return;}
  const pending=rows.filter(r=>r.pending).length;
  status(syncing?'Syncing champion changes…':pending?`${pending} champion change${pending===1?'':'s'} saved on this device; waiting for cloud sync.`:cloudReady?'Roster synced with your private cloud session.':'Roster saved on this device. Connecting to cloud…');
 }
 function render() {
  const container=$('championRoster');container.replaceChildren();
  const query=$('rosterSearch').value.trim().toLocaleLowerCase();
  for(const row of rows.filter(r=>r.name.toLocaleLowerCase().includes(query)).sort((a,b)=>a.name.localeCompare(b.name))) {
   const card=document.createElement('div');card.className='roster-card';
   const title=document.createElement('h3');title.textContent=row.name;
   const details=document.createElement('p');details.className='muted';details.textContent=`${row.rank}★ · Level ${row.level} · ${row.ascension} ascension stars`;
   const notes=document.createElement('p');notes.textContent=row.notes||'No build notes yet.';
   const sync=document.createElement('p');sync.className='sync-label'+(row.pending?' pending':'');sync.textContent=row.pending?'Saved on device · sync pending':row.cloudId?'Cloud saved':'Starting entry';
   const edit=document.createElement('button');edit.type='button';edit.className='roster-secondary';edit.textContent='Edit champion';edit.setAttribute('aria-label','Edit '+row.name);edit.onclick=()=>openEditor(row);
   card.append(title,details,notes,sync,edit);container.append(card);
  }
  if(!container.childElementCount){const empty=document.createElement('p');empty.textContent='No champions match your search.';container.append(empty);}
  if($('trackedChampions'))$('trackedChampions').textContent=rows.length;
  if($('levelChampion')){
   const selected=$('levelChampion').value;
   $('levelChampion').replaceChildren(...rows.map(r=>{const option=document.createElement('option');option.value=r.name;option.textContent=`${r.name} · ${r.rank}★ · Lv ${r.level}`;return option;}));
   if(rows.some(r=>r.name===selected))$('levelChampion').value=selected;
  }
 }
 function openEditor(row=null) {
  editingId=row?.id||null;
  $('championForm').reset();$('editorTitle').textContent=row?'Edit champion':'Add champion';
  $('championName').value=row?.name||'';
  $('championRank').value=row?.rank||5;$('championLevel').value=row?.level||1;$('championAscension').value=row?.ascension||0;
  $('championBuildNotes').value=row?.notes||'';$('editorError').textContent='';updateLimits();
  $('championForm').hidden=false;$('championName').focus();
 }
 function updateLimits(){const rank=Number($('championRank').value);$('championLevel').max=rank*10;$('championAscension').max=rank;}
 function catNotes(row) {
  // The dashboard remains a Cheshire Cat snapshot; share its notes with that entry.
  if(row.name==='Cheshire Cat'){
   try{localStorage.setItem('raid-notes-v1',row.notes);}catch{}
   $('notes').value=row.notes;
  }
 }
 async function syncPending() {
  if(syncing)return;
  syncing=true;let failed=false;summary();
  try {
   for(const row of rows.filter(r=>r.pending)) {
    const revision=row.revision;
    const result=await saveCloudChampion({...row,id:row.cloudId||row.id});
    if(!result.saved){failed=true;status(storageError?'Device storage unavailable. Export your data before closing this page.':`Changes saved on this device. Cloud sync unavailable: ${result.reason||'try again later'}`);return;}
    row.cloudId=result.champion.id;
    if(row.revision===revision)row.pending=false;
    persist();render();
   }
  } catch {failed=true;status('Changes saved on this device. Cloud sync unavailable; retry when connected.');}
  finally{syncing=false;render();if(!rows.some(r=>r.pending))summary();else if(!failed)queueMicrotask(()=>void syncPending());}
 }
 function saveLocal(row) {
  row.pending=true;row.revision=(row.revision||0)+1;persist();catNotes(row);render();summary();
 }
 $('championForm').onsubmit=event=>{
  event.preventDefault();const name=$('championName').value.trim();
  const rank=Number($('championRank').value),level=Number($('championLevel').value),ascension=Number($('championAscension').value);
  if(!name || !Number.isInteger(rank) || rank<1 || rank>6 || !Number.isInteger(level) || level<1 || level>rank*10 || !Number.isInteger(ascension) || ascension<0 || ascension>rank){$('editorError').textContent='Enter a name, level within the rank limit, and ascension no higher than the rank.';return;}
  if(rows.some(r=>r.id!==editingId && r.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase())){$('editorError').textContent='This champion is already listed. Edit the existing entry.';return;}
  let row=rows.find(r=>r.id===editingId);
  if(!row){row={id:crypto.randomUUID(),cloudId:null,starter:false,revision:0};rows.push(row);}
  // Keep the baseline's identity stable so its dashboard notes and snapshots stay linked.
  if(row.name==='Cheshire Cat' && name!==row.name){$('editorError').textContent='Keep the Cheshire Cat name for the existing dashboard baseline.';return;}
  Object.assign(row,{name,rank,level,ascension,notes:$('championBuildNotes').value});saveLocal(row);
  $('championForm').hidden=true;editingId=null;void syncPending();
 };
 $('addChampion').onclick=()=>openEditor();$('cancelChampion').onclick=()=>{$('championForm').hidden=true;editingId=null;$('addChampion').focus();};
 $('championRank').onchange=updateLimits;$('rosterSearch').oninput=render;
 if($('levelChampion'))$('levelChampion').addEventListener('change',()=>{
  const row=rows.find(r=>r.name===$('levelChampion').value);
  if(row){$('currentRank').value=row.rank;$('currentLevel').value=row.level;$('currentRank').dispatchEvent(new Event('input'));}
 });
 $('retryRoster').onclick=()=>{status('Reconnecting to cloud…');window.dispatchEvent(new Event('raid-reconnect'));};
 persist();render();summary();
 return {
  setCloudStatus(message){if(message.startsWith('Local-only')){cloudReady=false;status(rows.some(r=>r.pending)?'Changes saved on this device; cloud unavailable. Retry cloud sync when connected.':'Roster saved on this device; cloud unavailable.');}},
  receiveCloud(champions) {
   cloudReady=true;
   for(const champion of champions) {
    let row=rows.find(r=>r.cloudId===champion.id || r.id===champion.id) || rows.find(r=>r.starter && !r.cloudId && (r.starterName||r.name)===champion.name);
    if(row){
     row.cloudId=champion.id;
     if(!row.pending){
      const legacyNotes=row.legacyNotes?row.notes:null;
      Object.assign(row,champion,{id:row.id});
      if(legacyNotes!==null && row.notes!==legacyNotes){row.notes=legacyNotes;row.pending=true;row.revision=(row.revision||0)+1;}
     }
     delete row.legacyNotes;
    }
    else {row={...champion,cloudId:champion.id,starter:false,pending:false,revision:0};rows.push(row);}
    catNotes(row);
   }
   persist();render();summary();void syncPending();
  },
  exportRoster(){return rows.map(({name,level,rank,ascension,notes})=>({name,level,rank,ascension,notes}));},
  async saveDashboardNotes(notes){
   const row=rows.find(r=>r.name==='Cheshire Cat');
   if(!row)return {saved:false,reason:'Cheshire Cat is not in the roster'};
   row.notes=notes;saveLocal(row);await syncPending();
   return {saved:!row.pending,reason:row.pending?'Champion changes are waiting for cloud sync.':''};
  }
 };
}
