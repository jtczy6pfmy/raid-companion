// Deterministic optimisation of user-supplied artifact bonuses. No game writes.
export const STAT_KEYS=['hp','atk','def','spd','critRate','critDamage','res','acc'];
export const SLOTS=['weapon','helmet','shield','gloves','chest','boots'];
const PERCENT_KEYS=['hp','atk','def','spd'];
function values(raw,keys,label){
 if(raw===undefined)return {};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error(label+' must be a stat object.');
 const result={};
 for(const [key,value] of Object.entries(raw)){
  if(!keys.includes(key)||typeof value!=='number'||!Number.isFinite(value)||value<0||value>10000000)throw Error('Invalid '+label+' stat: '+key);
  result[key]=value;
 }
 return result;
}
export function validateInventory(data){
 if(!data||data.version!==1||!Array.isArray(data.artifacts)||data.artifacts.length>5000)throw Error('Use a version 1 artifact inventory with at most 5,000 artifacts.');
 const ids=new Set();
 const artifacts=data.artifacts.map((a,i)=>{
  if(!a||typeof a.id!=='string'||!a.id.trim()||ids.has(a.id)||!SLOTS.includes(a.slot))throw Error('Invalid or duplicate artifact at row '+(i+1));
  ids.add(a.id);
  if(a.equippedTo!=null&&typeof a.equippedTo!=='string')throw Error('equippedTo must be a champion copy ID.');
  return {id:a.id,name:typeof a.name==='string'?a.name.slice(0,120):a.id,slot:a.slot,set:typeof a.set==='string'?a.set.slice(0,80):'',locked:a.locked===true,equippedTo:a.equippedTo||null,flat:values(a.flat,STAT_KEYS,'flat'),percent:values(a.percent,PERCENT_KEYS,'percent')};
 });
 if(data.sets!==undefined&&(!Array.isArray(data.sets)||data.sets.length>1000))throw Error('Set definitions must be an array of at most 1,000 entries.');
 const setIds=new Set();
 const sets=(data.sets||[]).map(s=>{
  if(!s||typeof s.name!=='string'||!s.name||setIds.has(s.name)||!Number.isInteger(s.pieces)||s.pieces<1||s.pieces>6)throw Error('Invalid or duplicate set definition.');
  setIds.add(s.name);return {name:s.name,pieces:s.pieces,flat:values(s.flat,STAT_KEYS,'set flat'),percent:values(s.percent,PERCENT_KEYS,'set percent')};
 });
 return {version:1,artifacts,sets};
}
export function calculateBuild(base,artifacts,sets=[]){
 const stats={...base},flat={},percent={},counts={};
 function add(source){for(const k of STAT_KEYS)flat[k]=(flat[k]||0)+(source.flat?.[k]||0);for(const k of PERCENT_KEYS)percent[k]=(percent[k]||0)+(source.percent?.[k]||0)}
 for(const artifact of artifacts){add(artifact);if(artifact.set)counts[artifact.set]=(counts[artifact.set]||0)+1}
 const activeSets=[];
 for(const set of sets){const n=Math.floor((counts[set.name]||0)/set.pieces);if(n){activeSets.push({name:set.name,count:n});for(let i=0;i<n;i++)add(set)}}
 for(const k of STAT_KEYS){if(!Number.isFinite(base[k])||base[k]<0)throw Error('Enter every unequipped stat before optimising.');stats[k]=Math.round((base[k]*(1+(percent[k]||0)/100)+(flat[k]||0))*100)/100}
 return {stats,activeSets};
}
export function optimiseArtifacts({inventory,base,targets={},weights={},championId='',allowEquipped=false,maxCombinations=200000,limit=10}){
 const missing=[],groups=SLOTS.map(slot=>{
  const group=inventory.artifacts.filter(a=>a.slot===slot&&!a.locked&&(allowEquipped||!a.equippedTo||a.equippedTo===championId));
  if(!group.length)missing.push(slot);return group;
 });
 if(missing.length)return {results:[],examined:0,total:0,truncated:false,missing};
 calculateBuild(base,[],[]);
 const total=groups.reduce((n,g)=>n*g.length,1);if(total>maxCombinations)return {results:[],examined:0,total,truncated:true,missing:[]};
 let examined=0;const results=[],path=[];
 function visit(slot){
  if(slot<groups.length){for(const artifact of groups[slot]){path.push(artifact);visit(slot+1);path.pop()}return}
  examined++;
  const build=calculateBuild(base,path,inventory.sets);
  const gaps=STAT_KEYS.filter(k=>Number.isFinite(targets[k])&&build.stats[k]<targets[k]).map(k=>({stat:k,gap:targets[k]-build.stats[k]}));
  const score=STAT_KEYS.reduce((n,k)=>n+build.stats[k]*(weights[k]||0),0);
  const candidate={artifactIds:path.map(a=>a.id),...build,gaps,score,meetsTargets:gaps.length===0};
  results.push(candidate);results.sort((a,b)=>Number(b.meetsTargets)-Number(a.meetsTargets)||a.gaps.reduce((n,g)=>n+g.gap/Math.max(1,targets[g.stat]),0)-b.gaps.reduce((n,g)=>n+g.gap/Math.max(1,targets[g.stat]),0)||b.score-a.score||a.artifactIds.join('|').localeCompare(b.artifactIds.join('|')));if(results.length>limit)results.pop();
 }
 visit(0);return {results,examined,total,truncated:false,missing};
}
