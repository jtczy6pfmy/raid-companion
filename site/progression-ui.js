import {planProgression} from './progression-engine.js?v=20261012-3';
const $=id=>document.getElementById(id);
const section=$('leveling');
const panel=document.createElement('div');panel.className='panel';panel.style.marginTop='18px';
const heading=document.createElement('h3');heading.textContent='Complete production plan';
const label=document.createElement('label');label.htmlFor='targetAscension';label.textContent='Target ascension';
const ascension=document.createElement('select');ascension.id='targetAscension';
const result=document.createElement('div');result.setAttribute('aria-live','polite');
const message=document.createElement('p');message.className='muted';
panel.append(heading,label,ascension,result,message);section.append(panel);
let lastId=null;
let savedAscension=null;try{savedAscension=JSON.parse(localStorage.getItem('raid-ipad-leveling-v1')||'null')?.targetAscension??null}catch{}
function rows(){try{const data=JSON.parse(localStorage.getItem('raid-roster-v1')||'[]');return Array.isArray(data)?data:[]}catch{return []}}
function render(){
 const champion=rows().find(r=>String(r.id)===$('levelChampion').value);
 result.replaceChildren();if(!champion){message.textContent='Choose a saved champion to calculate the complete path.';return}
 const targetRank=Number($('targetRank').value),currentAscension=Number(champion.ascension)||0;
 const previous=Number(ascension.value);ascension.replaceChildren();
 for(let n=currentAscension;n<=targetRank;n++){const o=document.createElement('option');o.value=n;o.textContent=n+' stars';ascension.append(o)}
 ascension.value=String(champion.id===lastId?Math.max(currentAscension,Math.min(targetRank,previous)):savedAscension!==null?Math.max(currentAscension,Math.min(targetRank,Number(savedAscension))):targetRank);lastId=champion.id;savedAscension=null;
 try{
  const plan=planProgression(champion,{targetRank,targetLevel:Number($('levelTarget').value),targetAscension:Number(ascension.value)});
  const list=document.createElement('ol');
  for(const step of plan.steps){const li=document.createElement('li');li.style.padding='8px 0';li.textContent=step.type==='level'?'Level '+champion.name+' at '+step.rank+'★ from '+step.from+' to '+step.to+'.':step.type==='promote'?'Promote to '+step.toRank+'★ using '+step.foodCount+' separate '+step.foodRank+'★ champions or chickens. The champion resets to level 1.':'Ascend from '+step.from+' to '+step.to+' stars after reaching the required rank. Farm affinity potions; verify the rarity-specific quantities in RAID.';list.append(li)}
  if(!plan.steps.length){const li=document.createElement('li');li.textContent='All selected progression targets are reached.';list.append(li)}
  result.append(list);
  if(Object.keys(plan.foodByRank).length){
   const title=document.createElement('h4');title.textContent='Food production from fresh 1★ champions';result.append(title);
   const tree=document.createElement('ul');
   for(const [rank,count] of Object.entries(plan.foodByRank).sort((a,b)=>b[0]-a[0])){const li=document.createElement('li');li.textContent=count+' × '+rank+'★ '+(Number(rank)===1?'starting champions (includes promoted bases)':'prepared food champions');tree.append(li)}
   result.append(tree);
   message.textContent='These are successive stages of the same production tree; do not add the rows together. Existing food and chickens reduce this fresh-start total. Your manual material counts apply only to the next rank-up. Final food stays at level 1; only champions being promoted need their rank’s maximum level.';
  }else message.textContent='No food is required for this target. Update progress in My Champions after completing each step in RAID.';
 }catch(error){message.textContent=error.message}
 window.dispatchEvent(new Event('raid-ascension-change'));
}
for(const id of ['levelChampion','targetRank','levelTarget','currentRank','currentLevel'])$(id).addEventListener('input',render);
$('levelChampion').addEventListener('change',render);$('targetRank').addEventListener('change',render);ascension.addEventListener('change',render);
window.addEventListener('raid-roster-change',render);render();

$('savePlan').addEventListener('click',()=>{try{const saved=JSON.parse(localStorage.getItem('raid-ipad-leveling-v1')||'{}');saved.targetAscension=Number(ascension.value);localStorage.setItem('raid-ipad-leveling-v1',JSON.stringify(saved))}catch{$('planStatus').textContent='Plan could not be saved. Export your data before closing.'}});
