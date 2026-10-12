import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync('site/hellhades-bookmarklet-source.js','utf8').replace(/^javascript:/,'');
async function run(total,count=total,filtered=total,missing=false){
 const alerts=[], confirms=[]; let uploads=0;
 const rows=Array.from({length:count},(_,i)=>({querySelector:()=>({textContent:'Stalwart'}),innerText:'1 Stalwart HP 2,543 ATK 112 DEF 125 SPD 87 C.RATE 15 C.DMG 56 Res 35'+(missing?'':' Acc 10'),getBoundingClientRect:()=>({top:i*150})}));
 const viewport={scrollTop:0,scrollHeight:0,clientHeight:800,querySelectorAll:()=>rows,getBoundingClientRect:()=>({top:0})};
 await vm.runInNewContext(source,{document:{body:{innerText:`${filtered}/${total} CHAMPIONS`},querySelector:()=>viewport},location:{hostname:'raidoptimiser.hellhades.com'},setTimeout:f=>f(),alert:x=>alerts.push(x),confirm:x=>{confirms.push(x);return false},prompt:()=>{throw Error('Unexpected token request')},fetch:()=>{uploads++;throw Error('Unexpected upload')}});
 assert.equal(uploads,0); return {alerts,confirms};
}
for(const n of [1,61,65,100]){const r=await run(n);assert.equal(r.alerts.length,0);assert.match(r.confirms[0],new RegExp(`Send ${n} champions`));}
assert.match((await run(61,60)).alerts[0],/scanned 60 of 61/);
assert.match((await run(61,61,61,true)).alerts[0],/61 rows have missing/);
assert.match((await run(61,10,10)).alerts[0],/Clear champion filters/);
console.log('Passed: dynamic totals, duplicate copies, complete stats, partial scans, missing stats and filtered roster protection.');
