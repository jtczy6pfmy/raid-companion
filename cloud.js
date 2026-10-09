import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const url = 'https://lavsuaojwyzavwtbgkcs.supabase.co';
const publishableKey = 'sb_publishable_UGGiNae4Y9iLRQTaQ1za3A_rd8Amfp5';
const db = createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true } });
let championId = null;
let connected = false;
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
export async function initCloud({onStatus,onNotes}) {
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
  let champions=check(await db.from('raid_champions').select('id,name,notes').order('name'));
  if(!champions.length){
   champions=check(await db.from('raid_champions').insert(startingChampions.map(c=>({...c,owner_id}))).select('id,name,notes'));
  }
  const cat=champions.find(c=>c.name==='Cheshire Cat');
  if(!cat) throw new Error('Cheshire Cat record missing');
  championId=cat.id;
  const snapshots=check(await db.from('raid_stat_snapshots').select('id').eq('champion_id',championId).limit(1));
  if(!snapshots.length) check(await db.from('raid_stat_snapshots').insert({owner_id,champion_id:championId,hp:19222,atk:1971,def:1335,spd:167,crit_rate:71,crit_damage:103,resistance:87,accuracy:125,source:'previous screenshots'}));
  const runs=check(await db.from('raid_dungeon_runs').select('id').limit(1));
  if(!runs.length) check(await db.from('raid_dungeon_runs').insert(startingRuns.map(r=>({...r,owner_id}))));
  connected=true;
  if(cat.notes && cat.notes!=='Initial snapshot; recommended equipment not confirmed') onNotes(cat.notes);
  onStatus('Cloud connected · private device session');
  return true;
 }catch(e){
  connected=false;
  onStatus('Local-only mode · '+(e?.message||'cloud unavailable')+'. Enable anonymous sign-ins in Supabase Auth settings.');
  return false;
 }
}
export async function saveCloudNotes(notes) {
 if(!connected || !championId) return {saved:false,reason:'Cloud not connected'};
 const {error}=await db.from('raid_champions').update({notes,updated_at:new Date().toISOString()}).eq('id',championId);
 if(error) return {saved:false,reason:error.message};
 return {saved:true};
}
