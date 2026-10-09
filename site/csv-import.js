const normalize=name=>name.trim().toLocaleLowerCase();
const aliases=new Map([['dorothy','dorothy gale'],['vallyarn','vallaryn the equalizer']]);
const canonical=name=>aliases.get(normalize(name))||normalize(name);
export const canonicalName=canonical;
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;

export function parseCSV(text) {
 text=text.replace(/^\uFEFF/,'');
 const records=[];let row=[],field='',quoted=false,closed=false;
 const pushField=()=>{row.push(field);field='';closed=false;};
 const pushRow=()=>{pushField();if(row.some(v=>v.trim()))records.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(quoted){if(char==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=char;continue;}
  if(char==='"'){if(field||closed)throw new Error('Unexpected quote in CSV.');quoted=true;}
  else if(char===',')pushField();
  else if(char==='\n'||char==='\r'){if(char==='\r'&&text[i+1]==='\n')i++;pushRow();}
  else if(closed){if(!/\s/.test(char))throw new Error('Unexpected text after a quoted value.');}
  else field+=char;
 }
 if(quoted)throw new Error('A quoted CSV value is unfinished.');
 if(field||row.length||closed)pushRow();
 if(records.length<2)throw new Error('CSV must contain column headings and at least one champion.');
 const headings=records.shift().map(h=>h.trim());const lower=headings.map(h=>h.toLocaleLowerCase());
 if(new Set(lower).size!==lower.length || lower.some(h=>!h))throw new Error('CSV column headings must be distinct and nonempty.');
 for(const label of ['name','rank','level'])if(!lower.includes(label))throw new Error(`CSV is missing the ${label} column.`);
 if(records.length>10000)throw new Error('Import up to 10,000 champions at a time.');
 const occurrences=new Map();
 return records.map((cells,index)=>{
  if(cells.length!==headings.length)throw new Error(`Row ${index+2} has ${cells.length} values; expected ${headings.length}.`);
  const value=label=>{const i=lower.indexOf(label);return i<0?'':cells[i].trim();};
  const name=value('name'),rank=Number(value('rank')),level=Number(value('level')),ascension=value('ascension')?Number(value('ascension')):0;
  if(!name || name.length>100 || !value('rank') || !value('level') || !Number.isInteger(rank)||rank<1||rank>6||!Number.isInteger(level)||level<1||level>rank*10||!Number.isInteger(ascension)||ascension<0||ascension>rank)throw new Error(`Row ${index+2}: check the name, rank, level and ascension.`);
  const base=canonical(name),copy=(occurrences.get(base)||0)+1;occurrences.set(base,copy);
  return {name,rank,level,ascension,copy,import_key:`csv-v1:${base}:${copy}`,values:Object.fromEntries(headings.map((h,i)=>[h,cells[i]]))};
 });
}

export function planImport(imported,existing,{updateProgress=false,sourceFile=''}={}) {
 const used=new Set();
 return imported.map(champion=>{
  const match=existing.find(r=>!used.has(r.id)&&r.import_key===champion.import_key)||existing.find(r=>!used.has(r.id)&&!r.import_key&&canonical(r.name)===canonical(champion.name));
  if(match)used.add(match.id);
  const import_data={sourceFile,values:champion.values};
  const changes={name:champion.name,import_key:champion.import_key,import_data};
  if(!match||updateProgress)Object.assign(changes,{rank:champion.rank,level:champion.level,ascension:champion.ascension});
  const changed=!match||Object.entries(changes).some(([key,value])=>JSON.stringify(stable(match[key]))!==JSON.stringify(stable(value)));
  return {champion,existingId:match?.id||null,changes,action:!match?'Add':changed?'Update':'Unchanged',progressKept:!!match&&!updateProgress};
 });
}
