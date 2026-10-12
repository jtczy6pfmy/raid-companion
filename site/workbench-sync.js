import {reconcileWorkbench,resolveWorkbenchConflicts} from './workbench-model.js?v=20261012-3';
const blank=()=>({version:1,inventory:{version:1,artifacts:[],sets:[]},loadouts:[],sessions:[]});
export function createWorkbenchSync({getState,applyState,status,onConflict,storage=localStorage,loadCloud,saveCloud}){
 const key='raid-companion-workbench-cloud-v1';let meta={baseline:blank(),revision:0,pending:false},busy=false,ready=false,resolution=null,timer=null;
 try{const saved=JSON.parse(storage.getItem(key)||'null');if(saved?.baseline)meta=saved}catch{}
 const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):value;
 const same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
 function saveMeta(){try{storage.setItem(key,JSON.stringify(meta));return true}catch{status('Device storage unavailable. Export before closing.');return false}}
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>void sync(),750)}
 function changed(){meta.pending=true;if(saveMeta()){status('Workbench saved on device · cloud sync pending.');if(ready&&!resolution)schedule()}}
 async function sync(){
  if(busy||!ready)return;busy=true;resolution=null;onConflict(null);status('Checking private workbench storage…');
  try{
   const remote=await loadCloud();if(!remote.loaded){status('Workbench saved on device · '+remote.reason);return}
   if(meta.ownerId&&remote.ownerId&&meta.ownerId!==remote.ownerId)meta={baseline:blank(),revision:0,pending:true,ownerId:remote.ownerId};
   const merged=reconcileWorkbench(meta.baseline,getState(),remote.state||blank());
   if(merged.conflicts.length){resolution={remote,merged};onConflict(merged.conflicts);status(merged.conflicts.length+' workbench records changed both here and in cloud. Review which conflicting values to keep. Other records merge automatically.');return}
   await commit(merged.state,remote);
  }catch(error){status('Workbench saved on device · '+error.message)}finally{busy=false}
 }
 async function commit(next,remote){
  if(!same(getState(),next)&&!applyState(next))return;
  const snapshot=structuredClone(getState());
  if(same(snapshot,remote.state)){meta={baseline:snapshot,revision:remote.revision,pending:false,ownerId:remote.ownerId};if(saveMeta())status('Artifact inventory, loadouts and sessions synced with private cloud.');return}
  const result=await saveCloud(snapshot,remote.revision);
  if(!result.saved){status('Workbench saved on device · '+result.reason);return}
  meta={baseline:snapshot,revision:result.revision,pending:!same(snapshot,getState()),ownerId:remote.ownerId};if(!saveMeta())return;
  status(meta.pending?'Workbench saved on device · newer changes awaiting cloud sync.':'Artifact inventory, loadouts and sessions synced with private cloud.');
  if(meta.pending)schedule();
 }
 async function resolve(choice){
  if(!resolution||busy)return;busy=true;const {remote}=resolution;
  try{const merged=reconcileWorkbench(meta.baseline,getState(),remote.state||blank()),next=resolveWorkbenchConflicts(merged,choice);resolution=null;onConflict(null);await commit(next,remote)}catch(error){status('Workbench saved on device · '+error.message)}finally{busy=false}
 }
 return {changed,connect(){ready=true;return sync()},sync,resolve,disconnect(){ready=false;clearTimeout(timer);status('Workbench saved on device · cloud unavailable.')}};
}
