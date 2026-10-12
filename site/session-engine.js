export function planSession({runs,energyPerRun,secondsPerRun,energyBudget}){
 if(!Number.isInteger(runs)||runs<1||runs>10000||!Number.isFinite(energyPerRun)||energyPerRun<0||!Number.isFinite(secondsPerRun)||secondsPerRun<=0||secondsPerRun>86400||!Number.isFinite(energyBudget)||energyBudget<0)throw Error('Enter valid run count, energy, duration and budget.');
 const affordable=energyPerRun===0?runs:Math.min(runs,Math.floor(energyBudget/energyPerRun));
 return {runs:affordable,requestedRuns:runs,energy:affordable*energyPerRun,seconds:affordable*secondsPerRun,shortfall:Math.max(0,runs*energyPerRun-energyBudget)};
}
export function sessionProgress(session){
 const runs=session.results||[];const victories=runs.filter(r=>r.result==='Victory');
 return {completed:runs.length,remaining:Math.max(0,session.plan.runs-runs.length),energy:runs.reduce((n,r)=>n+r.energy,0),seconds:runs.reduce((n,r)=>n+r.seconds,0),wins:victories.length,winRate:runs.length?Math.round(100*victories.length/runs.length):null,averageVictory:victories.length?victories.reduce((n,r)=>n+r.seconds,0)/victories.length:null};
}
export function recordSessionRun(session,{result,energy,seconds,recordedAt=new Date().toISOString()}){
 if(!['Victory','Defeat'].includes(result)||!Number.isFinite(energy)||energy<0||!Number.isFinite(seconds)||seconds<=0||seconds>86400||!Number.isFinite(Date.parse(recordedAt)))throw Error('Enter valid battle result, energy and seconds.');
 if(sessionProgress(session).remaining===0)throw Error('This session is complete.');
 return {...session,results:[...(session.results||[]),{result,energy,seconds,recordedAt}]};
}
