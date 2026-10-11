// Preview-only diagnostic. Does not request a token, contact a server, or upload data.
javascript:(()=>{
 if(location.hostname!=='raidoptimiser.hellhades.com'||!location.pathname.startsWith('/champions'))return alert('Open HellHades Champions first.');
 const names=['KAEL','SKATHIX','VALLARY','DOROTHY','CHESHIRE'];
 const findings=names.map(name=>{
  const nodes=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&e.textContent?.trim().toUpperCase()===name);
  const node=nodes[0];if(!node)return name+': not found';
  const chain=[];let el=node;for(let i=0;el&&i<4;i++,el=el.parentElement)chain.push(el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/).slice(0,3).join('.'):'' )+(el.id?'#'+el.id:''));
  return name+': '+chain.join(' < ');
 });
 const ids=document.querySelectorAll('[data-champion-id],[data-copy-id]').length;
 alert('PREVIEW ONLY — no data uploaded\\nCards with expected IDs: '+ids+'\\n'+findings.join('\\n'));
})();