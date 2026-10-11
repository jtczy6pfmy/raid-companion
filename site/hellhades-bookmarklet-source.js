// Run only as a user-initiated Safari bookmarklet on https://raidoptimiser.hellhades.com/champions.
// Selectors are provisional until the authenticated page is inspected.
(async()=> {
 if(location.origin!=='https://raidoptimiser.hellhades.com'||!location.pathname.startsWith('/champions'))return alert('Open your HellHades Champions page first.');
 const token=prompt('Paste your RAID Companion one-time transfer token (15 minutes):');
 if(!token)return;
 const cards=[...document.querySelectorAll('[data-champion-id], .champion-card')];
 const champions=[];const seen=new Set();
 for(const card of cards){
  const id=card.getAttribute('data-champion-id')||card.getAttribute('data-copy-id');
  const name=card.querySelector('.champion-name')?.textContent?.trim();
  if(!id||!name||seen.has(id))continue;
  const levelText=card.querySelector('.champion-level')?.textContent?.trim();
  const levelMatch=levelText?.match(/\b([1-9]|[1-5][0-9]|60)\b/);
  const numberAttr=(key)=>{const raw=card.getAttribute(key);return raw!==null&&raw.trim()!==''&&Number.isFinite(Number(raw))?Number(raw):null};
  const stats={spd:numberAttr('data-speed'),acc:numberAttr('data-acc')};
  champions.push({copyId:id,name,level:levelMatch?Number(levelMatch[1]):null,stats});
  seen.add(id);
 }
 if(!champions.length)return alert('No verified champion cards with IDs and names were found. Nothing was uploaded. The HellHades page selectors may need adjustment.');
 if(!confirm('Send '+champions.length+' champions to your private RAID Companion roster? Missing stats will remain blank.'))return;
 try{
  const response=await fetch('https://lavsuaojwyzavwtbgkcs.supabase.co/functions/v1/raid-hh-ingest',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({source:'HellHades page DOM',champions})});
  const result=await response.json();
  alert(response.ok?'Saved '+result.saved+' champion snapshots. Return to RAID Companion.':'Transfer failed: '+(result.error||response.status));
 }catch(e){alert('Transfer failed: '+e.message)}
})();