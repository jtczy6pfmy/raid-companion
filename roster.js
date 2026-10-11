import { saveCloudChampion } from './cloud.js';
import { parseCSV, planImport, canonicalName } from './csv-import.js';
import { filterChampions,statsFor } from './companion-model.js';

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
 const noteDrafts=new Map();
 const primaryChampion=()=>rows.find(r=>r.starterName==='Cheshire Cat')||rows.find(r=>r.name==='Cheshire Cat');
 let rows, editingId=null, syncing=false, cloudReady=false, storageError=false,cloudSettled=false,imported=null,sourceFile='',previewSnapshot='',fileRead=0;
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
  $('applyImport').disabled=!cloudSettled||syncing||!imported;
  if(storageError){status('Device storage is unavailable. Export your data before closing this page.');return;}
  const pending=rows.filter(r=>r.pending).length;
  status(syncing?'Syncing champion changes…':pending?`${pending} champion change${pending===1?'':'s'} saved on this device; waiting for cloud sync.`:cloudReady?'Roster synced with your private cloud session.':'Roster saved on this device. Connecting to cloud…');
 }
 function render() {
  const container=$('championRoster');container.replaceChildren();
  const query=$('rosterSearch').value.trim().toLocaleLowerCase();
  const counts=new Map();const copyLabels=new Map();
  for(const row of rows){const key=row.name.toLocaleLowerCase();const copy=(counts.get(key)||0)+1;counts.set(key,copy);copyLabels.set(row.id,copy);}
  for(const row of filterChampions(rows,{search:query,rarity:$('filterRarity')?.value,affinity:$('filterAffinity')?.value,faction:$('filterFaction')?.value,rank:$('filterRank')?.value,leveling:$('filterLeveling')?.checked,sort:$('rosterSort')?.value||'name'})) {
   const card=document.createElement('div');card.className='roster-card';
   const label=row.name+(counts.get(row.name.toLocaleLowerCase())>1?` (copy ${copyLabels.get(row.id)})`:'');
   const title=document.createElement('h3');title.textContent=label;
   const details=document.createElement('p');details.className='muted';details.textContent=`${row.rank}★ · Level ${row.level} · ${row.ascension} ascension stars`;
   const notes=document.createElement('p');notes.textContent=row.notes||'No build notes yet.';
   const sync=document.createElement('p');sync.className='sync-label'+(row.pending?' pending':'');sync.textContent=row.pending?'Saved on device · sync pending':row.cloudId?'Cloud saved':'Starting entry';
   const edit=document.createElement('button');edit.type='button';edit.className='roster-secondary';edit.textContent='Edit champion';edit.setAttribute('aria-label','Edit '+label);edit.onclick=()=>openEditor(row);
   const view=document.createElement('button');view.type='button';view.className='roster-secondary';view.textContent='View dashboard';view.setAttribute('aria-label','View '+label);view.onclick=()=>{
    document.querySelector('[data-tab="champion"]').click();$('dashboardChampion').value=row.id;renderDashboard();window.scrollTo({top:0,behavior:'auto'});
   };
   card.append(title,details,notes,sync);
   const importedValues=row.import_data?.values||{},stats=statsFor(row);
   const tags=document.createElement('p');tags.className='champion-tags';tags.textContent=[importedValues.Rarity,importedValues.Affinity,importedValues.Faction].filter(Boolean).join(' · ');
   if(tags.textContent)card.insertBefore(tags,notes);
   if(stats.spd!==null||stats.acc!==null){const strip=document.createElement('p');strip.className='champion-stats';strip.textContent=`Snapshot SPD ${stats.spd??'—'} · ACC ${stats.acc??'—'}`;card.insertBefore(strip,notes);}
   if(row.import_data?.values){
    const extra=document.createElement('details'),heading=document.createElement('summary'),list=document.createElement('dl');heading.textContent='Imported details & stats';
    const source=document.createElement('p');source.className='muted';source.textContent='CSV snapshot: '+row.import_data.sourceFile;
    for(const [key,value] of Object.entries(row.import_data.values)){if(value==='')continue;const term=document.createElement('dt'),description=document.createElement('dd');term.textContent=key;description.textContent=value;list.append(term,description);}
    extra.append(heading,source,list);card.append(extra);
   }
   const actions=document.createElement('div');actions.className='roster-buttons';actions.append(view,edit);card.append(actions);container.append(card);
  }
  if(!container.childElementCount){const empty=document.createElement('p');empty.textContent='No champions match your search.';container.append(empty);}
  if($('trackedChampions'))$('trackedChampions').textContent=rows.length;
  if($('rosterCount'))$('rosterCount').textContent=`${container.querySelectorAll('.roster-card').length} shown / ${rows.length} champion copies`;
  if($('dashboardChampion')){
   const selected=$('dashboardChampion').value||primaryChampion()?.id;
   $('dashboardChampion').replaceChildren(...rows.map(row=>{
    const option=document.createElement('option');option.value=row.id;
    option.textContent=row.name+(counts.get(row.name.toLocaleLowerCase())>1?' (copy '+copyLabels.get(row.id)+')':'');return option;
   }));
   if(rows.some(row=>row.id===selected))$('dashboardChampion').value=selected;
   renderDashboard();
  }
  if($('levelChampion')){
   const selected=$('levelChampion').value;
   $('levelChampion').replaceChildren(...rows.map(r=>{const option=document.createElement('option');option.value=r.id;option.dataset.name=r.name;option.textContent=`${r.name}${counts.get(r.name.toLocaleLowerCase())>1?' (copy '+copyLabels.get(r.id)+')':''} · ${r.rank}★ · Lv ${r.level}`;return option;}));
   const selectedRow=rows.find(r=>r.id===selected)||rows.find(r=>r.name===selected);
   if(selectedRow)$('levelChampion').value=selectedRow.id;
  }
  window.dispatchEvent(new CustomEvent('raid-roster-change'));
 }
 function renderDashboard(){
  const row=rows.find(row=>row.id===$('dashboardChampion')?.value);if(!row)return;
  $('dashboardName').textContent=row.name;
  $('dashboardProgress').textContent=`${row.rank}★ · Level ${row.level} / ${row.rank*10} · ${row.ascension} ascension stars`;
  const fields=[['HP','Total HP',19222],['ATK','Total ATK',1971],['DEF','Total DEF',1335],['SPD','Total SPD',167],['C.RATE %','Total C.RATE',71],['C.DMG %','Total C.DMG',103],['RES','Total RES',87],['ACC','Total ACC',125]];
  const snapshot=row.import_data?.values;
  const baseline=!snapshot&&row.id===primaryChampion()?.id;
  $('statsSource').textContent=snapshot?'Imported CSV snapshot · '+(row.import_data.sourceFile||'source file')+' · values may differ from current in-game stats.':baseline?'Previous Cheshire Cat screenshot baseline · values may differ from current in-game stats.':'No stat snapshot saved for this champion. Import a CSV to add stats.';
  $('stats').replaceChildren(...fields.map(([label,key,value])=>{
   const card=document.createElement('div');card.className='stat';const title=document.createElement('small');title.textContent=label;
   const number=document.createElement('strong');number.textContent=snapshot?(snapshot[key]||'—'):baseline?value.toLocaleString():'—';card.append(title,number);return card;
  }));
  $('notes').value=noteDrafts.has(row.id)?noteDrafts.get(row.id):row.notes||'';
  $('notes').setAttribute('aria-label','Build notes for '+row.name);
  $('dashboardNoteStatus').textContent=noteDrafts.has(row.id)?'Unsaved notes for this champion.':row.pending?'Saved on this device · cloud sync pending.':row.cloudId?'Notes saved in your private cloud session.':'Notes saved on this device.';
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
  // Preserve the legacy Cheshire Cat notes key for existing devices and backups.
  const primary=primaryChampion();
  if(row.id===primary?.id){
   try{localStorage.setItem('raid-notes-v1',row.notes);}catch{}
  }
 }
 if($('dashboardChampion')){
  $('dashboardChampion').addEventListener('change',renderDashboard);
  $('notes').addEventListener('input',()=>{noteDrafts.set($('dashboardChampion').value,$('notes').value);$('dashboardNoteStatus').textContent='Unsaved notes for this champion.';});
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
  const previous=rows.find(r=>r.id===editingId);
  if((!previous||previous.name.toLocaleLowerCase()!==name.toLocaleLowerCase())&&rows.some(r=>r.id!==editingId && r.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase())){$('editorError').textContent='This champion is already listed. Edit the existing entry.';return;}
  let row=rows.find(r=>r.id===editingId);
  if(!row){row={id:crypto.randomUUID(),cloudId:null,starter:false,revision:0};rows.push(row);}
  // Keep the baseline's identity stable so its dashboard notes and snapshots stay linked.
  if(row.name==='Cheshire Cat' && name!==row.name){$('editorError').textContent='Keep the Cheshire Cat name for the existing dashboard baseline.';return;}
  Object.assign(row,{name,rank,level,ascension,notes:$('championBuildNotes').value});saveLocal(row);
  $('championForm').hidden=true;editingId=null;void syncPending();
 };
 $('addChampion').onclick=()=>openEditor();$('cancelChampion').onclick=()=>{$('championForm').hidden=true;editingId=null;$('addChampion').focus();};
 $('championRank').onchange=updateLimits;$('rosterSearch').oninput=render;
 for(const id of ['filterRarity','filterAffinity','filterFaction','filterRank','filterLeveling','rosterSort'])if($(id))$(id).addEventListener('change',render);
 if($('clearFilters'))$('clearFilters').onclick=()=>{for(const id of ['filterRarity','filterAffinity','filterFaction','filterRank'])$(id).value='';$('filterLeveling').checked=false;$('rosterSearch').value='';$('rosterSort').value='name';render();};
 if($('levelChampion'))$('levelChampion').addEventListener('change',()=>{
  const row=rows.find(r=>r.id===$('levelChampion').value);
  if(row){$('currentRank').value=row.rank;$('currentLevel').value=row.level;$('currentRank').dispatchEvent(new Event('input'));}
 });
 $('retryRoster').onclick=()=>{status('Reconnecting to cloud…');window.dispatchEvent(new Event('raid-reconnect'));};
 const rosterSnapshot=()=>JSON.stringify(rows.map(({id,cloudId,name,rank,level,ascension,notes,import_key,import_data})=>({id,cloudId,name,rank,level,ascension,notes,import_key,import_data})));
 function previewImport() {
  if(!imported)return;
  const plan=planImport(imported,rows,{updateProgress:$('updateImportProgress').checked,sourceFile});
  previewSnapshot=rosterSnapshot();$('importRows').replaceChildren();
  const totals={Add:0,Update:0,Unchanged:0};
  for(const item of plan){totals[item.action]++;const tr=document.createElement('tr');
   const existing=rows.find(r=>r.id===item.existingId);
   const current=existing?`${existing.rank}★ / Lv ${existing.level} / Asc ${existing.ascension}`:'—';
   const next=item.progressKept?current:`${item.champion.rank}★ / Lv ${item.champion.level} / Asc ${item.champion.ascension}`;
   for(const value of [item.champion.name+(item.champion.copy>1?` (copy ${item.champion.copy})`:''),item.action,current,next]){const td=document.createElement('td');td.textContent=value;tr.append(td);}
   $('importRows').append(tr);
  }
  $('importSummary').textContent=`${imported.length} copies in ${sourceFile}: ${totals.Add} to add, ${totals.Update} to update, ${totals.Unchanged} unchanged. Build notes are preserved.`;
  $('importPreview').hidden=false;$('applyImport').disabled=!cloudSettled||syncing;
 }
 // Native visible file input supports Safari on iPad.
 $('csvFile').onchange=async()=>{
  const file=$('csvFile').files[0];if(!file)return;const request=++fileRead;imported=null;$('importPreview').hidden=true;$('importError').textContent='';$('updateImportProgress').checked=false;
  try{if(file.size>2*1024*1024)throw new Error('Choose a CSV smaller than 2 MB.');const text=await file.text();if(request!==fileRead)return;imported=parseCSV(text);sourceFile=file.name;previewImport();}
  catch(error){if(request===fileRead)$('importError').textContent=error.message;}
  finally{$('csvFile').value='';}
 };
 $('updateImportProgress').onchange=previewImport;
 $('cancelImport').onclick=()=>{++fileRead;imported=null;$('importPreview').hidden=true;$('importError').textContent='';};
 $('applyImport').onclick=()=>{
  if(!imported||syncing||!cloudSettled)return;
  if(previewSnapshot!==rosterSnapshot()){previewImport();$('importError').textContent='Your roster changed while the preview was open. Review the updated preview and confirm again.';return;}
  const plan=planImport(imported,rows,{updateProgress:$('updateImportProgress').checked,sourceFile});
  const backup=JSON.stringify(rows);let changed=0;
  for(const item of plan){if(item.action==='Unchanged')continue;let row=rows.find(r=>r.id===item.existingId);
   if(!row){row={id:crypto.randomUUID(),cloudId:null,starter:false,revision:0,notes:''};rows.push(row);}
   Object.assign(row,item.changes);row.pending=true;row.revision=(row.revision||0)+1;changed++;
  }
  if(!persist()){rows=JSON.parse(backup);$('importError').textContent='Import was not saved: device storage is unavailable. Export your data or free space, then retry.';render();return;}
  imported=null;$('importPreview').hidden=true;$('importError').textContent='';render();summary();
  if(!changed)status('This file is already imported; no changes were needed.');else void syncPending();
 };
 persist();render();summary();
 return {
  getChampions(){return structuredClone(rows);},
  setCloudStatus(message){if(message.startsWith('Cloud connected')||message.startsWith('Local-only'))cloudSettled=true;$('applyImport').disabled=!cloudSettled||syncing||!imported;if(message.startsWith('Local-only')){cloudReady=false;status(rows.some(r=>r.pending)?'Changes saved on this device; cloud unavailable. Retry cloud sync when connected.':'Roster saved on this device; cloud unavailable.');}},
  receiveCloud(champions) {
   cloudReady=true;
   for(const champion of champions) {
    let row=rows.find(r=>r.cloudId===champion.id || r.id===champion.id || (champion.import_key && r.import_key===champion.import_key)) || rows.find(r=>r.starter && !r.cloudId && canonicalName(r.starterName||r.name)===canonicalName(champion.name));
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
  restoreMissing(champions){
   if(!cloudReady||syncing||rows.some(r=>r.pending))return {ok:false,reason:'Wait for champion cloud sync to finish.'};
   const keys=new Set(rows.map(r=>r.import_key).filter(Boolean)),seen=new Set(),add=[];
   for(const c of champions){
    if(!c.import_key||typeof c.import_key!=='string')return {ok:false,reason:'Backup has champion copies without stable import keys. No changes made.'};
    if(keys.has(c.import_key)||seen.has(c.import_key))continue;
    if(typeof c.name!=='string'||!c.name.trim()||!Number.isInteger(c.rank)||c.rank<1||c.rank>6||!Number.isInteger(c.level)||c.level<1||c.level>c.rank*10||!Number.isInteger(c.ascension)||c.ascension<0||c.ascension>c.rank)return {ok:false,reason:'Invalid champion data.'};
    seen.add(c.import_key);add.push({id:crypto.randomUUID(),cloudId:null,starter:false,pending:true,revision:1,name:c.name,rank:c.rank,level:c.level,ascension:c.ascension,notes:typeof c.notes==='string'?c.notes:'',import_key:c.import_key,import_data:c.import_data||null});
   }
   if(!add.length)return {ok:true,added:0};
   const before=rows;rows=[...rows,...add];
   if(!persist()){rows=before;return {ok:false,reason:'Device storage unavailable.'};}
   render();summary();void syncPending();return {ok:true,added:add.length};
  },
  exportRoster(){return rows.map(({name,level,rank,ascension,notes,import_key,import_data})=>({name,level,rank,ascension,notes,import_key,import_data}));},
  async saveDashboardNotes(notes,id=primaryChampion()?.id){
   const row=rows.find(row=>row.id===id);
   if(!row)return {saved:false,localSaved:false,reason:'Select a champion in the roster'};
   if(typeof notes!=='string'||notes.length>10000)return {saved:false,localSaved:false,reason:'Build notes must be at most 10,000 characters.'};
   noteDrafts.delete(row.id);
   row.notes=notes;saveLocal(row);await syncPending();
   return {saved:!row.pending&&!storageError,localSaved:!storageError,reason:storageError?'Device storage is unavailable; export your data before closing.':row.pending?'Champion changes are waiting for cloud sync.':''};
  }
 };
}
