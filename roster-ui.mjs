import {parseCSV,guessMapping,validateRoster,MAX_BYTES} from './roster-import.mjs';
const key='raid-roster-v1';
let roster=[],csv=null,preview=null;
const $=id=>document.getElementById(id);
try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(saved)||saved.some(c=>!c||typeof c.name!=='string'))throw Error();roster=saved;}catch{$('importStatus').textContent='Saved roster could not be read. Import a CSV to recover it.';}
function render(){
 if($('trackedCount'))$('trackedCount').textContent=roster.length;
 const q=$('rosterSearch').value.trim().toLowerCase();
 const visible=roster.filter(c=>[c.name,c.faction,c.affinity,c.rarity].some(v=>String(v||'').toLowerCase().includes(q)));
 $('rosterCount').textContent=visible.length+' of '+roster.length+' champions';
 const fragment=document.createDocumentFragment();
 for(const c of visible){
  const card=document.createElement('article');card.className='stat';
  const title=document.createElement('h3');title.textContent=c.name;card.append(title);
  const p=document.createElement('p');p.textContent=[c.level?'Level '+c.level:null,c.rank?c.rank+'★':null,c.faction,c.affinity,c.rarity].filter(Boolean).join(' · ');card.append(p);fragment.append(card);
 }
 $('rosterCards').replaceChildren(fragment);
}
function invalidate(){preview=null;$('confirmImport').disabled=true;$('previewCount').textContent='';}
$('rosterSearch').oninput=render;
let selection=0;
$('csvFile').onchange=async()=>{
 const version=++selection;invalidate();csv=null;$('mapping').replaceChildren();
 try{
  const file=$('csvFile').files[0];if(!file)return;
  if(!file.name.toLowerCase().endsWith('.csv'))throw Error('Choose a CSV file.');
  if(file.size>MAX_BYTES)throw Error('CSV exceeds 5 MB.');
  const text=await file.text();if(version!==selection)return;
  if(text.includes('\uFFFD'))throw Error('Save the CSV as UTF-8 before importing.');
  csv=parseCSV(text);const guessed=guessMapping(csv.headers);
  for(const field of Object.keys(guessed)){
   const label=document.createElement('label');label.textContent=field==='id'?'Champion instance ID (optional)':field;
   const select=document.createElement('select');select.dataset.field=field;select.setAttribute('aria-label','Map '+field);
   const absent=document.createElement('option');absent.value='-1';absent.textContent='Not mapped';select.append(absent);
   csv.headers.forEach((h,i)=>{const option=document.createElement('option');option.value=i;option.textContent=h;select.append(option);});
   select.value=guessed[field];select.onchange=invalidate;label.append(select);$('mapping').append(label);
  }
  $('importStatus').textContent=csv.rows.length+' rows read. Check the column mapping, then preview.';
 }catch(e){$('importStatus').textContent=e.message;}
};
$('previewImport').onclick=()=>{
 invalidate();
 try{
  if(!csv)throw Error('Choose a CSV first.');
  const mapping=Object.fromEntries([...$('mapping').querySelectorAll('select')].map(s=>[s.dataset.field,Number(s.value)]));
  preview=validateRoster(csv,mapping);$('previewCount').textContent=preview.length+' valid champions. First five: '+preview.slice(0,5).map(c=>c.name).join(', ')+'. Confirming replaces the device roster ('+roster.length+' champions).';
  $('confirmImport').disabled=false;$('importStatus').textContent='Validation passed. Existing notes and cloud records are preserved.';
 }catch(e){$('importStatus').textContent=e.message;}
};
$('confirmImport').onclick=()=>{
 if(!preview)return;
 try{localStorage.setItem(key,JSON.stringify(preview));roster=preview;invalidate();render();$('importStatus').textContent='Roster saved on this device. Cloud roster sync is not included.';}catch{$('importStatus').textContent='Device storage is unavailable or full. Existing roster was retained.';}
};
$('backupRoster').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(roster,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='raid-roster-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
render();
