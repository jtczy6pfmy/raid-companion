export const STAT_FIELDS=[['hp','HP','Total HP',19222],['atk','ATK','Total ATK',1971],['def','DEF','Total DEF',1335],['spd','SPD','Total SPD',167],['critRate','C.RATE %','Total C.RATE',71],['critDamage','C.DMG %','Total C.DMG',103],['res','RES','Total RES',87],['acc','ACC','Total ACC',125]];
export function numberOrNull(value){
 if(value===null||value===undefined||String(value).trim()==='')return null;
 const n=Number(String(value).replaceAll(',','').replace(/%$/,''));return Number.isFinite(n)&&n>=0?n:null;
}
export function statsFor(row){
 const snapshot=row?.import_data?.values;
 const baseline=!snapshot&&(row?.starterName==='Cheshire Cat'||row?.name==='Cheshire Cat');
 return Object.fromEntries(STAT_FIELDS.map(([key,,column,value])=>[key,snapshot?numberOrNull(snapshot[column]):baseline?value:null]));
}
export function championRef(row){return row?{id:row.cloudId||row.id,localId:row.id,importKey:row.import_key||null,name:row.name}:null;}
export function resolveChampion(ref,rows){
 if(!ref)return null;
 const exact=rows.find(r=>ref.importKey?r.import_key===ref.importKey:(r.cloudId||r.id)===ref.id||r.id===ref.localId);
 if(exact)return exact;
 const matches=rows.filter(r=>r.name===ref.name);return matches.length===1?matches[0]:null;
}
export function compareStats(left,right){return STAT_FIELDS.map(([key,label])=>({key,label,left:left[key],right:right[key],delta:left[key]===null||right[key]===null?null:right[key]-left[key]}));}
export function targetProgress(stats,targets){
 return STAT_FIELDS.filter(([key])=>numberOrNull(targets[key])!==null).map(([key,label])=>{
  const target=numberOrNull(targets[key]),current=stats[key];return {key,label,target,current,gap:current===null?null:Math.max(0,target-current),met:current!==null&&current>=target};
 });
}
export function filterChampions(rows,{search='',rarity='',affinity='',faction='',rank='',leveling=false,sort='name'}={}){
 const filtered=rows.filter(row=>{
  const values=row.import_data?.values||{};
  return row.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())&&(!rarity||values.Rarity===rarity)&&(!affinity||values.Affinity===affinity)&&(!faction||values.Faction===faction)&&(!rank||row.rank===Number(rank))&&(!leveling||row.level<row.rank*10);
 });
 return filtered.sort((a,b)=>{
  if(sort==='name')return a.name.localeCompare(b.name);
  const av=sort==='rank'?a.rank:sort==='level'?a.level:statsFor(a)[sort];const bv=sort==='rank'?b.rank:sort==='level'?b.level:statsFor(b)[sort];
  return av===null&&bv===null?a.name.localeCompare(b.name):av===null?1:bv===null?-1:bv-av||a.name.localeCompare(b.name);
 });
}
export function runSummary(runs){
 const wins=runs.filter(r=>r.result==='Victory');const times=wins.map(r=>r.seconds).filter(n=>Number.isFinite(n)&&n>0);
 return {count:runs.length,wins:wins.length,winRate:runs.length?100*wins.length/runs.length:null,average:times.length?times.reduce((a,b)=>a+b,0)/times.length:null,best:times.length?Math.min(...times):null,energy:runs.reduce((sum,r)=>sum+(Number(r.energy)||0),0)};
}
export function sessionEstimate(runs,energy,seconds){
 if(!Number.isInteger(runs)||runs<1||runs>10000||!Number.isFinite(energy)||energy<0||!Number.isFinite(seconds)||seconds<=0)throw new Error('Enter valid runs, energy per run and seconds per run.');
 return {energy:runs*energy,seconds:runs*seconds};
}
export function duration(seconds){if(seconds===null||seconds===undefined)return '—';const n=Math.round(seconds);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
