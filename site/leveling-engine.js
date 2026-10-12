import {XP_PER_LEVEL} from './leveling-xp-data.js';
import {planProgression,levelCap} from './progression-engine.js';

const integer=(value,label,min=0,max=100000)=>{
 const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw new RangeError(label+' is invalid.');return n;
};
export function xpBetween(rank,from,to,xpIntoLevel=0){
 levelCap(rank);integer(from,'Current level',1,rank*10);integer(to,'Target level',from,rank*10);
 const costs=XP_PER_LEVEL[rank],progress=integer(xpIntoLevel,'Current XP',0,1000000000);
 if(from===rank*10&&progress!==0||from<rank*10&&progress>=costs[from-1])throw new RangeError('Current XP must be below the XP needed for the next level.');
 return from===to?0:costs.slice(from-1,to-1).reduce((a,b)=>a+b,0)-progress;
}
export function campaignEstimate(xp,{xpPerChampion=8652,energyPerRun=8,secondsPerRun=20,energyBudget=0}={}){
 if(!Number.isFinite(xp)||xp<0||!Number.isFinite(xpPerChampion)||xpPerChampion<=0||!Number.isFinite(energyPerRun)||energyPerRun<=0||!Number.isFinite(secondsPerRun)||secondsPerRun<0||!Number.isFinite(energyBudget)||energyBudget<0)throw new RangeError('Enter valid campaign XP, energy and time values.');
 const runs=Math.ceil(xp/xpPerChampion),affordableRuns=Math.min(runs,Math.floor(energyBudget/energyPerRun));
 return {xp,runs,energy:runs*energyPerRun,seconds:runs*secondsPerRun,affordableRuns,energyShortfall:Math.max(0,runs*energyPerRun-energyBudget)};
}
export function foodCandidates(rows,{selectedId,reservedNames=[],teamIds=[],reference={}}={}){
 const reserved=new Set(reservedNames.map(n=>String(n).toLowerCase())),teams=new Set(teamIds);
 const rarity=r=>String(r.rarity||r.import_data?.values?.Rarity||reference[String(r.name).toLowerCase()]?.rarity||'').toLowerCase();
 const score=r=>{const x=r.championScore??r.ratingScore??r.rating;return x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):Infinity;};
 return rows.filter(r=>String(r.id)!==String(selectedId)&&!r.starter&&!r.locked&&!r.protected&&!r.isFavorite&&!r.inFusion&&!r.fusion&&!r.factionGuardian&&!teams.has(r.id)&&!teams.has(r.cloudId)&&!reserved.has(String(r.name).toLowerCase())&&['common','uncommon'].includes(rarity(r))&&Number.isInteger(r.rank)&&r.rank>=1&&r.rank<6&&Number.isInteger(r.level)&&r.level>=1&&r.level<=r.rank*10)
 .map(r=>({...r,foodRarity:rarity(r)}))
 .sort((a,b)=>(a.foodRarity==='common'?0:1)-(b.foodRarity==='common'?0:1)||a.rank-b.rank||score(a)-score(b)||a.level-b.level||String(a.name).localeCompare(String(b.name))||String(a.id).localeCompare(String(b.id)));
}
// Counts include both promotion bases and sacrifices. Chickens can replace
// sacrifices, never the champion being promoted. A copy is allocated once.
export function productionPlan(champion,target,{food=[],chickens={},startingRank=1}={}){
 const progression=planProgression(champion,target);integer(startingRank,'Starting food rank',1,5);
 const ids=new Set();for(const c of food){if(ids.has(String(c.id)))throw new RangeError('A food copy was counted twice.');ids.add(String(c.id));levelCap(c.rank);integer(c.level,'Food level',1,c.rank*10);}
 const direct={},build={},allocation={};for(let r=champion.rank;r<target.targetRank;r++)direct[r]=r;
 const minimum=Math.min(startingRank,champion.rank,...food.filter(c=>c.rank<target.targetRank).map(c=>c.rank));
 for(let r=target.targetRank-1;r>=minimum;r--){
  const bases=build[r+1]||0,sacrifices=(direct[r]||0)+bases*r;
  const chickenCount=Math.min(integer(chickens[r]||0,'Chicken count'),sacrifices);
  const copies=food.filter(c=>c.rank===r).sort((a,b)=>b.level-a.level||String(a.id).localeCompare(String(b.id)));
  const usedBases=copies.slice(0,bases),usedSacrifices=copies.slice(usedBases.length,usedBases.length+sacrifices-chickenCount);
  const needed=bases+sacrifices-chickenCount-usedBases.length-usedSacrifices.length;
  build[r]=needed;
  allocation[r]={rank:r,bases,sacrifices,directCount:direct[r]||0,directChickens:Math.min(chickenCount,direct[r]||0),chickensUsed:chickenCount,usedBases,usedSacrifices,needed};
 }
 const steps=[];let foodXp=0;
 for(let r=minimum;r<target.targetRank-1;r++){
  const output=build[r+1]||0;if(!output)continue;
  const a=allocation[r],generatedBases=output-a.usedBases.length;
  const jobs=[...a.usedBases.map(c=>({id:c.id,name:c.name,rank:r,from:c.level,to:r*10,xp:xpBetween(r,c.level,r*10)}))];
  if(generatedBases)jobs.push({name:'New '+r+'★ food',count:generatedBases,rank:r,from:1,to:r*10,xp:xpBetween(r,1,r*10)});
  const xp=jobs.reduce((n,j)=>n+j.xp*(j.count||1),0);foodXp+=xp;
  const productionChickens=a.chickensUsed-a.directChickens;
  const existingSacrifices=a.usedSacrifices.slice(Math.max(0,a.directCount-a.directChickens));
  steps.push({fromRank:r,toRank:r+1,outputCount:output,baseCount:output,sacrificeCount:output*r,chickensUsed:productionChickens,existingSacrifices,jobs,xp});
 }
 const mainJobs=progression.steps.filter(s=>s.type==='level').map((s,i)=>({...s,xp:xpBetween(s.rank,s.from,s.to,i===0&&s.rank===champion.rank?Number(target.xpIntoLevel||0):0)}));
 return {...progression,championSteps:progression.steps,startingRank:minimum,allocation,steps,mainJobs,foodXp,mainXp:mainJobs.reduce((n,j)=>n+j.xp,0),acquireCount:build[minimum]||0,selectedCount:food.length,usedCount:Object.values(allocation).reduce((n,a)=>n+a.usedBases.length+a.usedSacrifices.length,0)};
}
export function foodRunEstimate(plan,settings,slots=3){
 integer(slots,'Food slots',1,4);campaignEstimate(0,settings);let runs=0;
 for(const step of plan.steps){
  // Longest jobs first, so already-leveled bases can share a shorter batch.
  const jobs=step.jobs.flatMap(j=>Array.from({length:j.count||1},()=>j.xp)).sort((a,b)=>b-a);
  for(let i=0;i<jobs.length;i+=slots)runs+=campaignEstimate(jobs[i],settings).runs;
 }
 return {runs,energy:runs*settings.energyPerRun,seconds:runs*settings.secondsPerRun};
}
