/* Optional portrait enhancement. Never participates in roster or cloud initialization. */
(()=>{
 'use strict';
 const urls=new Map();
 const antigoneImage='./portraits/93F56C1E-CBE3-4727-9ED4-05207426C948.png';
 const slug=name=>name.toLowerCase().normalize('NFKD').replace(/\s*\(copy\s+\d+\)\s*$/i,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const aliases={'cheshire-cat':'cheshire','dorothy-gale':'dorothy','vallaryn-the-equalizer':'vallaryn','vallyarn':'vallaryn','aox-the-rememberer':'aox','yaga-the-insatiable':'yaga'};
 const portraitKey=name=>{const key=slug(String(name||''));return aliases[key]||key};
 window.raidPortraitUrl=name=>{const key=portraitKey(name);return key.startsWith('antigone')?antigoneImage:urls.get(key)||null};
 function apply(){
  document.querySelectorAll('#championRoster .roster-card').forEach(card=>{
   const title=card.querySelector('h3')?.textContent||'';
   const key=portraitKey(title);
   const url=key.startsWith('antigone')?'./portraits/93F56C1E-CBE3-4727-9ED4-05207426C948.png':urls.get(key);
   const portrait=card.querySelector('.hh-portrait');
   if(!url||!portrait)return;
   let img=portrait.querySelector('img');
   if(img && img.dataset.archivePortrait!=='true'){img.remove();img=null;}
   if(!img){img=document.createElement('img');img.alt='';img.loading='lazy';img.dataset.archivePortrait='true';portrait.prepend(img);}
   img.onerror=null;
   if(img.src!==url)img.src=url;
   img.style.display='block';
   portrait.classList.remove('portrait-missing');
   portrait.querySelectorAll('span:not(.hh-portrait-level)').forEach(span=>span.remove());
  });
 }
 async function start(){
  try{
   const names=["misericord", "lifetaker", "aristocrat", "heiress", "tomoe", "redeemer", "slither", "incubus", "dhampir", "commander", "pit-fighter", "warmaiden", "frostskin", "high-khatun", "gator", "yaga", "pit-cur", "diabolist", "swordsman", "valerie", "galek", "fionn", "stitched-beast", "vildrax", "oldbeard", "dorothy", "brute", "kael", "cait", "jaeger", "aox", "hound-spawn", "vilespawn", "templar", "rocktooth", "athel", "warchanter", "skathix", "outlaw-monk", "vallaryn", "stalwart", "skullsquire", "dervish", "jizoh", "antigone", "tracker", "militia", "hardscale", "sergeant", "justiciar", "cheshire", "satyr", "panthera", "maiden"];
   for(const key of names)urls.set(key,'./portraits/'+key+'.webp');
   function applyFusion(){
    document.querySelectorAll('#fusionTrackerList img[data-fusion-champion]').forEach(img=>{
     const url=window.raidPortraitUrl(img.dataset.fusionChampion);
     if(url&&img.dataset.portraitResolved!==url){img.dataset.portraitResolved=url;img.onerror=()=>{img.style.display='none'};img.src=url;img.style.display='block';}
    });
   }
   function applyFood(){
    const rosterImages=new Map();
    document.querySelectorAll('#championRoster .roster-card').forEach(card=>{
     const key=slug(card.querySelector('h3')?.textContent||'');
     const rosterImg=card.querySelector('.hh-portrait img');
     if(key&&rosterImg?.getAttribute('src')&&!rosterImages.has(key))rosterImages.set(key,rosterImg.src);
    });
    document.querySelectorAll('#foodAdvice img[data-food-champion]').forEach(img=>{
     const key=slug(img.dataset.foodChampion||'');
     const url=rosterImages.get(key)||window.raidPortraitUrl(img.dataset.foodChampion);
     if(url&&img.dataset.portraitResolved!==url){img.dataset.portraitResolved=url;img.src=url;}
    });
   }
   function applySelected(){const img=document.getElementById('levelSelectedImage'),name=document.getElementById('levelSelectedName')?.textContent;const url=window.raidPortraitUrl(name);if(img&&url&&img.getAttribute('src')!==url)img.src=url}
   apply();applyFusion();applyFood();applySelected();
   const selected=document.getElementById('levelSelectedName');if(selected)new MutationObserver(applySelected).observe(selected,{childList:true,subtree:true});
   const foodBox=document.getElementById('foodAdvice');
   if(foodBox){let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;applyFood()})}).observe(foodBox,{childList:true,subtree:true});}
   const fusion=document.getElementById('fusionTrackerList');
   if(fusion){let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;applyFusion()})}).observe(fusion,{childList:true,subtree:true});}
   const roster=document.getElementById('championRoster');
   if(roster){let pending=false;new MutationObserver(()=>{
    if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;apply();});
   applyFood();}).observe(roster,{childList:true,subtree:true});}
  }catch(err){console.warn('Optional champion portraits unavailable:',err);}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
