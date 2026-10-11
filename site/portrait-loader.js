/* Optional portrait enhancement. Never participates in roster or cloud initialization. */
(()=>{
 'use strict';
 const archive='./portraits/raid_companion_portraits.zip';
 const urls=new Map();
 const slug=name=>name.toLowerCase().normalize('NFKD').replace(/\s*\(copy\s+\d+\)\s*$/i,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 function apply(){
  document.querySelectorAll('#championRoster .roster-card').forEach(card=>{
   const title=card.querySelector('h3')?.textContent||'';
   const key=slug(title);
   const url=key==='antigone-man-slayer'?'./portraits/antigone-man-slayer.webp':urls.get(key);
   const portrait=card.querySelector('.hh-portrait');
   if(!url||!portrait)return;
   let img=portrait.querySelector('img');
   if(!img){img=document.createElement('img');img.alt='';img.loading='lazy';portrait.prepend(img);}
   if(img.src!==url)img.src=url;
   img.style.display='block';
   portrait.classList.remove('portrait-missing');
   portrait.querySelectorAll('span:not(.hh-portrait-level)').forEach(span=>span.remove());
  });
 }
 function loadLibrary(){return new Promise((resolve,reject)=>{
  if(window.JSZip)return resolve(window.JSZip);
  const tag=document.createElement('script');tag.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';tag.onload=()=>window.JSZip?resolve(window.JSZip):reject(Error('ZIP library unavailable'));tag.onerror=()=>reject(Error('ZIP library blocked'));document.head.append(tag);
 });}
 async function start(){
  try{
   const [JSZip,response]=await Promise.all([loadLibrary(),fetch(archive)]);
   if(!response.ok)throw Error('Portrait archive unavailable');
   const zip=await JSZip.loadAsync(await response.arrayBuffer());
   const entries=Object.values(zip.files).filter(f=>!f.dir&&/\.webp$/i.test(f.name));
   await Promise.all(entries.map(async f=>{
    const key=f.name.split('/').pop().replace(/\.webp$/i,'');
    const bytes=await f.async('uint8array');
    urls.set(key,URL.createObjectURL(new Blob([bytes],{type:'image/webp'})));
   }));
   apply();
   const roster=document.getElementById('championRoster');
   if(roster){let pending=false;new MutationObserver(()=>{
    if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;apply();});
   }).observe(roster,{childList:true});}
  }catch(err){console.warn('Optional champion portraits unavailable:',err);}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
