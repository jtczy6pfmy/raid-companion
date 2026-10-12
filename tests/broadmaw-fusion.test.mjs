import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const html=readFileSync('site/index.html','utf8');
test('Broadmaw has the correct two ingredient groups and four final champions',()=>{
 const code=html.slice(html.indexOf('const permanentFusions='),html.indexOf('function saveFusion('));
 const recipe=vm.runInNewContext(code+";fusionRecipe('Broadmaw')",{localStorage:{getItem:()=>null}});
 assert.deepEqual(Array.from(recipe.stages,x=>x.name),['Arbalester','Rockbeast','Huntress','Bloodhorn','Commander','Hardscale','Dhampir','Satyr','Warchanter','Brute','Jaeger','Militia']);
 assert.ok(html.includes("{top:'Arbalester',base:['Commander','Hardscale','Dhampir','Satyr']}"));
 assert.ok(html.includes("{top:'Rockbeast',base:['Warchanter','Brute','Jaeger','Militia']}"));
});
test('outdated generated Stoneskin requirement is removed without changing other progress',()=>{
 const rows=[{id:'catalog-Broadmaw-Stoneskin',target:'Broadmaw',name:'Stoneskin',owned:1},{id:'catalog-Broadmaw-Commander',target:'Broadmaw',name:'Commander',owned:1},{id:'custom-stoneskin',target:'Other fusion',name:'Stoneskin',owned:1}];
 const code=html.slice(html.indexOf('function fusionData()'),html.indexOf('const permanentFusions='));
 const result=vm.runInNewContext(code+';fusionData()',{fusionKey:'test',localStorage:{getItem:()=>JSON.stringify(rows)}});
 assert.deepEqual(JSON.parse(JSON.stringify(result)),rows.slice(1));
});
