export const MAX_BYTES=5*1024*1024;
export function parseCSV(text) {
 if(new TextEncoder().encode(text).length>MAX_BYTES) throw Error('CSV exceeds 5 MB.');
 text=text.replace(/^\uFEFF/,'');
 const first=text.split(/\r?\n/,1)[0];
 const delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw Error('Invalid CSV quoting.');quoted=true;}
  else if(c===delimiter){row.push(cell);cell='';closed=false;}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';closed=false;if(rows.length>10001)throw Error('CSV exceeds 10,000 champions.');}
  else {if(closed)throw Error('Unexpected text after closing quote.');cell+=c;}
 }
 if(quoted)throw Error('Unclosed CSV quote.');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length<2)throw Error('CSV needs headers and at least one champion.');
 if(rows.length>10001)throw Error('CSV exceeds 10,000 champions.');
 const headers=rows.shift().map(v=>v.trim());
 if(headers.some(v=>!v)||new Set(headers.map(v=>v.toLowerCase())).size!==headers.length)throw Error('Empty or duplicate headers.');
 if(rows.some(r=>r.length!==headers.length))throw Error('A CSV row has the wrong number of columns.');
 return {headers,rows};
}
const aliases={name:['name','champion','championname','champion name'],id:['id','championid','champion id'],level:['level','lvl'],rank:['rank','stars'],faction:['faction'],affinity:['affinity'],rarity:['rarity']};
export function guessMapping(headers){return Object.fromEntries(Object.entries(aliases).map(([k,a])=>[k,headers.findIndex(h=>a.includes(h.toLowerCase()))]));}
export function validateRoster(csv,mapping) {
 if(!Number.isInteger(mapping.name)||mapping.name<0||mapping.name>=csv.headers.length)throw Error('Map a champion name column.');
 const used=Object.values(mapping).filter(i=>i>=0);if(new Set(used).size!==used.length)throw Error('Each column can be mapped only once.');
 const ids=new Set(),errors=[],champions=[];
 csv.rows.forEach((r,i)=>{
  const read=k=>mapping[k]>=0?r[mapping[k]].trim():'';
  const c={name:read('name'),sourceId:read('id'),level:null,rank:null,faction:read('faction'),affinity:read('affinity'),rarity:read('rarity')};
  if(!c.name||c.name.length>200)errors.push('Row '+(i+2)+': name is required (maximum 200 characters).');
  for(const [k,max] of [['level',60],['rank',6]]){const s=read(k);if(s){if(!/^\d+$/.test(s)||Number(s)<1||Number(s)>max)errors.push('Row '+(i+2)+': invalid '+k+'.');else c[k]=Number(s);}}
  if([c.sourceId,c.faction,c.affinity,c.rarity].some(s=>s.length>200))errors.push('Row '+(i+2)+': field exceeds 200 characters.');
  if(c.sourceId){if(ids.has(c.sourceId))errors.push('Row '+(i+2)+': duplicate champion ID.');ids.add(c.sourceId);}
  champions.push(c);
 });
 if(errors.length)throw Error(errors.slice(0,10).join('\n')+(errors.length>10?'\nAdditional errors: '+(errors.length-10):''));
 return champions;
}
