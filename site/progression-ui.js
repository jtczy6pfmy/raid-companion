import {XP_PER_LEVEL} from './leveling-xp-data.js';
import {productionPlan,foodCandidates,campaignEstimate,foodRunEstimate} from './leveling-engine.js?v=20261012-final';
const $=id=>document.getElementById(id),key='raid-leveling-plans-v2';
const read=(name,fallback)=>{try{return JSON.parse(localStorage.getItem(name)||'null')??fallback}catch{return fallback}};
let store=read(key,{version:2,plans:{},chickens:{},campaign:{}});
if(store.version!==2||!store.plans||typeof store.plans!=='object')store={version:2,plans:{},chickens:{},campaign:{}};
let reference={},selectedId=null,pending=false,restoring=false,active=null,candidates=[],lastPlan=null;
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e};
const section=$('leveling'),panel=node('div',null,'panel');panel.id='preciseLevelingPlan';
panel.append(node('div','YOUR ROSTER → YOUR TARGET','eyebrow'),node('h3','Exact leveling roadmap'));
const ascWrap=node('div'),ascLabel=node('label','Optional ascension target');ascLabel.htmlFor='targetAscension';
const ascension=node('select');ascension.id='targetAscension';ascWrap.append(ascLabel,ascension);
const grid=node('div',null,'grid');
function field(id,label,value,min=0,max=100000,step=1){const wrap=node('div'),lab=node('label',label),input=node('input');lab.htmlFor=id;input.id=id;input.type='number';input.min=min;input.max=max;input.step=step;input.value=value;input.style.minHeight='48px';wrap.append(lab,input);return {wrap,input};}
const startWrap=node('div'),startLabel=node('label','When more food is needed, start from');startLabel.htmlFor='foodStartingRank';
const starting=node('select');starting.id='foodStartingRank';for(const r of [1,2]){const o=node('option',r+'★ level 1 champions');o.value=r;starting.append(o)}startWrap.append(startLabel,starting);
const currentXp=field('levelXpProgress','XP already earned in the current level',0,0,1000000);
grid.append(ascWrap,startWrap,currentXp.wrap);panel.append(grid);
const summary=node('p',null,'muted');summary.id='precisePlanSummary';summary.setAttribute('aria-live','polite');panel.append(summary);
const selection=node('details');selection.open=true;selection.append(node('summary','Choose food from My Champions'));
selection.append(node('p','Common champions first, then Uncommon; lowest rank first within each rarity. Saved scores only break ties. Locked, favorite, high-rarity, team, guardian and tracked-fusion copies are excluded.','muted'));
const suggest=node('button','Use lowest-value food first','action');suggest.type='button';suggest.id='suggestLevelFood';
const clear=node('button','Clear food selection','roster-secondary');clear.type='button';clear.style.marginLeft='8px';
selection.append(suggest,clear);const choiceStatus=node('p',null,'muted'),foodList=node('div');foodList.id='levelFoodChoices';selection.append(choiceStatus,foodList);panel.append(selection);
const stock=node('details');stock.append(node('summary','Chickens available by rank'));
stock.append(node('p','Counts are planning supplies. They are not automatically spent or deducted. Chickens replace sacrifices; they cannot become the champion being promoted.','muted'));
const stockGrid=node('div',null,'grid'),chickenFields={};for(let r=1;r<=5;r++){const f=field('levelChicken'+r,r+'★ chickens',store.chickens?.[r]||0);chickenFields[r]=f.input;stockGrid.append(f.wrap)}stock.append(stockGrid);panel.append(stock);
const roadmap=node('div');roadmap.id='preciseRoadmap';roadmap.setAttribute('aria-live','polite');panel.append(roadmap);
const estimates=node('details');estimates.open=true;estimates.append(node('summary','XP, campaign runs, energy and time'));
const profileWrap=node('div'),profileLabel=node('label','Campaign XP preset');profileLabel.htmlFor='levelCampaign';const profile=node('select');profile.id='levelCampaign';
for(const [value,label] of [['brutal3','Brutal 12-3 · 4,326 base XP/champion · 8 energy'],['brutal6','Brutal 12-6 · 4,400 base XP/champion · 8 energy'],['custom','Custom / measured battle rewards']]){const o=node('option',label);o.value=value;profile.append(o)}profile.value=store.campaign?.profile||'brutal3';profileWrap.append(profileLabel,profile);
const boostLabel=node('label','Double XP active'),boost=node('input');boost.type='checkbox';boost.style.cssText='width:22px;min-height:22px;margin-right:10px';boost.checked=store.campaign?.boost??true;boostLabel.prepend(boost);
const measured=field('levelMeasuredXp','Measured XP per champion per run (all bonuses included)',store.campaign?.xpPerChampion||8652,1,1000000);
const energy=field('levelRunEnergy','Energy per run',store.campaign?.energyPerRun||8,1,100,1);
const seconds=field('levelRunSeconds','Seconds per run, including loading',store.campaign?.secondsPerRun??20,0,3600);
const slots=field('levelFoodSlots','Food champions trained together',store.campaign?.slots||3,1,4);
const budget=field('levelEnergyBudget','Energy available for this plan',store.campaign?.energyBudget||0,0,1000000);
const estimateGrid=node('div',null,'grid');estimateGrid.append(profileWrap,measured.wrap,energy.wrap,seconds.wrap,slots.wrap,budget.wrap);estimates.append(boostLabel,estimateGrid);
const estimateResult=node('div');estimateResult.id='levelCampaignEstimate';estimateResult.setAttribute('aria-live','polite');estimates.append(estimateResult);
estimates.append(node('p','Presets assume four champions in battle. The farmer’s share is not redistributed. Extra XP bonuses, different team sizes, losses, brews, and partial XP progress change the result; use measured rewards to match your account. Food batches and the main champion are estimated separately, with no shared runs assumed. Food-copy XP starts at the beginning of each saved level; partial XP inside that level is not imported.','muted'));
const sources=node('p',null,'muted');for(const [label,url] of [['XP table','https://raid.guide/en/guides/how-maximize-speed-building-champion-level-60/'],['Campaign XP reference','https://ayumilove.net/raid-shadow-legends-champion-leveling-guide/']]){const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener';a.style.color='#00DFF5';sources.append(a,document.createTextNode(' · '))}estimates.append(sources);panel.append(estimates);
const actions=node('div',null,'roster-buttons'),save=node('button','Save this champion’s plan','action'),update=node('button','Update progress in My Champions','roster-secondary');save.type=update.type='button';actions.append(save,update);panel.append(actions);
const status=node('p',null,'muted');status.id='precisePlanStatus';status.setAttribute('role','status');panel.append(status);
const foodGuide=$('foodAdvice')?.closest('.panel');section.insertBefore(panel,foodGuide||null);
// Retain legacy IDs for existing dashboard hooks, but present one clear roadmap.
const oldVisual=$('visualCurrentRank')?.closest('.panel');if(oldVisual)oldVisual.hidden=true;
const oldRoadmap=$('levelRoadmap')?.closest('details');if(oldRoadmap)oldRoadmap.hidden=true;
const oldTools=$('savePlan')?.closest('details');if(oldTools)oldTools.hidden=true;
const oldFoodInput=$('foodOwned')?.parentElement;if(oldFoodInput)oldFoodInput.hidden=true;
if(foodGuide)foodGuide.hidden=true;
function roster(){const r=read('raid-roster-v1',[]);return Array.isArray(r)?r:[]}
function protections(){const f=read('raid-ipad-fusions-v1',[]),t=read('raid-companion-tools-v1',[]);return {reservedNames:(Array.isArray(f)?f:[]).map(x=>x.name),teamIds:(Array.isArray(t)?t:[]).filter(x=>x.kind==='team'&&!x.deleted).flatMap(x=>x.payload?.members||[]).filter(Boolean).flatMap(x=>typeof x==='string'?[x]:[x.id,x.localId])};}
function persist(){try{localStorage.setItem(key,JSON.stringify(store));status.textContent='Plan saved on this device. No champions or chickens have been consumed.';return true}catch{status.textContent='Plan could not be saved. Export your data before closing.';return false}}
function schedule(){if(pending||restoring)return;pending=true;queueMicrotask(()=>{pending=false;render()})}
function render(){
 const rows=roster(),champion=rows.find(x=>String(x.id)===$('levelChampion').value);if(!champion){summary.textContent='Choose a saved champion to build your roadmap.';roadmap.replaceChildren();return}
 const changed=selectedId!==champion.id;restoring=true;
 if(changed){selectedId=champion.id;const old=read('raid-ipad-leveling-v1',{}),legacy=String(old.levelChampion)===String(champion.id)?old:{};active=store.plans[champion.id]||{targetRank:Number(legacy.targetRank)||Number($('targetRank').value)||6,targetLevel:Number(legacy.levelTarget)||Number($('levelTarget').value)||60,targetAscension:legacy.targetAscension??Number(champion.ascension||0),startingRank:1,xpIntoLevel:0,foodIds:[]};
  $('targetRank').value=String(Math.max(champion.rank,Math.min(6,active.targetRank)));$('levelTarget').value=String(Math.max(Number($('targetRank').value)===champion.rank?champion.level:1,Math.min(Number($('targetRank').value)*10,active.targetLevel)));
  starting.value=String(active.startingRank||1);currentXp.input.value=String(active.xpIntoLevel||0);
 }
 if(active.anchorRank!==undefined&&(active.anchorRank!==champion.rank||active.anchorLevel!==champion.level))currentXp.input.value='0';
 currentXp.input.disabled=champion.level===champion.rank*10;if(currentXp.input.disabled)currentXp.input.value='0';currentXp.input.max=String(champion.level<champion.rank*10?XP_PER_LEVEL[champion.rank][champion.level-1]-1:0);
 if(champion.rank===1)starting.value='1';
 const rank=Number($('targetRank').value),currentAsc=Number(champion.ascension)||0,prev=changed?active.targetAscension:Number(ascension.value);
 ascension.replaceChildren();for(let n=currentAsc;n<=rank;n++){const o=node('option',n+'★');o.value=n;ascension.append(o)}ascension.value=String(Math.max(currentAsc,Math.min(rank,Number(prev))));
 candidates=foodCandidates(rows,{selectedId:champion.id,reference,...protections()}).filter(c=>c.rank<rank&&c.rank>=Number(starting.value)).map(c=>({...c,copyNumber:rows.filter(r=>String(r.name).toLowerCase()===String(c.name).toLowerCase()).findIndex(r=>r.id===c.id)+1}));
 const eligible=new Set(candidates.map(c=>String(c.id)));active.foodIds=(active.foodIds||[]).filter(id=>eligible.has(String(id)));
 const chosen=new Set(active.foodIds.map(String));const food=candidates.filter(c=>chosen.has(String(c.id)));
 active={...active,anchorRank:champion.rank,anchorLevel:champion.level,targetRank:rank,targetLevel:Number($('levelTarget').value),targetAscension:Number(ascension.value),startingRank:Number(starting.value),xpIntoLevel:Number(currentXp.input.value),foodIds:food.map(c=>c.id)};
 store.plans[champion.id]=active;store.chickens=Object.fromEntries(Object.entries(chickenFields).map(([r,f])=>[r,Number(f.value)]));
 foodList.replaceChildren();candidates.forEach((c,i)=>{const row=node('label');row.style.cssText='display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #34515B';const check=node('input');check.type='checkbox';check.checked=chosen.has(String(c.id));check.style.cssText='width:22px;min-height:22px;flex:none';check.dataset.foodCopy=c.id;const text=node('span',c.name+' · copy '+c.copyNumber+' · '+c.foodRarity+' · '+c.rank+'★ level '+c.level);row.append(check,text);check.addEventListener('change',()=>{active.foodIds=check.checked?[...active.foodIds,c.id]:active.foodIds.filter(id=>id!==c.id);schedule()});foodList.append(row)});
 choiceStatus.textContent=candidates.length?food.length+' copies selected. Only copies needed by the recipe are allocated; surplus stays unused. Review every chosen copy before sacrificing in RAID.':'No confirmed Common or Uncommon food copies are available. Check imported rarity and saved protections in My Champions.';
 roadmap.replaceChildren();estimateResult.replaceChildren();restoring=false;
 try{
 const plan=productionPlan(champion,active,{food,chickens:store.chickens,startingRank:active.startingRank});lastPlan=plan;
 summary.textContent=champion.name+': '+champion.rank+'★ level '+champion.level+' → '+rank+'★ level '+active.targetLevel+'. '+plan.usedCount+' saved food copies allocated.';
 const list=node('ol');list.style.paddingLeft='24px';let index=0;
 const step=(title,detail)=>{const li=node('li');li.style.cssText='padding:12px 0;border-bottom:1px solid #34515B';li.append(node('strong',title),node('p',detail,'muted'));list.append(li);index++};
 if(plan.acquireCount)step('Collect '+plan.acquireCount+' more '+plan.startingRank+'★ level 1 food champions','These are additional copies beyond your selections. '+plan.startingRank+'★ chickens cannot replace the champions that must be leveled and promoted.');
 for(const s of plan.steps){const names=s.jobs.filter(j=>j.id).map(j=>j.name+' (copy '+food.find(c=>c.id===j.id)?.copyNumber+', level '+j.from+')');step('Level '+s.baseCount+' × '+s.fromRank+'★ champions to level '+s.fromRank*10+' → make '+s.outputCount+' × '+s.toRank+'★ food','Promote each using '+s.fromRank+' separate '+s.fromRank+'★ sacrifices: '+s.sacrificeCount+' matching-rank materials total ('+s.chickensUsed+' chickens and '+(s.sacrificeCount-s.chickensUsed)+' champion copies). '+(names.length?'Saved bases: '+names.join(', ')+'. ':'')+'The outputs start at level 1; keep final food at level 1.');}
 const preparation=node('details');preparation.append(node('summary','Actions for the selected roster copies'));for(const a of Object.values(plan.allocation)){for(const c of a.usedBases)preparation.append(node('p',c.name+' (copy '+c.copyNumber+'): '+(c.level<a.rank*10?'level '+c.level+' to '+a.rank*10:'already at level '+a.rank*10)+', then promote '+a.rank+' stars to '+(a.rank+1)+' stars using '+a.rank+' other '+a.rank+'-star materials.'));for(const c of a.usedSacrifices)preparation.append(node('p',c.name+' (copy '+c.copyNumber+'): use as one '+a.rank+'-star sacrifice. It does not need more levels.'));}if(plan.usedCount)roadmap.append(preparation);
 const selectedNames=Object.values(plan.allocation).flatMap(a=>[...a.usedBases,...a.usedSacrifices]).map(c=>c.name+' '+c.rank+'★ (copy '+c.copyNumber+')');
 if(selectedNames.length){const d=node('details');d.append(node('summary','Roster copies used in this plan ('+selectedNames.length+')'),node('p',selectedNames.join(' · '),'muted'));roadmap.append(d)}
 for(const s of plan.championSteps){if(s.type==='level'&&s.to>s.from)step('Level '+champion.name+' at '+s.rank+'★: '+s.from+' → '+s.to,s.from===champion.level&&s.rank===champion.rank?'Continue from your saved roster level.':'After rank-up, the champion starts again at level 1.');else if(s.type==='promote'){const a=plan.allocation[s.foodRank];step('Promote '+champion.name+' '+s.fromRank+'★ → '+s.toRank+'★','Use '+s.foodCount+' separate '+s.foodRank+'★ food champions or matching chickens. '+(a?'For this promotion: '+a.directChickens+' chickens and '+(s.foodCount-a.directChickens)+' food champions. ':'')+'The champion must first reach level '+s.fromRank*10+'.')}else if(s.type==='ascend')step('Ascend '+champion.name+': '+s.from+'★ → '+s.to+'★','Use the affinity and rarity-specific potions shown in RAID. Ascension is separate from food production and campaign XP.');}
 if(!index)step('Target reached','Your saved champion already meets the selected targets.');roadmap.prepend(list);
 const materialNote=node('p',null,'muted');materialNote.textContent='For each production step, the leveled bases and sacrificed materials are separate copies. Supplies already at a required rank are deducted once. Food is ranked up, not fused. Complete these actions in RAID, then update your roster.';roadmap.append(materialNote);
 // Feed the existing next-action display with reviewed materials only.
 $('foodOwned').value=String(food.filter(c=>c.rank===champion.rank).length);$('foodChickens').value=String(store.chickens[champion.rank]||0);
 const next=$('levelNextAction'),detail=$('levelNextDetail');if(next){const shortage=Math.max(0,champion.rank-Number($('foodOwned').value)-Number($('foodChickens').value));next.textContent=champion.rank<rank?(champion.level<champion.rank*10?'Level '+champion.name+' to '+champion.rank*10:shortage?'Prepare '+shortage+' more '+champion.rank+'★ materials':'Ready: promote '+champion.name+' to '+(champion.rank+1)+'★'):champion.level<active.targetLevel?'Level '+champion.name+' to '+active.targetLevel:'Rank and level target reached';detail.textContent=champion.rank<rank?'Follow the exact food-production roadmap below.':'Food is not required for the selected level target.';}
 const preset=profile.value;boost.disabled=preset==='custom';measured.wrap.hidden=preset!=='custom';energy.input.disabled=preset!=='custom';if(preset!=='custom')energy.input.value='8';
 const xp=preset==='custom'?Number(measured.input.value):(preset==='brutal6'?4400:4326)*(boost.checked?2:1);
 const settings={xpPerChampion:xp,energyPerRun:Number(energy.input.value),secondsPerRun:Number(seconds.input.value),energyBudget:Number(budget.input.value)};
 const main=plan.mainJobs.map(j=>campaignEstimate(j.xp,settings));const mainRuns=main.reduce((n,j)=>n+j.runs,0),foodEstimate=foodRunEstimate(plan,settings,Number(slots.input.value));const totalRuns=mainRuns+foodEstimate.runs,totalEnergy=totalRuns*settings.energyPerRun;
 const mainXp=plan.mainXp.toLocaleString(),foodXp=plan.foodXp.toLocaleString();estimateResult.append(node('p','Main champion: '+mainXp+' XP · '+mainRuns.toLocaleString()+' runs · '+(mainRuns*settings.energyPerRun).toLocaleString()+' energy.'),node('p','Food preparation: '+foodXp+' XP across the bases · '+foodEstimate.runs.toLocaleString()+' full-batch runs · '+foodEstimate.energy.toLocaleString()+' energy.'),node('p','Combined separate-session estimate: '+totalRuns.toLocaleString()+' runs · '+totalEnergy.toLocaleString()+' energy · '+Math.ceil(totalRuns*settings.secondsPerRun/60).toLocaleString()+' minutes.'),node('p','Energy budget: '+Math.min(totalRuns,Math.floor(settings.energyBudget/settings.energyPerRun))+' runs affordable · '+Math.max(0,totalEnergy-settings.energyBudget).toLocaleString()+' additional energy needed.','muted'));
 store.campaign={profile:preset,boost:boost.checked,...settings,slots:Number(slots.input.value)};
 persist();window.dispatchEvent(new Event('raid-ascension-change'));
 }catch(error){lastPlan=null;summary.textContent=error.message;status.textContent='Adjust the plan values above to calculate a roadmap.';}
}
for(const id of ['levelChampion','targetRank','levelTarget','currentRank','currentLevel']){const e=$(id);e.addEventListener('input',schedule);e.addEventListener('change',schedule)}
for(const e of [ascension,starting,currentXp.input,profile,boost,measured.input,energy.input,seconds.input,slots.input,budget.input,...Object.values(chickenFields)]){e.addEventListener('input',schedule);e.addEventListener('change',schedule)}
suggest.onclick=()=>{if(!active)return;active.foodIds=[];const c=roster().find(x=>x.id===selectedId);for(const food of candidates){const plan=productionPlan(c,active,{food:candidates.filter(x=>active.foodIds.includes(x.id)),chickens:store.chickens,startingRank:Number(starting.value)});if(plan.acquireCount===0)break;active.foodIds.push(food.id)}schedule()};
clear.onclick=()=>{if(active)active.foodIds=[];schedule()};save.onclick=()=>persist();$('savePlan').addEventListener('click',()=>persist());
update.onclick=()=>{document.querySelector('[data-tab="battles"]')?.click();$('clearFilters')?.click();const search=$('rosterSearch');if(search){search.value=roster().find(x=>x.id===selectedId)?.name||'';search.dispatchEvent(new Event('input'))}};
window.addEventListener('raid-roster-change',schedule);window.addEventListener('raid-plans-change',schedule);window.addEventListener('raid-fusion-change',schedule);
window.addEventListener('raid-leveling-target',event=>{
 const {championId,targetRank,targetLevel}=event.detail||{},c=roster().find(r=>String(r.id)===String(championId));if(!c)return;
 const previous=store.plans[c.id]||{};
 const next={...previous,targetRank:Math.max(c.rank,Number(targetRank)),targetLevel:Number(targetLevel),targetAscension:Math.max(Number(c.ascension)||0,Math.min(Number(targetRank),Number(previous.targetAscension)||0)),startingRank:previous.startingRank||1,foodIds:previous.foodIds||[],xpIntoLevel:previous.xpIntoLevel||0};
 store.plans[c.id]=next;if(selectedId===c.id){active=next;$('targetRank').value=String(next.targetRank);$('levelTarget').value=String(next.targetLevel);ascension.value=String(next.targetAscension);}
 schedule();
});
window.addEventListener('storage',e=>{if(['raid-roster-v1','raid-ipad-fusions-v1','raid-companion-tools-v1'].includes(e.key))schedule()});
window.raidLevelingExport=()=>JSON.parse(JSON.stringify(store));
render();
fetch('./champion-food-reference.json').then(r=>{if(!r.ok)throw Error('No rarity reference');return r.json()}).then(data=>{reference=data.champions||{};schedule()}).catch(()=>{});
