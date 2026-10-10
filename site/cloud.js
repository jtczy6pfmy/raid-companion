import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const url = 'https://lavsuaojwyzavwtbgkcs.supabase.co';
const publishableKey = 'sb_publishable_UGGiNae4Y9iLRQTaQ1za3A_rd8Amfp5';
const db = createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true } });
let championId = null;
let connected = false;
let ownerId = null;
const championFields = "id,name,level,rank,ascension,notes,import_key,import_data";
const startingChampions = [
 {name:'Cheshire Cat',level:50,rank:5,ascension:1,notes:'Initial snapshot; recommended equipment not confirmed'},
 {name:'Dorothy',level:50,rank:5,ascension:0,notes:'Minotaur leader; ascension unverified'},
 {name:'Kael',level:60,rank:6,ascension:0,notes:'Minotaur damage dealer; ascension unverified'},
 {name:'Vallyarn',level:50,rank:5,ascension:0,notes:'Minotaur team; ascension unverified'},
 {name:'Skathix',level:50,rank:5,ascension:0,notes:'Minotaur team; ascension unverified'}
];
const startingRuns = [
 {dungeon:'Minotaur',stage:12,victory:true,duration_seconds:173,turns:63,scrolls:18,scroll_recipient:'Vallyarn',notes:'Cheshire survived'},
 {dungeon:'Minotaur',stage:13,victory:true,duration_seconds:145,turns:54,scrolls:20,scroll_recipient:'Vallyarn',notes:'Cheshire died before the boss'},
 {dungeon:'Minotaur',stage:13,victory:true,duration_seconds:154,turns:58,scrolls:22,scroll_recipient:'Dorothy',notes:'Cheshire died in wave 2'}
];
function check(result){if(result.error) throw result.error;return result.data;}
export async function initCloud({onStatus,onNotes,onRoster}) {
 try {
  onStatus('Connecting to private cloud storage…');
  let {data:{session},error} = await db.auth.getSession();
  if(error) throw error;
  if(!session) {
   const signed = await db.auth.signInAnonymously();
   if(signed.error) throw signed.error;
   session=signed.data.session;
  }
  if(!session?.user?.id) throw new Error('No device session available');
  const owner_id=session.user.id;
  ownerId=owner_id;
  let champions=check(await db.from('raid_champions').select(championFields).order('name'));
  if(!champions.length){
   champions=check(await db.from('raid_champions').insert(startingChampions.map(c=>({...c,owner_id}))).select(championFields));
  }
  const cat=champions.find(c=>c.name==='Cheshire Cat');
  championId=cat?.id || null;
  if(cat){
   const snapshots=check(await db.from('raid_stat_snapshots').select('id').eq('champion_id',championId).limit(1));
   if(!snapshots.length) check(await db.from('raid_stat_snapshots').insert({owner_id,champion_id:championId,hp:19222,atk:1971,def:1335,spd:167,crit_rate:71,crit_damage:103,resistance:87,accuracy:125,source:'previous screenshots'}));
  }
  const runs=check(await db.from('raid_dungeon_runs').select('id').limit(1));
  if(!runs.length) check(await db.from('raid_dungeon_runs').insert(startingRuns.map(r=>({...r,owner_id}))));
  connected=true;
  if(cat?.notes && cat.notes!=='Initial snapshot; recommended equipment not confirmed') onNotes(cat.notes);
  onStatus('Cloud connected · private device session');
  if(onRoster) onRoster(champions);
  return true;
 }catch(e){
  connected=false;
  onStatus('Local-only mode · '+(e?.message||'cloud unavailable')+'. Retry when the connection is available.');
  return false;
 }
}
export async function saveCloudNotes(notes) {
 if(!connected || !championId) return {saved:false,reason:'Cloud not connected'};
 const {error}=await db.from('raid_champions').update({notes,updated_at:new Date().toISOString()}).eq('id',championId);
 if(error) return {saved:false,reason:error.message};
 return {saved:true};
}

export async function saveCloudChampion(champion) {
 if(!connected || !ownerId) return {saved:false,reason:'Cloud not connected'};
 const {id,name,level,rank,ascension,notes}=champion;
 if(!name?.trim() || name.length>100 || !Number.isInteger(rank) || rank<1 || rank>6 || !Number.isInteger(level) || level<1 || level>rank*10 || !Number.isInteger(ascension) || ascension<0 || ascension>rank || typeof notes!=='string' || notes.length>10000) return {saved:false,reason:'Check champion details'};
 try {
  const payload={id,name:name.trim(),level,rank,ascension,notes,import_key:champion.import_key||null,import_data:champion.import_data||{},owner_id:ownerId,updated_at:new Date().toISOString()};
  let {data,error}=await db.from('raid_champions').upsert(payload,{onConflict:'id'}).select(championFields).single();
  if(error?.code==='23505' && payload.import_key){
   const existing=check(await db.from('raid_champions').select('id').eq('import_key',payload.import_key).single());
   ({data,error}=await db.from('raid_champions').upsert({...payload,id:existing.id},{onConflict:'id'}).select(championFields).single());
  }
  if(error) throw error;
  if(data.name==='Cheshire Cat') championId=data.id;
  return {saved:true,champion:data};
 }catch(error){return {saved:false,reason:error?.message||'Cloud unavailable'};}
}

export async function loadCloudPlans(){
 if(!connected||!ownerId)return {loaded:false,reason:'Cloud not connected'};
 try{return {loaded:true,plans:check(await db.from('raid_companion_plans').select('id,kind,payload,deleted,updated_at').order('updated_at'))};}
 catch(error){return {loaded:false,reason:error?.message||'Cloud unavailable'};}
}
export async function saveCloudPlan(plan){
 if(!connected||!ownerId)return {saved:false,reason:'Cloud not connected'};
 if(!['build','team','run'].includes(plan.kind)||!plan.id||typeof plan.payload!=='object'||!plan.payload||Array.isArray(plan.payload)||JSON.stringify(plan.payload).length>25000)return {saved:false,reason:'Invalid plan'};
 try {
  const payload={id:plan.id,owner_id:ownerId,kind:plan.kind,payload:plan.payload,deleted:!!plan.deleted,updated_at:plan.updated_at};
  const saved=check(await db.from('raid_companion_plans').upsert(payload,{onConflict:'id'}).select('id,kind,payload,deleted,updated_at').single());
  return {saved:true,plan:saved};
 }catch(error){return {saved:false,reason:error?.message||'Cloud unavailable'};}
}
